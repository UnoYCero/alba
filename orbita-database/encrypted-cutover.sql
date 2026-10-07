-- Dedicated Alba Vision / Orbita project only. No plaintext phone/message payloads.
begin;
alter table orbita.messages add constraint orbita_message_phone_index check(sender ~ '^h1_[a-f0-9]{64}$');
alter table orbita.messages add constraint orbita_message_payload check(customer_name='' and media_id is null and coalesce((body::jsonb->>'version')='1' and jsonb_typeof(body::jsonb->'ciphertext')='string' and jsonb_typeof(body::jsonb->'iv')='string',false));
alter table orbita.messages add constraint orbita_reply_payload check(reply is null or coalesce((reply::jsonb->>'version')='1' and jsonb_typeof(reply::jsonb->'ciphertext')='string' and jsonb_typeof(reply::jsonb->'iv')='string',false));
alter table orbita.receipts add constraint orbita_receipt_phone_index check(sender ~ '^h1_[a-f0-9]{64}$');
alter table orbita.cases add constraint orbita_case_phone_index check(sender ~ '^h1_[a-f0-9]{64}$');
alter table orbita.cases add constraint orbita_quote_payload check(coalesce((quote->>'version')='1' and jsonb_typeof(quote->'ciphertext')='string' and jsonb_typeof(quote->'iv')='string',false));
alter table orbita.cases add constraint orbita_submission_payload check(submission is null or coalesce((submission->>'version')='1' and jsonb_typeof(submission->'ciphertext')='string' and jsonb_typeof(submission->'iv')='string',false));
create index orbita_messages_customer on orbita.messages(channel_id,sender,received_at desc);

create or replace function public.orbita_prepare_reply(p_message_id uuid,p_owner uuid,p_reply text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  perform public.orbita_require_lease(p_message_id,p_owner);
  if length(p_reply)<1 or length(p_reply)>32768 then raise exception 'INVALID_REPLY'; end if;
  update orbita.messages set reply=p_reply where id=p_message_id and delivery='pending';
end $$;

create table orbita.migration_control(id integer primary key check(id=1),snapshot_digest text,counts jsonb,imported_at timestamptz);
insert into orbita.migration_control(id) values(1);
alter table orbita.migration_control enable row level security;
grant select,insert,update on orbita.migration_control to service_role;

create function public.orbita_import_snapshot(p_snapshot jsonb,p_digest text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare previous text; summary jsonb; part text;
begin
  if p_snapshot->>'version'<>'1' or p_digest !~ '^[a-f0-9]{64}$' then raise exception 'SNAPSHOT_INVALID'; end if;
  foreach part in array array['tenants','channels','messages','receipts','cases','usage'] loop
    if jsonb_typeof(p_snapshot->part) is distinct from 'array' then raise exception 'SNAPSHOT_INVALID'; end if;
  end loop;
  select snapshot_digest,counts into previous,summary from orbita.migration_control where id=1 for update;
  if previous is not null then
    if previous=p_digest then return jsonb_build_object('reused',true,'counts',summary); end if;
    raise exception 'SNAPSHOT_ALREADY_IMPORTED';
  end if;
  lock table orbita.tenants,orbita.channels,orbita.messages,orbita.receipts,orbita.cases,orbita.usage in exclusive mode;
  if exists(select 1 from orbita.tenants) or exists(select 1 from orbita.channels) or exists(select 1 from orbita.messages)
    or exists(select 1 from orbita.receipts) or exists(select 1 from orbita.cases) or exists(select 1 from orbita.usage) then raise exception 'DESTINATION_NOT_EMPTY'; end if;
  insert into orbita.tenants(id,slug,name,paused,monthly_budget_usd,input_usd_per_million)
    select id,slug,name,paused,monthly_budget_usd,input_usd_per_million from jsonb_to_recordset(p_snapshot->'tenants')
      as x(id uuid,slug text,name text,paused boolean,monthly_budget_usd numeric,input_usd_per_million numeric);
  insert into orbita.channels(id,tenant_id,app_id,waba_id,phone_number_id,connector,credentials,mode,allowed_senders,enabled,credentials_ready,jev_enabled,credential_revision,last_error)
    select id,tenant_id,app_id,waba_id,phone_number_id,connector,credentials,mode,allowed_senders,enabled,credentials_ready,jev_enabled,credential_revision,last_error
      from jsonb_to_recordset(p_snapshot->'channels') as x(id uuid,tenant_id uuid,app_id text,waba_id text,phone_number_id text,connector text,
        credentials text,mode text,allowed_senders text[],enabled boolean,credentials_ready boolean,jev_enabled boolean,credential_revision integer,last_error text);
  insert into orbita.messages(id,tenant_id,channel_id,provider_id,sender,customer_name,body,media_id,message_type,received_at,created_at,decision,reply,needs_human,delivery,outbound_id,attempts,next_attempt_at,last_error)
    select id,tenant_id,channel_id,provider_id,sender,customer_name,body,media_id,message_type,received_at,created_at,decision,reply,needs_human,delivery,outbound_id,attempts,next_attempt_at,last_error
      from jsonb_to_recordset(p_snapshot->'messages') as x(id uuid,tenant_id uuid,channel_id uuid,provider_id text,sender text,customer_name text,body text,
        media_id text,message_type text,received_at timestamptz,created_at timestamptz,decision jsonb,reply text,needs_human boolean,delivery text,outbound_id text,
        attempts integer,next_attempt_at timestamptz,last_error text);
  insert into orbita.receipts(channel_id,provider_id,sender,status,error_code,received_at)
    select channel_id,provider_id,sender,status,error_code,received_at from jsonb_to_recordset(p_snapshot->'receipts')
      as x(channel_id uuid,provider_id text,sender text,status text,error_code integer,received_at timestamptz);
  insert into orbita.cases(id,tenant_id,channel_id,sender,source_message_id,quote,submission)
    select id,tenant_id,channel_id,sender,source_message_id,quote,submission from jsonb_to_recordset(p_snapshot->'cases')
      as x(id uuid,tenant_id uuid,channel_id uuid,sender text,source_message_id uuid,quote jsonb,submission jsonb);
  insert into orbita.usage(message_id,tenant_id,month,model,input_tokens,output_tokens,estimated_usd,verified)
    select message_id,tenant_id,month,model,input_tokens,output_tokens,estimated_usd,verified from jsonb_to_recordset(p_snapshot->'usage')
      as x(message_id uuid,tenant_id uuid,month text,model text,input_tokens bigint,output_tokens bigint,estimated_usd numeric,verified boolean);
  if exists(select 1 from orbita.messages m join orbita.channels c on c.id=m.channel_id where m.tenant_id<>c.tenant_id or m.delivery='sending')
    or exists(select 1 from orbita.cases c join orbita.messages m on m.id=c.source_message_id where c.tenant_id<>m.tenant_id or c.channel_id<>m.channel_id or c.sender<>m.sender)
    or exists(select 1 from orbita.usage u join orbita.messages m on m.id=u.message_id where u.tenant_id<>m.tenant_id) then raise exception 'SNAPSHOT_OWNERSHIP_INVALID'; end if;
  select jsonb_build_object('tenants',(select count(*) from orbita.tenants),'channels',(select count(*) from orbita.channels),
    'messages',(select count(*) from orbita.messages),'receipts',(select count(*) from orbita.receipts),'cases',(select count(*) from orbita.cases),
    'usage',(select count(*) from orbita.usage)) into summary;
  update orbita.migration_control set snapshot_digest=p_digest,counts=summary,imported_at=now() where id=1;
  return jsonb_build_object('reused',false,'counts',summary);
end $$;
revoke all on function public.orbita_import_snapshot(jsonb,text) from public,anon,authenticated;
grant execute on function public.orbita_import_snapshot(jsonb,text) to service_role;
commit;
