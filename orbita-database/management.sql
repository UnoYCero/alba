-- Apply only to the dedicated Alba Vision platform database.
begin;
create table orbita.control_audit (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references orbita.tenants(id),
 actor text not null, action text not null, details jsonb not null, created_at timestamptz not null default now()
);
alter table orbita.control_audit enable row level security;
revoke all on orbita.control_audit from public,anon,authenticated;
grant select,insert on orbita.control_audit to service_role;
create function public.orbita_management_summary(p_tenant_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
 with period as (select to_char(now() at time zone 'America/Mexico_City','YYYY-MM') as value),
 usage as (select u.tenant_id,count(*) calls,coalesce(sum(u.input_tokens),0) input_tokens,
  coalesce(sum(u.output_tokens),0) output_tokens,coalesce(sum(u.estimated_usd),0) used,
  count(*) filter(where not u.verified) unverified from orbita.usage u,period p where u.month=p.value group by u.tenant_id)
 select jsonb_build_object('period',(select value from period),'timeZone','America/Mexico_City',
  'costBasis','Estimación del consumo de entrada de Jev; excluye WhatsApp, alojamiento y facturación comercial.',
  'tenants',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'slug',t.slug,'paused',t.paused,
    'monthlyBudgetUsd',t.monthly_budget_usd,'usedUsd',coalesce(u.used,0),
    'remainingUsd',case when t.monthly_budget_usd is null then null else greatest(0,t.monthly_budget_usd-coalesce(u.used,0)) end,
    'calls',coalesce(u.calls,0),'inputTokens',coalesce(u.input_tokens,0),'outputTokens',coalesce(u.output_tokens,0),
    'unverifiedCalls',coalesce(u.unverified,0),
    'agents',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'enabled',c.enabled,'jevEnabled',c.jev_enabled,
      'credentialsReady',c.credentials_ready,'mode',c.mode,'connector',c.connector,'model','jev-1.13.0',
      'allowedSenderCount',case when c.allowed_senders is null then null else cardinality(c.allowed_senders) end,
      'needsAttention',c.last_error is not null,
      'messagesThisMonth',(select count(*) from orbita.messages m where m.channel_id=c.id and
        to_char(m.received_at at time zone 'America/Mexico_City','YYYY-MM')=(select value from period))))
      from orbita.channels c where c.tenant_id=t.id),'[]'::jsonb)) order by t.name)
    from orbita.tenants t left join usage u on u.tenant_id=t.id where p_tenant_id is null or t.id=p_tenant_id),'[]'::jsonb));
$$;
create function public.orbita_management_agent(p_tenant_id uuid,p_channel_id uuid,p_enabled boolean,p_jev_enabled boolean,p_actor text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c orbita.channels;
begin
 select * into c from orbita.channels where id=p_channel_id and tenant_id=p_tenant_id for update;
 if not found then raise exception 'CHANNEL_NOT_FOUND'; end if;
 if p_enabled is null or length(p_actor)>40 or length(p_actor)<1 then raise exception 'INVALID_CONTROL'; end if;
 if p_enabled and not c.credentials_ready then raise exception 'CHANNEL_NOT_READY'; end if;
 update orbita.channels set enabled=p_enabled,jev_enabled=coalesce(p_jev_enabled,jev_enabled) where id=c.id;
 insert into orbita.control_audit(tenant_id,actor,action,details) values(p_tenant_id,p_actor,'agent_state',
  jsonb_build_object('channelId',c.id,'enabled',p_enabled,'jevEnabled',coalesce(p_jev_enabled,c.jev_enabled)));
 return public.orbita_management_summary(p_tenant_id);
end $$;
create function public.orbita_management_tenant(p_tenant_id uuid,p_budget numeric,p_paused boolean,p_actor text) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if p_budget<0 or p_budget>1000000 or p_budget::text in ('NaN','Infinity','-Infinity') or p_paused is null or length(p_actor)>40 or length(p_actor)<1 then raise exception 'INVALID_CONTROL'; end if;
 update orbita.tenants set monthly_budget_usd=p_budget,paused=p_paused where id=p_tenant_id;
 if not found then raise exception 'TENANT_NOT_FOUND'; end if;
 insert into orbita.control_audit(tenant_id,actor,action,details) values(p_tenant_id,p_actor,'tenant_limits',jsonb_build_object('budgetUsd',p_budget,'paused',p_paused));
 return public.orbita_management_summary(p_tenant_id);
end $$;
-- Recheck controls for a job already leased before it sends a reply.
create or replace function public.orbita_commerce_begin_send(p_message_id uuid,p_owner uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare m orbita.messages; c orbita.channels; t orbita.tenants;
begin
 perform public.orbita_require_lease(p_message_id,p_owner);
 select * into m from orbita.messages where id=p_message_id;
 select * into c from orbita.channels where id=m.channel_id for update;
 select * into t from orbita.tenants where id=m.tenant_id for update;
 if not c.enabled or not c.credentials_ready or t.paused then
  update orbita.channels set lease_owner=null,lease_until=null where id=c.id and lease_owner=p_owner;
  return false;
 end if;
 if exists(select 1 from orbita.conversations where channel_id=m.channel_id and sender=m.sender and held) then
  perform public.orbita_commerce_skip(p_message_id,p_owner);return false;
 end if;
 if m.needs_human then
  insert into orbita.conversations(channel_id,sender,held) values(m.channel_id,m.sender,true)
   on conflict(channel_id,sender) do update set held=true;
 end if;
 perform public.orbita_mark_sending(p_message_id,p_owner);return true;
end $$;
revoke all on function public.orbita_management_summary(uuid),public.orbita_management_agent(uuid,uuid,boolean,boolean,text),public.orbita_management_tenant(uuid,numeric,boolean,text) from public,anon,authenticated;
grant execute on function public.orbita_management_summary(uuid),public.orbita_management_agent(uuid,uuid,boolean,boolean,text),public.orbita_management_tenant(uuid,numeric,boolean,text) to service_role;
commit;
