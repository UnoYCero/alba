-- Dedicated Alba Vision/Orbita project only. No client database migration here.
begin;
create table orbita.commerce_sessions (
 channel_id uuid not null references orbita.channels(id),sender text not null,
 revision integer not null default 0,state text not null,updated_at timestamptz not null default now(),
 primary key(channel_id,sender),check(sender ~ '^h1_[a-f0-9]{64}$'),
 check(coalesce((state::jsonb->>'version')='1' and jsonb_typeof(state::jsonb->'ciphertext')='string',false))
);
create table orbita.commerce_requests (
 id uuid primary key,tenant_id uuid not null references orbita.tenants(id),channel_id uuid not null references orbita.channels(id),
 sender text not null,body text not null,status text not null default 'pending',revision integer not null default 0,
 review_body text,review_owner uuid,order_id text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(status in ('pending','committing','confirmed','cancelled','uncertain')),
 check(sender ~ '^h1_[a-f0-9]{64}$'),
 check(coalesce((body::jsonb->>'version')='1' and jsonb_typeof(body::jsonb->'ciphertext')='string',false)),
 check(review_body is null or coalesce((review_body::jsonb->>'version')='1' and jsonb_typeof(review_body::jsonb->'ciphertext')='string',false))
);
create index orbita_commerce_tenant on orbita.commerce_requests(tenant_id,created_at desc);
alter table orbita.commerce_sessions enable row level security;
alter table orbita.commerce_requests enable row level security;
revoke all on orbita.commerce_sessions,orbita.commerce_requests from public,anon,authenticated;
grant select,insert,update on orbita.commerce_sessions,orbita.commerce_requests to service_role;
create function public.orbita_commerce_context(p_message_id uuid,p_owner uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare m orbita.messages; s orbita.commerce_sessions; r orbita.commerce_requests;
begin
 perform public.orbita_require_lease(p_message_id,p_owner);
 select * into m from orbita.messages where id=p_message_id;
 perform 1 from orbita.channels where id=m.channel_id for update;
 select * into s from orbita.commerce_sessions where channel_id=m.channel_id and sender=m.sender;
 select * into r from orbita.commerce_requests where channel_id=m.channel_id and sender=m.sender order by created_at desc,id limit 1;
 return jsonb_build_object('state',s.state,'revision',coalesce(s.revision,0),
 'held',exists(select 1 from orbita.conversations where channel_id=m.channel_id and sender=m.sender and held),
 'request',case when r.id is null then null else jsonb_build_object('id',r.id,'body',r.body,'status',r.status,'orderId',r.order_id,'revision',r.revision) end);
end $$;
create function public.orbita_commerce_commit(p_message_id uuid,p_owner uuid,p_revision integer,p_state text,p_request jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare m orbita.messages; current_revision integer;
begin
 perform public.orbita_require_lease(p_message_id,p_owner);
 select * into m from orbita.messages where id=p_message_id;
 select revision into current_revision from orbita.commerce_sessions where channel_id=m.channel_id and sender=m.sender for update;
 if coalesce(current_revision,0)<>p_revision then raise exception 'SESSION_CONFLICT'; end if;
 insert into orbita.commerce_sessions(channel_id,sender,revision,state) values(m.channel_id,m.sender,p_revision+1,p_state)
 on conflict(channel_id,sender) do update set revision=excluded.revision,state=excluded.state,updated_at=now();
 if p_request is not null then
   insert into orbita.commerce_requests(id,tenant_id,channel_id,sender,body) values((p_request->>'id')::uuid,m.tenant_id,m.channel_id,m.sender,p_request->>'body');
 end if;
end $$;
create function public.orbita_commerce_skip(p_message_id uuid,p_owner uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform public.orbita_require_lease(p_message_id,p_owner);
 update orbita.messages set delivery='expired',needs_human=true,last_error='CONVERSATION_HELD' where id=p_message_id;
 update orbita.channels set lease_owner=null,lease_until=null where id=(select channel_id from orbita.messages where id=p_message_id);
end $$;
create function public.orbita_commerce_begin_send(p_message_id uuid,p_owner uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare m orbita.messages;
begin
 perform public.orbita_require_lease(p_message_id,p_owner);
 select * into m from orbita.messages where id=p_message_id;
 perform 1 from orbita.channels where id=m.channel_id for update;
 if exists(select 1 from orbita.conversations where channel_id=m.channel_id and sender=m.sender and held) then
  perform public.orbita_commerce_skip(p_message_id,p_owner);return false;
 end if;
 if m.needs_human then
  insert into orbita.conversations(channel_id,sender,held) values(m.channel_id,m.sender,true)
    on conflict(channel_id,sender) do update set held=true;
 end if;
 perform public.orbita_mark_sending(p_message_id,p_owner);return true;
end $$;
create function public.orbita_commerce_list(p_tenant_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,channel_id,sender,body,status,revision,order_id,created_at,updated_at
 from orbita.commerce_requests where tenant_id=p_tenant_id order by created_at desc,id limit 100) r;
$$;
create function public.orbita_commerce_review_claim(p_tenant_id uuid,p_request_id uuid,p_revision integer,p_owner uuid,p_review text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r orbita.commerce_requests;
begin
 select * into r from orbita.commerce_requests where id=p_request_id and tenant_id=p_tenant_id for update;
 if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
 if r.status='confirmed' then return to_jsonb(r); end if;
 if r.status in ('committing','uncertain') then
   if r.status='committing' and r.updated_at>now()-interval '30 seconds' then raise exception 'REVIEW_IN_PROGRESS'; end if;
   -- A repeated review retrieves the original immutable authorization; the
   -- business operation uses the same request reference and fingerprint.
   if r.revision<>p_revision then raise exception 'REVIEW_CONFLICT'; end if;
   update orbita.commerce_requests set status='committing',review_owner=p_owner,updated_at=now() where id=r.id returning * into r;
   return to_jsonb(r);
 end if;
 if r.status<>'pending' or r.revision<>p_revision then raise exception 'REVIEW_CONFLICT'; end if;
 update orbita.commerce_requests set status='committing',revision=revision+1,review_body=p_review,review_owner=p_owner,updated_at=now()
 where id=r.id returning * into r;
 return to_jsonb(r);
end $$;
create function public.orbita_commerce_review_finish(p_tenant_id uuid,p_request_id uuid,p_owner uuid,p_status text,p_order_id text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if p_status not in ('confirmed','uncertain','pending') or (p_status='confirmed' and p_order_id is null) then raise exception 'INVALID_RESULT'; end if;
 update orbita.commerce_requests set status=p_status,order_id=p_order_id,updated_at=now(),
 revision=revision+case when p_status='pending' then 1 else 0 end,
 review_body=case when p_status='pending' then null else review_body end
 where id=p_request_id and tenant_id=p_tenant_id and review_owner=p_owner and status='committing';
 if not found then raise exception 'REVIEW_CONFLICT'; end if;
end $$;
create function public.orbita_commerce_cancel(p_tenant_id uuid,p_request_id uuid,p_revision integer) returns void
language plpgsql security invoker set search_path='' as $$
begin
 update orbita.commerce_requests set status='cancelled',revision=revision+1,updated_at=now()
 where tenant_id=p_tenant_id and id=p_request_id and revision=p_revision and status='pending';
 if not found then raise exception 'REVIEW_CONFLICT'; end if;
end $$;
create function public.orbita_commerce_customer_cancel(p_message_id uuid,p_owner uuid,p_request_id uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 perform public.orbita_require_lease(p_message_id,p_owner);
 update orbita.commerce_requests r set status='cancelled',revision=revision+1,updated_at=now()
 from orbita.messages m where m.id=p_message_id and r.id=p_request_id and r.tenant_id=m.tenant_id
 and r.channel_id=m.channel_id and r.sender=m.sender and r.status='pending';
 return found;
end $$;
create function public.orbita_commerce_conversations(p_tenant_id uuid,p_channel_id uuid,p_sender text default null) returns jsonb
language sql security invoker set search_path='' as $$
 with events as (
 select m.id::text,m.provider_id,m.sender,m.body,m.reply,m.received_at,m.delivery,m.needs_human,ch.phone_number_id,'customer' direction
 from orbita.messages m join orbita.channels ch on ch.id=m.channel_id
 where m.tenant_id=p_tenant_id and m.channel_id=p_channel_id and (p_sender is null or m.sender=p_sender)
 union all
 select 'manual:'||m.provider_id,m.provider_id,m.sender,m.body,null,m.received_at,'manual',false,ch.phone_number_id,'business'
 from orbita.manual_messages m join orbita.channels ch on ch.id=m.channel_id
 where ch.tenant_id=p_tenant_id and m.channel_id=p_channel_id and (p_sender is null or m.sender=p_sender)
 ) select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (
 select e.*,coalesce(c.held,false) held from events e left join orbita.conversations c on c.channel_id=p_channel_id and c.sender=e.sender
 order by e.received_at desc,e.id desc limit 100) r;
$$;
create function public.orbita_commerce_inbox(p_tenant_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (
 select latest.*,coalesce(v.held,false) held from (
  select distinct on(m.channel_id,m.sender) m.id,m.channel_id,m.sender,m.provider_id,m.body,m.needs_human,m.delivery,m.received_at,ch.phone_number_id
  from orbita.messages m join orbita.channels ch on ch.id=m.channel_id where m.tenant_id=p_tenant_id
  order by m.channel_id,m.sender,m.created_at desc,m.id desc
 ) latest left join orbita.conversations v on v.channel_id=latest.channel_id and v.sender=latest.sender
 order by latest.needs_human desc,latest.received_at desc limit 100) r;
$$;
create function public.orbita_commerce_hold(p_tenant_id uuid,p_channel_id uuid,p_sender text,p_held boolean) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from orbita.channels where id=p_channel_id and tenant_id=p_tenant_id for update;
 if p_sender !~ '^h1_[a-f0-9]{64}$' or p_held is null or not exists(select 1 from orbita.channels where id=p_channel_id and tenant_id=p_tenant_id)
 then raise exception 'CHANNEL_NOT_FOUND'; end if;
 insert into orbita.conversations(channel_id,sender,held,resumed_at) values(p_channel_id,p_sender,p_held,case when not p_held then now() end)
 on conflict(channel_id,sender) do update set held=excluded.held,resumed_at=case when not p_held then now() else orbita.conversations.resumed_at end;
 -- Messages accumulated while held are kept for review, never replayed in bulk.
 update orbita.messages set delivery='expired',needs_human=true,last_error='CONVERSATION_HELD'
 where tenant_id=p_tenant_id and channel_id=p_channel_id and sender=p_sender and delivery='pending';
end $$;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'orbita_commerce_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
commit;
