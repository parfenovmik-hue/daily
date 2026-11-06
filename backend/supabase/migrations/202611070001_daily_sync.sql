-- Stage 1. Does not import GAS records or switch any client.
begin;
create schema if not exists daily_private;
revoke all on schema daily_private from public, anon, authenticated;
create table daily_private.schema_migrations(version text primary key, applied_at timestamptz not null default now());

create table public.daily_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (length(display_name) between 1 and 100),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.daily_members enable row level security;
revoke all on public.daily_members from public, anon, authenticated;
grant select on public.daily_members to authenticated;
create policy daily_members_self on public.daily_members for select to authenticated
 using (user_id = (select auth.uid()));

create table public.daily_records (
 owner_id uuid not null references public.daily_members(user_id) on delete cascade,
 id text not null,
 kind text not null check (kind in ('task','project','goal','shopping','wish')),
 fields jsonb not null check (jsonb_typeof(fields) = 'object'),
 retired_at timestamptz,
 erased_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key (owner_id, id),
 check (id ~ ('^' || kind || '_[a-zA-Z0-9_-]{1,90}$'))
);
alter table public.daily_records enable row level security;
revoke all on public.daily_records from public, anon, authenticated;
grant select on public.daily_records to authenticated;
create policy daily_records_self on public.daily_records for select to authenticated
 using (owner_id = (select auth.uid()) and exists
 (select 1 from public.daily_members m where m.user_id = (select auth.uid()) and m.active));
create index daily_records_retention on public.daily_records(retired_at)
 where retired_at is not null and erased_at is null;

create function daily_private.valid_record(r jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare k text; item record; cell jsonb; v jsonb; t text; n numeric; allowed text[];
begin
 if jsonb_typeof(r) <> 'object' or not (r ?& array['id','kind','fields']) then return false; end if;
 if jsonb_typeof(r->'id') <> 'string' or jsonb_typeof(r->'kind') <> 'string' or jsonb_typeof(r->'fields') <> 'object' then return false; end if;
 k := r->>'kind';
 if (r->>'id') !~ ('^' || k || '_[a-zA-Z0-9_-]{1,90}$') or length(r::text)>120000 then return false; end if;
 allowed := case k
 when 'task' then array['flag','order','title','projectId','goalId','date','time','important','done','completedAt','completedDate']
 when 'project' then array['order','title','info','symbol','color']
 when 'goal' then array['order','date','title','projectId','closed','closedAt','closedDate']
 when 'shopping' then array['title','category','done','completedAt']
 when 'wish' then array['notes','title','productTitle','url','image','price','currency','extra','estimated','done','completedAt','status']
 else null end;
 if allowed is null or (select count(*) from jsonb_object_keys(r->'fields'))>24 then return false; end if;
 allowed := allowed || array['createdAt','deleted'];
 for item in select * from jsonb_each(r->'fields') loop
  if not (item.key = any(allowed)) then return false; end if;
  cell := item.value;
  if jsonb_typeof(cell)<>'object' or not(cell ?& array['clock','actor','value']) then return false; end if;
  if jsonb_typeof(cell->'clock')<>'number' or jsonb_typeof(cell->'actor')<>'string' then return false; end if;
  n := (cell->>'clock')::numeric;
  if n<0 or n>9007199254740991 or trunc(n)<>n or (cell->>'actor') !~ '^[a-zA-Z0-9_-]{1,80}$' then return false; end if;
  v := cell->'value'; t := cell->>'value';
  if item.key = any(array['deleted','important','done','closed','estimated']) then
   if jsonb_typeof(v)<>'boolean' then return false; end if;
  elsif item.key = any(array['createdAt','completedAt','closedAt','price','extra','order']) then
   if jsonb_typeof(v)<>'number' or t::numeric<0 then return false; end if;
  else
   if jsonb_typeof(v)<>'string' or length(t)>(case when item.key='info' then 50000 when item.key in ('title','notes') then 12000 else 3000 end) then return false; end if;
  end if;
  if item.key in ('date','completedDate','closedDate') and t<>'' then
   if t !~ '^\d{4}-\d{2}-\d{2}$' or to_char(t::date,'YYYY-MM-DD')<>t then return false; end if;
  end if;
  if item.key='time' and t<>'' and t !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return false; end if;
  if item.key='flag' and t not in ('','diamond','star','flagmark') then return false; end if;
  if item.key in ('url','image') and t<>'' and t !~ '^https://[^\s/@?#:]+(:[0-9]{1,5})?([/?#][^\s]*)?$' then return false; end if;
 end loop;
 return true;
exception when others then return false;
end;
$$;
revoke all on function daily_private.valid_record(jsonb) from public, anon, authenticated;

create function daily_private.merge_fields(a jsonb, b jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare result jsonb := a; item record; old jsonb;
begin
 for item in select * from jsonb_each(b) loop
  old := result->item.key;
  if old is null or (item.value->>'clock')::numeric>(old->>'clock')::numeric or
   ((item.value->>'clock')::numeric=(old->>'clock')::numeric and (item.value->>'actor') collate "C" > (old->>'actor') collate "C") then
   result := jsonb_set(result,array[item.key],item.value);
  end if;
 end loop;
 return result;
end;
$$;
revoke all on function daily_private.merge_fields(jsonb,jsonb) from public, anon, authenticated;

create function public.daily_sync(changes jsonb default '[]'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); member public.daily_members%rowtype;
 incoming jsonb; prior public.daily_records%rowtype; merged jsonb;
 accepted jsonb := '[]'::jsonb; records jsonb; purged jsonb; stamp timestamptz := clock_timestamp();
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into member from public.daily_members where user_id=uid and active;
 if not found then raise exception 'Invitation required' using errcode='42501'; end if;
 if changes is null or jsonb_typeof(changes)<>'array' then raise exception 'Invalid changes'; end if;
 if jsonb_array_length(changes)>100 then raise exception 'Batch too large'; end if;
 for incoming in select * from jsonb_array_elements(changes) loop
  if not daily_private.valid_record(incoming) then raise exception 'Invalid record'; end if;
 end loop;
 -- Serialize all writers for this owner, including concurrent devices.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 -- Expire before merging so an old client cannot revive an elapsed tombstone.
 update public.daily_records set fields=jsonb_build_object('deleted',fields->'deleted'),erased_at=stamp,updated_at=stamp
 where owner_id=uid and erased_at is null and retired_at<=stamp-interval '48 hours';
 for incoming in select * from jsonb_array_elements(changes) loop
  select * into prior from public.daily_records where owner_id=uid and id=incoming->>'id' for update;
  if found then
   if prior.kind<>incoming->>'kind' then raise exception 'Record kind conflict'; end if;
   accepted := accepted || jsonb_build_array(incoming->>'id');
   if prior.erased_at is not null then continue; end if;
   merged := daily_private.merge_fields(prior.fields,incoming->'fields');
   update public.daily_records set fields=merged,updated_at=stamp,
    retired_at=case when coalesce((merged->'deleted'->>'value')::boolean,false) then coalesce(prior.retired_at,stamp) else null end
   where owner_id=uid and id=incoming->>'id';
  else
   accepted := accepted || jsonb_build_array(incoming->>'id');
   insert into public.daily_records(owner_id,id,kind,fields,retired_at)
   values(uid,incoming->>'id',incoming->>'kind',incoming->'fields',
    case when coalesce((incoming->'fields'->'deleted'->>'value')::boolean,false) then stamp else null end);
  end if;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'fields',fields) order by id),'[]'::jsonb)
 into records from public.daily_records where owner_id=uid and erased_at is null;
 select coalesce(jsonb_agg(id order by id),'[]'::jsonb) into purged from public.daily_records where owner_id=uid and erased_at is not null;
 return jsonb_build_object('ok',true,'protocol',1,'user',jsonb_build_object('id',uid,'name',member.display_name),
  'records',records,'accepted',accepted,'purged',purged);
end;
$$;
revoke all on function public.daily_sync(jsonb) from public, anon, authenticated;
grant execute on function public.daily_sync(jsonb) to authenticated;

-- Service-only retention entry point; scheduling is a separate deployment step.
create function public.daily_purge_deleted() returns integer
language plpgsql security definer set search_path = '' as $$
declare total integer;
begin
 update public.daily_records set fields=jsonb_build_object('deleted',fields->'deleted'),erased_at=clock_timestamp(),updated_at=clock_timestamp()
 where erased_at is null and retired_at<=clock_timestamp()-interval '48 hours';
 get diagnostics total = row_count;return total;
end;
$$;
revoke all on function public.daily_purge_deleted() from public, anon, authenticated;
grant execute on function public.daily_purge_deleted() to service_role;
insert into daily_private.schema_migrations(version) values ('202611070001_daily_sync');
commit;
