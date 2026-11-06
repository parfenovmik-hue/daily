-- Temporary backend-only bridge for authenticated older GAS clients.
begin;
create table daily_private.legacy_links (
 legacy_id text primary key check(legacy_id ~ '^[a-f0-9]{32}$'),
 owner_id uuid unique not null references public.daily_members(user_id),
 imported_at timestamptz not null default now()
);
create function public.daily_legacy_sync(p_owner uuid,p_changes jsonb default '[]') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; old_sub text:=current_setting('request.jwt.claim.sub',true);
begin
 if not exists(select 1 from daily_private.legacy_links where owner_id=p_owner) then raise exception 'Legacy account not linked'; end if;
 perform set_config('request.jwt.claim.sub',p_owner::text,true);
 result:=public.daily_sync(p_changes);
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 return result;
end;
$$;
revoke all on function public.daily_legacy_sync(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.daily_legacy_sync(uuid,jsonb) to service_role;

create function public.daily_import_legacy(p_owner uuid,p_legacy_id text,p_records jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; prior public.daily_records%rowtype; merged jsonb; retired timestamptz; erased timestamptz; result jsonb;
begin
 if not exists(select 1 from public.daily_members where user_id=p_owner and active) then raise exception 'Approved owner required'; end if;
 if p_legacy_id is null or p_legacy_id !~ '^[a-f0-9]{32}$' or jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)>5000 then raise exception 'Invalid import'; end if;
 for r in select * from jsonb_array_elements(p_records) loop
  if not daily_private.valid_record(r) then raise exception 'Invalid legacy record'; end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 insert into daily_private.legacy_links(legacy_id,owner_id) values(p_legacy_id,p_owner)
 on conflict(legacy_id) do update set legacy_id=excluded.legacy_id where legacy_links.owner_id=excluded.owner_id;
 if not found then raise exception 'Legacy identity conflict'; end if;
 for r in select * from jsonb_array_elements(p_records) loop
  retired:=case when r ? 'retiredAt' then to_timestamp((r->>'retiredAt')::numeric/1000) else null end;
  erased:=case when r ? 'erasedAt' then to_timestamp((r->>'erasedAt')::numeric/1000) else null end;
  select * into prior from public.daily_records where owner_id=p_owner and id=r->>'id' for update;
  if found then
   if prior.kind<>r->>'kind' then raise exception 'Kind conflict'; end if;
   if prior.erased_at is not null then continue; end if;
   merged:=daily_private.merge_fields(prior.fields,r->'fields');
   retired:=case when coalesce((merged->'deleted'->>'value')::boolean,false) then coalesce(prior.retired_at,retired,now()) else null end;
   update public.daily_records set fields=case when erased is not null then jsonb_build_object('deleted',r->'fields'->'deleted') else merged end,
    retired_at=retired,erased_at=erased,updated_at=now() where owner_id=p_owner and id=r->>'id';
  else
   insert into public.daily_records(owner_id,id,kind,fields,retired_at,erased_at)
   values(p_owner,r->>'id',r->>'kind',case when erased is not null then jsonb_build_object('deleted',r->'fields'->'deleted') else r->'fields' end,
    case when coalesce((r->'fields'->'deleted'->>'value')::boolean,false) then coalesce(retired,now()) else null end,erased);
  end if;
 end loop;
 result:=public.daily_legacy_sync(p_owner,'[]');
 return result || jsonb_build_object('legacyId',p_legacy_id);
end;
$$;
revoke all on function public.daily_import_legacy(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.daily_import_legacy(uuid,text,jsonb) to service_role;
insert into daily_private.schema_migrations(version) values('202611070003_legacy_bridge');
commit;
