-- Only the dedicated Orbita platform. No client database changes.
-- Prices checked 2026-10-31: https://developers.openai.com/api/docs/models/gpt-4.1-mini
begin;
create or replace function public.orbita_reserve_openai_usage(p_message_id uuid,p_owner uuid,p_input_tokens bigint,p_output_tokens bigint) returns boolean
language plpgsql security invoker set search_path='' as $$
declare m orbita.messages; t orbita.tenants; global_limit numeric; tenant_used numeric; total_used numeric; amount numeric; period text;
begin
 perform public.orbita_require_lease(p_message_id,p_owner);
 select monthly_budget_usd into global_limit from orbita.settings where id=1 for update;
 select * into m from orbita.messages where id=p_message_id;
 select * into t from orbita.tenants where id=m.tenant_id for update;
 if p_input_tokens is null or p_output_tokens is null or p_input_tokens<1 or p_input_tokens>20000 or p_output_tokens<1 or p_output_tokens>512 or t.paused
  or exists(select 1 from orbita.usage where message_id=m.id) then return false; end if;
 period:=to_char(now() at time zone 'America/Mexico_City','YYYY-MM');
 amount:=ceil((p_input_tokens*0.40+p_output_tokens*1.60)/1000000*100000000)/100000000;
 select coalesce(sum(estimated_usd),0) into tenant_used from orbita.usage where tenant_id=t.id and month=period;
 select coalesce(sum(estimated_usd),0) into total_used from orbita.usage where month=period;
 if (t.monthly_budget_usd is not null and tenant_used+amount>t.monthly_budget_usd) or (global_limit is not null and total_used+amount>global_limit) then return false; end if;
 insert into orbita.usage(message_id,tenant_id,month,model,estimated_usd) values(m.id,t.id,period,'gpt-4.1-mini-2025-04-14',amount);
 return true;
end $$;
create or replace function public.orbita_save_decision(p_message_id uuid,p_owner uuid,p_decision jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare u orbita.usage; input_count bigint; output_count bigint;
begin
 perform public.orbita_require_lease(p_message_id,p_owner);
 -- A saved decision cannot be replaced or charged again by a retry.
 update orbita.messages set decision=p_decision where id=p_message_id and decision is null;
 if not found then return; end if;
 select * into u from orbita.usage where message_id=p_message_id for update;
 if not found or p_decision->'usage' is null then return; end if;
 input_count:=(p_decision->'usage'->>'inputTokens')::bigint;
 output_count:=(p_decision->'usage'->>'outputTokens')::bigint;
 if input_count is null or output_count is null or input_count<0 or output_count<0 then raise exception 'AI_USAGE_INVALID'; end if;
 if u.model='gpt-4.1-mini-2025-04-14' then
  if p_decision->>'model' is distinct from u.model or p_decision->>'provider' is distinct from 'openai' then raise exception 'AI_MODEL_MISMATCH'; end if;
  update orbita.usage set input_tokens=input_count,output_tokens=output_count,
   estimated_usd=ceil((input_count*0.40+output_count*1.60)/1000000*100000000)/100000000,verified=true where message_id=p_message_id;
 else
  update orbita.usage usage set input_tokens=input_count,output_tokens=output_count,
   estimated_usd=ceil(input_count*t.input_usd_per_million/1000000*100000000)/100000000,verified=true
   from orbita.tenants t where usage.message_id=p_message_id and t.id=usage.tenant_id;
 end if;
end $$;
revoke all on function public.orbita_reserve_openai_usage(uuid,uuid,bigint,bigint) from public,anon,authenticated;
grant execute on function public.orbita_reserve_openai_usage(uuid,uuid,bigint,bigint) to service_role;
-- Existing save_decision grants are preserved by CREATE OR REPLACE.
commit;
