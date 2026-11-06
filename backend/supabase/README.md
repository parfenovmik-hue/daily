# Daily: Supabase migration stage 1

Target project supplied by owner: xvowdgupwymfukhuzkqm.
Stage 1 and private image storage were applied to the confirmed project on 2026-11-07.
Existing GitHub Pages frontend, GAS/Sheets and device stores remain authoritative.
No existing Daily records have been imported. No credentials belong in Git.

## Local verification

```sh
npm --prefix backend/supabase ci --ignore-scripts
npm --prefix backend/supabase test
```

PGlite runs a local PostgreSQL engine with synthetic auth roles/users. It tests
actual SQL and RLS, atomic rejection, field-clock merge and irreversible 48h
retention. This is not a substitute for Supabase hosted auth/PostgREST/Storage QA.
Frontend remains dependency-free; PGlite is a development-only backend dependency.

## Planned schema

- daily_members: administrator-approved account mapping, active flag, display name.
  Login alone does not give access. Membership cannot be self-created via API.
- daily_records: original IDs/kinds/Lamport fields, owner UUID from Supabase Auth,
  server deletion timestamps. RLS denies access to other users and inactive members.
- daily_sync(changes): authenticated/member-only RPC; no owner ID parameter;
  all-or-nothing batches <=100. Transaction advisory lock serializes one owner's
  writes. JS actor tie-break is preserved with PostgreSQL C collation.
- daily_purge_deleted(): service-role-only entry point for scheduled cleanup;
  hourly scheduling was enabled at minute 7 via ops/enable-retention.sql. Sync also expires that owner's old tombstones.

Do not expose a service-role key/PAT to frontend or the browser reader. Browser
reader deployment is separate. Private daily-images storage is configured (5 MiB, JPEG/PNG/WebP/AVIF, per-owner path policies).
AI jobs and Wishlist content schema follow separately; no public bucket was created.

## Before applying to the hosted project

1. Authenticate CLI and confirm the exact target project/organization. Inspect
   tables/functions/auth configuration. Backup existing target state; if it is
   not empty, stop and prepare an additive migration instead of overwriting.
2. Configure invite-only authentication and the exact Pages callback URL:
   https://parfenovmik-hue.github.io/daily/ . No new domain is planned.
   Owner dashboard GitHub login is unrelated to application-user login.
3. Apply this transaction only to the confirmed project and record its hash and
   successful result. Do not replay it without an applied-migration check.
4. Verify grants/RLS/RPC on hosted Supabase; keep tests isolated from real data.
5. Add owner/Kate only after email/auth-ID identity mapping is confirmed. Do not
   invite or send email automatically just because names are known.

## Data cutover: not executed

- Full private GAS backup for each user; include erased-ID markers, not just the
  visible records. Export device-only dirty records before switching providers.
- Keep existing local account UUID/IndexedDB and all IDs, clocks, actors, manual
  ordering and deletion deadlines. Map GAS identity to verified Supabase identity.
- Build an import plan and compare IDs, counts and canonical field hashes before
  applying. Preserve retiredAt/erasedAt, preventing resurrection of purged records.
- Implement provider selection without merging two different user identities.
  Test offline edits, conflicts, retry-after-timeout, account switch and logout.
- During cutover use one authoritative backend. Do not leave independent writes
  to GAS and Supabase active indefinitely. Decide a brief freeze or a verified
  one-way bridge so older devices cannot silently write to the abandoned backend.
- Publish frontend only after staging verification. Keep GAS backup/rollback;
  after new writes exist in Supabase, rollback requires reverse export/merge,
  not simply changing the endpoint.

## Access status

Official CLI 3.0.0 installed in npm cache. Browser authorization was initiated;
completed with the owner's verification code. Original config, preflight and
verification evidence are in ignored private/supabase-admin. No credentials are
committed. Signup is disabled, email provider remains enabled; site URL and exact
redirect are the existing GitHub Pages URL. Only the requested owner Auth user
and membership were created, without email confirmation or sending any message.
Kate has not been provisioned/migrated. Application login and cutover are pending.

## Owner cutover - Daily 1.9.0
Migration 202611070003_legacy_bridge applied; GAS updated at the existing URL to
version16. Owner snapshot exported/imported under ScriptLock, then a server-only
Supabase route activated. Verified116 live records and21 erased markers;137
source IDs preserved, all non-erased field versions dominate the snapshot.
Old clients keep their legacy identity and now sync to the same Supabase owner.
Google owner sheet is a frozen rollback snapshot, not a second writable master.
Kate remains on GAS with no link/provisioning. Service-role key only in Script
Properties, never frontend. Temporary owner-only setup/export actions require
the existing owner's key. Retire them and the bridge after all devices move.

Frontend uses official SDK2.119.0 bundled locally via esbuild0.28.2 (no CDN).
Email/password login; invite/recovery callbacks establish a session, remove URL
tokens and open password setup. Explicit profile confirmation, local backup and
legacy hello identity proof prevent mixing different users' device records.
Dirty edits and purged IDs survive the switch; Supabase RPC uses a captured
access token so another tab cannot redirect an in-flight write to another user.

Hosted free tier rejected changing email templates with default SMTP (HTTP400).
No paid upgrade, custom SMTP or new domain configured. Proposed OTP template
was not deployed; login uses email/password and standard recovery/invite email.
Owner explicitly requested one invitation, accepted by Supabase; no other
messages sent by the agent. Password chosen by owner only.

QA: npm test; npm --prefix backend/supabase test; local browser fixture
web/tests/browser/supabase-auth.mjs (preview8812, browser-loader deps installed).
All external API calls in that fixture are intercepted; no real auth/data/emails.
Real owner password login and standalone iPhone flow need owner confirmation.
Rollback frontend is compatible with GAS16 bridge; do not roll backend back to
Sheets writes after new Supabase edits without an explicit reverse-data merge.
