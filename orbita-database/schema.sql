-- Apply only to Alba Vision's dedicated Orbita project. Never to a client's DB.
begin;
create schema if not exists orbita;
revoke all on schema orbita from public, anon, authenticated;
grant usage on schema orbita to service_role;

create table orbita.tenants (
  id uuid primary key, slug text not null unique, name text not null,
  paused boolean not null default true, monthly_budget_usd numeric(16,8),
  input_usd_per_million numeric(16,8) not null default 0.042,
  created_at timestamptz not null default now(),
  check (monthly_budget_usd is null or monthly_budget_usd >= 0), check(input_usd_per_million >= 0)
);
create table orbita.channels (
  id uuid primary key, tenant_id uuid not null references orbita.tenants(id),
  app_id text not null, waba_id text not null, phone_number_id text not null,
  connector text not null check(connector in ('sankalpa-guided-v1','human-review-v1')),
  credentials text not null, mode text not null default 'trial' check(mode in ('trial','production')), allowed_senders text[],
  enabled boolean not null default false, credentials_ready boolean not null default false, jev_enabled boolean not null default true,
  credential_revision integer not null default 0,
  lease_owner uuid, lease_until timestamptz, last_error text,
  unique(app_id,phone_number_id), check((mode='trial' and allowed_senders is not null and cardinality(allowed_senders)>0) or (mode='production' and allowed_senders is null))
);
create table orbita.messages (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references orbita.tenants(id),
  channel_id uuid not null references orbita.channels(id), provider_id text not null,
  sender text not null, customer_name text not null, body text not null, media_id text,
  message_type text not null, received_at timestamptz not null, created_at timestamptz not null default now(),
  decision jsonb, reply text, needs_human boolean not null default false,
  delivery text not null default 'pending' check(delivery in ('pending','sending','accepted','sent','delivered','read','rejected','unknown','expired')),
  outbound_id text, attempts integer not null default 0, next_attempt_at timestamptz not null default now(), last_error text,
  unique(channel_id,provider_id)
);
create index orbita_messages_due on orbita.messages(next_attempt_at,created_at) where delivery='pending' and attempts<5;
create index orbita_messages_tenant on orbita.messages(tenant_id,created_at desc);
create index orbita_messages_outbound on orbita.messages(channel_id,outbound_id) where outbound_id is not null;
create table orbita.receipts (
  channel_id uuid not null references orbita.channels(id), provider_id text not null,
  sender text not null, status text not null check(status in ('sent','delivered','read','failed')),
  error_code integer, received_at timestamptz not null default now(), primary key(channel_id,provider_id)
);
create table orbita.cases (
  id uuid primary key, tenant_id uuid not null references orbita.tenants(id), channel_id uuid not null references orbita.channels(id),
  sender text not null, source_message_id uuid not null unique references orbita.messages(id), quote jsonb not null, submission jsonb,
  created_at timestamptz not null default now()
);
create index orbita_cases_owner on orbita.cases(tenant_id,channel_id,sender);
create table orbita.usage (
  message_id uuid primary key references orbita.messages(id), tenant_id uuid not null references orbita.tenants(id),
  month text not null, model text not null default 'jev-1.13.0', input_tokens bigint, output_tokens bigint,
  estimated_usd numeric(16,8) not null, verified boolean not null default false, created_at timestamptz not null default now()
);
create index orbita_usage_budget on orbita.usage(tenant_id,month);
create table orbita.settings(id integer primary key check(id=1), monthly_budget_usd numeric(16,8));
insert into orbita.settings(id) values(1);
alter table orbita.tenants enable row level security;
alter table orbita.channels enable row level security;
alter table orbita.messages enable row level security;
alter table orbita.receipts enable row level security;
alter table orbita.cases enable row level security;
alter table orbita.usage enable row level security;
alter table orbita.settings enable row level security;
grant select,insert,update on all tables in schema orbita to service_role;

create function public.orbita_require_lease(p_message_id uuid,p_owner uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from orbita.messages m join orbita.channels c on c.id=m.channel_id
    where m.id=p_message_id and c.lease_owner=p_owner and c.lease_until>now()) then raise exception 'LEASE_LOST'; end if;
end $$;

create function public.orbita_create_tenant(p_id uuid,p_slug text,p_name text,p_budget numeric) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  insert into orbita.tenants(id,slug,name,monthly_budget_usd) values(p_id,p_slug,p_name,p_budget);
  return jsonb_build_object('id',p_id,'slug',p_slug,'paused',true);
end $$;
create function public.orbita_create_channel(p_id uuid,p_tenant_id uuid,p_app_id text,p_waba_id text,p_phone_id text,p_connector text,p_credentials text,p_allowed text[],p_mode text default 'trial') returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  insert into orbita.channels(id,tenant_id,app_id,waba_id,phone_number_id,connector,credentials,allowed_senders,mode)
    values(p_id,p_tenant_id,p_app_id,p_waba_id,p_phone_id,p_connector,p_credentials,p_allowed,p_mode);
  return jsonb_build_object('id',p_id,'tenantId',p_tenant_id,'enabled',false);
end $$;
create function public.orbita_ingest(p_app_id text,p_events jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e jsonb; c orbita.channels; added integer:=0; count_rows integer;
begin
  if jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>1000 then raise exception 'INVALID_EVENTS'; end if;
  for e in select value from jsonb_array_elements(p_events) loop
    select * into c from orbita.channels where app_id=p_app_id and waba_id=e->>'wabaId' and phone_number_id=e->>'phoneNumberId';
    if not found then continue; end if;
    if e->>'kind'='inbound' then
      if not c.enabled or (c.mode='trial' and not (e->>'from'=any(c.allowed_senders))) then continue; end if;
      insert into orbita.messages(tenant_id,channel_id,provider_id,sender,customer_name,body,media_id,message_type,received_at)
        values(c.tenant_id,c.id,e->>'id',e->>'from',e->>'name',e->>'body',nullif(e->>'mediaId',''),e->>'type',(e->>'receivedAt')::timestamptz)
        on conflict(channel_id,provider_id) do nothing;
      get diagnostics count_rows=row_count; added:=added+count_rows;
    elsif e->>'kind'='receipt' then
      insert into orbita.receipts(channel_id,provider_id,sender,status,error_code)
        values(c.id,e->>'id',e->>'from',e->>'status',(e->>'errorCode')::integer)
        on conflict(channel_id,provider_id) do update set
          status=case when orbita.receipts.status='read' or (orbita.receipts.status='delivered' and excluded.status<>'read') then orbita.receipts.status else excluded.status end,
          error_code=excluded.error_code,received_at=now();
      update orbita.messages m set delivery=case
        when m.delivery='read' or (m.delivery='delivered' and e->>'status'<>'read') then m.delivery
        when e->>'status'='failed' then 'rejected' else e->>'status' end
        where m.channel_id=c.id and m.outbound_id=e->>'id' and m.sender=e->>'from';
    end if;
  end loop;
  return jsonb_build_object('added',added);
end $$;

create function public.orbita_claim(p_owner uuid) returns jsonb
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
    'connector',c.connector,'credentials',c.credentials,'credentialRevision',c.credential_revision,'jevEnabled',c.jev_enabled,'decision',m.decision,'reply',m.reply,
    'message',jsonb_build_object('id',m.provider_id,'from',m.sender,'name',m.customer_name,'body',m.body,'mediaId',m.media_id,'receivedAt',m.received_at));
end $$;
create function public.orbita_reserve_usage(p_message_id uuid,p_owner uuid,p_tokens bigint) returns boolean
language plpgsql security invoker set search_path='' as $$
declare m orbita.messages; t orbita.tenants; global_limit numeric; tenant_used numeric; total_used numeric; amount numeric; period text;
begin
  perform public.orbita_require_lease(p_message_id,p_owner);
  select monthly_budget_usd into global_limit from orbita.settings where id=1 for update;
  select * into m from orbita.messages where id=p_message_id;
  select * into t from orbita.tenants where id=m.tenant_id for update;
  if p_tokens<1 or p_tokens>20000 or t.paused or exists(select 1 from orbita.usage where message_id=m.id) then return false; end if;
  period:=to_char(now() at time zone 'America/Mexico_City','YYYY-MM');
  amount:=ceil(p_tokens*t.input_usd_per_million/1000000*100000000)/100000000;
  select coalesce(sum(estimated_usd),0) into tenant_used from orbita.usage where tenant_id=t.id and month=period;
  select coalesce(sum(estimated_usd),0) into total_used from orbita.usage where month=period;
  if (t.monthly_budget_usd is not null and tenant_used+amount>t.monthly_budget_usd) or
    (global_limit is not null and total_used+amount>global_limit) then return false; end if;
  insert into orbita.usage(message_id,tenant_id,month,estimated_usd) values(m.id,t.id,period,amount);
  return true;
end $$;
create function public.orbita_save_decision(p_message_id uuid,p_owner uuid,p_decision jsonb) returns void
language plpgsql security invoker set search_path='' as $$
begin
  perform public.orbita_require_lease(p_message_id,p_owner);
  update orbita.messages set decision=p_decision where id=p_message_id and decision is null;
  if p_decision->'usage' is not null then
    update orbita.usage u set input_tokens=(p_decision->'usage'->>'inputTokens')::bigint,output_tokens=(p_decision->'usage'->>'outputTokens')::bigint,
      estimated_usd=ceil((p_decision->'usage'->>'inputTokens')::numeric*t.input_usd_per_million/1000000*100000000)/100000000,verified=true
      from orbita.tenants t where u.message_id=p_message_id and t.id=u.tenant_id;
  end if;
end $$;
create function public.orbita_handoff(p_message_id uuid,p_owner uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin perform public.orbita_require_lease(p_message_id,p_owner); update orbita.messages set needs_human=true where id=p_message_id; end $$;
create function public.orbita_prepare_reply(p_message_id uuid,p_owner uuid,p_reply text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  perform public.orbita_require_lease(p_message_id,p_owner);
  if length(p_reply)<1 or length(p_reply)>4000 then raise exception 'INVALID_REPLY'; end if;
  update orbita.messages set reply=p_reply where id=p_message_id and delivery='pending';
end $$;
create function public.orbita_mark_sending(p_message_id uuid,p_owner uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  perform public.orbita_require_lease(p_message_id,p_owner);
  update orbita.messages set delivery='sending' where id=p_message_id and delivery='pending' and reply is not null;
  if not found then raise exception 'SEND_NOT_PREPARED'; end if;
end $$;
create function public.orbita_finish(p_message_id uuid,p_owner uuid,p_delivery jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare m orbita.messages; receipt text; state text:=p_delivery->>'status';
begin
  perform public.orbita_require_lease(p_message_id,p_owner);
  select * into m from orbita.messages where id=p_message_id for update;
  if state not in ('accepted','rejected','unknown','expired') then raise exception 'INVALID_DELIVERY'; end if;
  select status into receipt from orbita.receipts where channel_id=m.channel_id and provider_id=p_delivery->>'messageId' and sender=m.sender;
  if receipt is not null then state:=case when receipt='failed' then 'rejected' else receipt end; end if;
  update orbita.messages set delivery=state,outbound_id=p_delivery->>'messageId',last_error=p_delivery->>'error',needs_human=needs_human or state in ('rejected','unknown','expired') where id=m.id;
  if p_delivery->>'code'='190' or p_delivery->>'error'='META_CREDENTIAL_EXPIRED' then
    update orbita.channels set credentials_ready=false,last_error='META_CREDENTIAL_INVALID'
      where id=m.channel_id and credential_revision=(p_delivery->>'credentialRevision')::integer;
  end if;
  update orbita.channels set lease_owner=null,lease_until=null where id=m.channel_id and lease_owner=p_owner;
end $$;
create function public.orbita_fail_job(p_message_id uuid,p_owner uuid,p_sending boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare channel uuid;
begin
  perform public.orbita_require_lease(p_message_id,p_owner);
  update orbita.messages set delivery=case when p_sending then 'unknown' else 'pending' end,
    next_attempt_at=now()+make_interval(secs=>least(1800,30*power(2,attempts)::integer)),last_error='PROCESSING_FAILED',
    needs_human=needs_human or p_sending or attempts>=5 where id=p_message_id returning channel_id into channel;
  update orbita.channels set lease_owner=null,lease_until=null where id=channel and lease_owner=p_owner;
end $$;

create function public.orbita_case_for_message(p_message_id uuid,p_owner uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin perform public.orbita_require_lease(p_message_id,p_owner); return (select jsonb_build_object('id',id,'quote',quote,'submission',submission) from orbita.cases where source_message_id=p_message_id); end $$;
create function public.orbita_save_case(p_message_id uuid,p_owner uuid,p_case_id uuid,p_quote jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  perform public.orbita_require_lease(p_message_id,p_owner);
  insert into orbita.cases(id,tenant_id,channel_id,sender,source_message_id,quote)
    select p_case_id,tenant_id,channel_id,sender,id,p_quote from orbita.messages where id=p_message_id on conflict(source_message_id) do nothing;
  return public.orbita_case_for_message(p_message_id,p_owner);
end $$;
create function public.orbita_find_case(p_message_id uuid,p_owner uuid,p_case_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  perform public.orbita_require_lease(p_message_id,p_owner);
  return (select jsonb_build_object('id',c.id,'quote',c.quote,'submission',c.submission) from orbita.cases c join orbita.messages m
    on m.tenant_id=c.tenant_id and m.channel_id=c.channel_id and m.sender=c.sender where m.id=p_message_id and c.id=p_case_id);
end $$;
create function public.orbita_submit_case(p_message_id uuid,p_owner uuid,p_case_id uuid,p_submission jsonb) returns void
language plpgsql security invoker set search_path='' as $$
begin
  perform public.orbita_require_lease(p_message_id,p_owner);
  update orbita.cases c set submission=p_submission from orbita.messages m
    where m.id=p_message_id and c.id=p_case_id and c.tenant_id=m.tenant_id and c.channel_id=m.channel_id and c.sender=m.sender;
  if not found then raise exception 'CASE_NOT_OWNED'; end if;
end $$;
create function public.orbita_status() returns jsonb
language sql security invoker set search_path='' as $$
select jsonb_build_object('tenants',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'slug',t.slug,'name',t.name,'paused',t.paused,'monthlyBudgetUsd',t.monthly_budget_usd)) from orbita.tenants t),'[]'::jsonb),
  'channels',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'tenantId',c.tenant_id,'enabled',c.enabled,'credentialsReady',c.credentials_ready,'error',c.last_error)) from orbita.channels c),'[]'::jsonb),
  'messages',coalesce((select jsonb_object_agg(delivery,n) from (select delivery,count(*) n from orbita.messages group by delivery) x),'{}'::jsonb));
$$;
create function public.orbita_tenant_state(p_id uuid,p_paused boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  update orbita.tenants set paused=p_paused where id=p_id;
  if not found then raise exception 'TENANT_NOT_FOUND'; end if;
  return jsonb_build_object('id',p_id,'paused',p_paused);
end $$;
create function public.orbita_operator_channel(p_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
select jsonb_build_object('id',id,'tenantId',tenant_id,'wabaId',waba_id,'phoneNumberId',phone_number_id,'credentials',credentials) from orbita.channels where id=p_id;
$$;
create function public.orbita_activate_channel(p_id uuid,p_credentials text) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  update orbita.channels set credentials=p_credentials,enabled=true,credentials_ready=true,credential_revision=credential_revision+1,last_error=null where id=p_id;
  if not found then raise exception 'CHANNEL_NOT_FOUND'; end if;
  return jsonb_build_object('id',p_id,'enabled',true);
end $$;
-- All public wrappers are server-only. No customer or anonymous DB role can call them.
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'orbita_%' loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
commit;
