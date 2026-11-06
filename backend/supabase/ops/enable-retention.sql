-- Hosted Supabase only; after stage 1. No application-user credentials.
begin;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('daily-purge-deleted','7 * * * *','select public.daily_purge_deleted();');
commit;
