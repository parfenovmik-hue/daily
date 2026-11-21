-- Private per-owner cache and authenticated server-side quota for product reads.
begin;
create table daily_private.wish_fetch (
 owner_id uuid not null references public.daily_members(user_id) on delete cascade,
 url text not null check(length(url)<=3000),
 card jsonb,
 fetched_at timestamptz,
 primary key(owner_id,url)
);
create table daily_private.wish_quota (
 owner_id uuid primary key references public.daily_members(user_id) on delete cascade,
 day date not null,
 count integer not null check(count>=0)
);
revoke all on daily_private.wish_fetch,daily_private.wish_quota from public,anon,authenticated;
create function public.daily_wish_reserve(p_url text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cached jsonb; used integer; today date:=(now() at time zone 'UTC')::date;
begin
 if uid is null or not exists(select 1 from public.daily_members where user_id=uid and active) then
  raise exception 'Invitation required' using errcode='42501';
 end if;
 if p_url is null or length(p_url)>3000 or p_url !~ '^https://' then raise exception 'Invalid URL'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||':wish',0));
 select card into cached from daily_private.wish_fetch where owner_id=uid and url=p_url and fetched_at>now()-interval '6 hours';
 if cached is not null then return jsonb_build_object('cached',cached,'allowed',true);end if;
 insert into daily_private.wish_quota(owner_id,day,count) values(uid,today,0)
 on conflict(owner_id) do update set day=today,count=case when wish_quota.day=today then wish_quota.count else 0 end;
 select count into used from daily_private.wish_quota where owner_id=uid;
 if used>=20 then return jsonb_build_object('allowed',false);end if;
 update daily_private.wish_quota set count=count+1 where owner_id=uid;
 return jsonb_build_object('allowed',true);
end;
$$;
revoke all on function public.daily_wish_reserve(text) from public,anon,authenticated;
grant execute on function public.daily_wish_reserve(text) to authenticated;
create function public.daily_wish_cache_store(p_owner uuid,p_url text,p_card jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.daily_members where user_id=p_owner and active) or
  p_url is null or p_url !~ '^https://' or length(p_url)>3000 or jsonb_typeof(p_card)<>'object' or length(p_card::text)>12000 then raise exception 'Invalid cache record'; end if;
 delete from daily_private.wish_fetch where fetched_at<now()-interval '2 days';
 insert into daily_private.wish_fetch(owner_id,url,card,fetched_at) values(p_owner,p_url,p_card,now())
 on conflict(owner_id,url) do update set card=excluded.card,fetched_at=excluded.fetched_at;
end;
$$;
revoke all on function public.daily_wish_cache_store(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.daily_wish_cache_store(uuid,text,jsonb) to service_role;
create or replace function public.daily_purge_deleted() returns integer
language plpgsql security definer set search_path='' as $$
declare total integer;
begin
 update public.daily_records set fields=jsonb_build_object('deleted',fields->'deleted'),erased_at=clock_timestamp(),updated_at=clock_timestamp()
 where erased_at is null and retired_at<=clock_timestamp()-interval '48 hours';
 get diagnostics total=row_count;
 delete from daily_private.wish_fetch where fetched_at<now()-interval '2 days';
 delete from daily_private.wish_quota where day<(now() at time zone 'UTC')::date-2;
 return total;
end;
$$;
insert into daily_private.schema_migrations(version) values('202611210002_wishlist_fetch');
commit;
