-- An optional task state, preserving read compatibility with earlier clients.
begin;
create or replace function daily_private.valid_record(r jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare k text; item record; cell jsonb; v jsonb; t text; n numeric; allowed text[];
begin
 if jsonb_typeof(r) <> 'object' or not (r ?& array['id','kind','fields']) then return false; end if;
 if jsonb_typeof(r->'id') <> 'string' or jsonb_typeof(r->'kind') <> 'string' or jsonb_typeof(r->'fields') <> 'object' then return false; end if;
 k := r->>'kind';
 if (r->>'id') !~ ('^' || k || '_[a-zA-Z0-9_-]{1,90}$') or length(r::text)>120000 then return false; end if;
 allowed := case k
 when 'day' then array['date','title','projectId']
 when 'task' then array['inProgress','flag','order','title','projectId','goalId','date','time','important','done','completedAt','completedDate']
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
  if item.key = any(array['deleted','important','inProgress','done','closed','estimated']) then
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


create function daily_private.without_task_progress(result jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_set(result,'{records}',(
  select coalesce(jsonb_agg(jsonb_set(r,'{fields}',(r->'fields')-'inProgress')),'[]')
  from jsonb_array_elements(result->'records') r
 ));
$$;
revoke all on function daily_private.without_task_progress(jsonb) from public,anon,authenticated;
create function public.daily_sync_v3(changes jsonb default '[]') returns jsonb
language sql security definer set search_path='' as $$
 select daily_private.daily_sync_all(changes);
$$;
revoke all on function public.daily_sync_v3(jsonb) from public,anon,authenticated;
grant execute on function public.daily_sync_v3(jsonb) to authenticated;
create or replace function public.daily_sync_v2(changes jsonb default '[]') returns jsonb
language sql security definer set search_path='' as $$
 select daily_private.without_task_progress(daily_private.daily_sync_all(changes));
$$;
create or replace function public.daily_sync(changes jsonb default '[]') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.daily_sync_v2(changes);
 result:=jsonb_set(result,'{records}',(select coalesce(jsonb_agg(r),'[]') from jsonb_array_elements(result->'records') r where r->>'kind'<>'day'));
 return jsonb_set(result,'{purged}',(select coalesce(jsonb_agg(r),'[]') from jsonb_array_elements(result->'purged') r where r#>>'{}' not like 'day_%'));
end;
$$;
create or replace function public.daily_legacy_sync_v2(p_owner uuid,p_changes jsonb default '[]') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; old_sub text:=current_setting('request.jwt.claim.sub',true);
begin
 if not exists(select 1 from daily_private.legacy_links where owner_id=p_owner) then raise exception 'Legacy account not linked'; end if;
 perform set_config('request.jwt.claim.sub',p_owner::text,true);
 result:=public.daily_sync_v2(p_changes);
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 return result;
end;
$$;
create function public.daily_legacy_sync_v3(p_owner uuid,p_changes jsonb default '[]') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; old_sub text:=current_setting('request.jwt.claim.sub',true);
begin
 if not exists(select 1 from daily_private.legacy_links where owner_id=p_owner) then raise exception 'Legacy account not linked'; end if;
 perform set_config('request.jwt.claim.sub',p_owner::text,true);
 result:=public.daily_sync_v3(p_changes);
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 return result;
end;
$$;
revoke all on function public.daily_legacy_sync_v3(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.daily_legacy_sync_v3(uuid,jsonb) to service_role;
insert into daily_private.schema_migrations(version) values('202611210003_task_in_progress');
commit;
