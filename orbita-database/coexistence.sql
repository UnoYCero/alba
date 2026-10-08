-- Additive upgrade for the dedicated Alba Vision / Orbita database only.
begin;
create table orbita.coexistence_channels (
  channel_id uuid primary key references orbita.channels(id),
  business_phone_index text not null check(business_phone_index ~ '^h1_[a-f0-9]{64}$'),
  verified_at timestamptz not null default now()
);
create table orbita.conversations (
  channel_id uuid not null references orbita.channels(id),
  sender text not null check(sender ~ '^h1_[a-f0-9]{64}$'), held boolean not null default false,
  resumed_at timestamptz, last_manual_at timestamptz,
  primary key(channel_id,sender)
);
create table orbita.manual_messages (
  channel_id uuid not null references orbita.channels(id), provider_id text not null,
  sender text not null check(sender ~ '^h1_[a-f0-9]{64}$'), body text not null,
  message_type text not null, received_at timestamptz not null,
  primary key(channel_id,provider_id),
  check(coalesce((body::jsonb->>'version')='1' and jsonb_typeof(body::jsonb->'ciphertext')='string' and jsonb_typeof(body::jsonb->'iv')='string',false))
);
create index orbita_manual_conversation on orbita.manual_messages(channel_id,sender,received_at desc);
alter table orbita.coexistence_channels enable row level security;
alter table orbita.conversations enable row level security;
alter table orbita.manual_messages enable row level security;
revoke all on orbita.coexistence_channels,orbita.conversations,orbita.manual_messages from public,anon,authenticated;
grant select,insert,update on orbita.coexistence_channels,orbita.conversations,orbita.manual_messages to service_role;

create function public.orbita_configure_coexistence(p_channel_id uuid,p_business_phone text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  insert into orbita.coexistence_channels(channel_id,business_phone_index) values(p_channel_id,p_business_phone)
    on conflict(channel_id) do update set business_phone_index=excluded.business_phone_index,verified_at=now();
end $$;
create function public.orbita_conversation_state(p_channel_id uuid,p_sender text,p_held boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from orbita.coexistence_channels where channel_id=p_channel_id) then raise exception 'COEXISTENCE_NOT_CONFIGURED'; end if;
  insert into orbita.conversations(channel_id,sender,held,resumed_at) values(p_channel_id,p_sender,p_held,case when not p_held then now() end)
    on conflict(channel_id,sender) do update set held=excluded.held,resumed_at=case when not p_held then now() else orbita.conversations.resumed_at end;
  return jsonb_build_object('channelId',p_channel_id,'held',p_held);
end $$;
create function public.orbita_ingest_coexistence(p_app_id text,p_events jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e jsonb; c orbita.channels; inserted integer; added integer:=0; affected integer:=0; event_time timestamptz;
begin
  if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events)>1000 then raise exception 'INVALID_EVENTS'; end if;
  for e in select value from jsonb_array_elements(p_events) loop
    if e->>'kind'='disconnect' then
      update orbita.channels ch set enabled=false,credentials_ready=false,last_error='COEXISTENCE_DISCONNECTED'
        from orbita.coexistence_channels co where co.channel_id=ch.id and ch.app_id=p_app_id and ch.waba_id=e->>'wabaId'
        and (e->>'from' is null or co.business_phone_index=e->>'from')
        and e->>'event' in ('PARTNER_REMOVED','ACCOUNT_OFFBOARDED');
      get diagnostics inserted=row_count; affected:=affected+inserted;
    elsif e->>'kind'='manual' then
      select ch.* into c from orbita.channels ch join orbita.coexistence_channels co on co.channel_id=ch.id
        where ch.app_id=p_app_id and ch.waba_id=e->>'wabaId' and ch.phone_number_id=e->>'phoneNumberId' for update of ch;
      if not found or not c.enabled or (c.mode='trial' and not (e->>'from'=any(c.allowed_senders))) then continue; end if;
      event_time:=(e->>'receivedAt')::timestamptz;
      insert into orbita.manual_messages(channel_id,provider_id,sender,body,message_type,received_at)
        values(c.id,e->>'id',e->>'from',e->>'body',e->>'type',event_time) on conflict(channel_id,provider_id) do nothing;
      get diagnostics inserted=row_count; added:=added+inserted;
      if inserted>0 then
        insert into orbita.conversations(channel_id,sender,held,last_manual_at) values(c.id,e->>'from',true,event_time)
          on conflict(channel_id,sender) do update set
            held=orbita.conversations.held or orbita.conversations.resumed_at is null or event_time>orbita.conversations.resumed_at,
            last_manual_at=greatest(orbita.conversations.last_manual_at,event_time);
      end if;
    end if;
  end loop;
  return jsonb_build_object('added',added,'disconnected',affected);
end $$;
create function public.orbita_coexistence_check(p_message_id uuid,p_owner uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  perform public.orbita_require_lease(p_message_id,p_owner);
  return exists(select 1 from orbita.messages m join orbita.channels c on c.id=m.channel_id join orbita.tenants t on t.id=m.tenant_id
    where m.id=p_message_id and c.enabled and c.credentials_ready and not t.paused
    and exists(select 1 from orbita.coexistence_channels where channel_id=c.id)
    and not exists(select 1 from orbita.conversations v where v.channel_id=c.id and v.sender=m.sender and v.held));
end $$;
create function public.orbita_coexistence_skip(p_message_id uuid,p_owner uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare channel uuid;
begin
  perform public.orbita_require_lease(p_message_id,p_owner);
  update orbita.messages set delivery='expired',needs_human=true,last_error='HUMAN_TAKEOVER_OR_CHANNEL_PAUSED'
    where id=p_message_id and delivery='pending' returning channel_id into channel;
  update orbita.channels set lease_owner=null,lease_until=null where id=channel and lease_owner=p_owner;
end $$;
create function public.orbita_coexistence_begin_send(p_message_id uuid,p_owner uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  -- Serialize with manual echoes at the final outbox transition. A provider call
  -- already in flight cannot be recalled if a human answers afterwards.
  perform 1 from orbita.channels c join orbita.messages m on m.channel_id=c.id where m.id=p_message_id for update of c;
  if not public.orbita_coexistence_check(p_message_id,p_owner) then
    perform public.orbita_coexistence_skip(p_message_id,p_owner); return false;
  end if;
  perform public.orbita_mark_sending(p_message_id,p_owner); return true;
end $$;
create function orbita.hold_after_handoff() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.needs_human and new.delivery in ('accepted','sent','delivered','read','rejected','unknown','expired')
    and exists(select 1 from orbita.coexistence_channels where channel_id=new.channel_id) then
    insert into orbita.conversations(channel_id,sender,held) values(new.channel_id,new.sender,true)
      on conflict(channel_id,sender) do update set held=true;
  end if;
  return new;
end $$;
create trigger orbita_human_handoff after update of delivery on orbita.messages for each row
  when (new.needs_human and old.delivery in ('pending','sending') and old.delivery is distinct from new.delivery) execute function orbita.hold_after_handoff();
revoke all on function orbita.hold_after_handoff() from public,anon,authenticated;
grant execute on function orbita.hold_after_handoff() to service_role;

-- The existing claim function is replaced below with the same lease/outbox logic
-- and one additional boolean indicating verified coexistence.
create or replace function public.orbita_claim(p_owner uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c orbita.channels; m orbita.messages; t orbita.tenants;
begin
  -- A provider call whose completion was not saved is never retried automatically.
  update orbita.messages msg set delivery='unknown',last_error='LEASE_EXPIRED_DURING_SEND',needs_human=true
    from orbita.channels ch where msg.channel_id=ch.id and msg.delivery='sending' and ch.lease_until<now();
  select c1.* into c from orbita.channels c1 join orbita.tenants t1 on t1.id=c1.tenant_id
    where c1.enabled and c1.credentials_ready and not t1.paused and (c1.lease_until is null or c1.lease_until<now())
      and exists(select 1 from orbita.messages m1 where m1.channel_id=c1.id and m1.delivery='pending' and m1.attempts<5 and m1.next_attempt_at<=now())
    order by (select min(m2.created_at) from orbita.messages m2 where m2.channel_id=c1.id and m2.delivery='pending')
    limit 1 for update of c1 skip locked;
  if not found then return null; end if;
  update orbita.channels set lease_owner=p_owner,lease_until=now()+interval '120 seconds' where id=c.id;
  select * into m from orbita.messages where channel_id=c.id and delivery='pending' and attempts<5 and next_attempt_at<=now() order by created_at,id limit 1 for update;
  update orbita.messages set attempts=attempts+1 where id=m.id;
  select * into t from orbita.tenants where id=c.tenant_id;
  return jsonb_build_object('id',m.id,'tenantId',t.id,'tenantName',t.name,'channelId',c.id,'phoneNumberId',c.phone_number_id,
    'coexistence',exists(select 1 from orbita.coexistence_channels where channel_id=c.id),'connector',c.connector,'credentials',c.credentials,'credentialRevision',c.credential_revision,'jevEnabled',c.jev_enabled,'decision',m.decision,'reply',m.reply,
    'message',jsonb_build_object('id',m.provider_id,'from',m.sender,'name',m.customer_name,'body',m.body,'mediaId',m.media_id,'receivedAt',m.received_at));
end $$;
-- All public wrappers are server-only. No customer or anonymous DB role can call them.
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'orbita_%' loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
commit;
