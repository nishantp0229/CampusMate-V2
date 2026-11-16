# Market and Anonymous security review

This is a local code review, not proof of the state of any Supabase project.
No SQL was executed and no database was contacted. Do not install or deploy
until the owner approves and the tests below can be run in an isolated project.
No standalone Antigravity report was found in the workspace; the report claims
supplied in the request were checked against the local files instead.

## Execution order for the reviewed corrections

No installation or data cleanup has been authorized or performed. First obtain
approval for an **isolated test project**, a backup and a maintenance window.
Confirm the reviewed CampusAnonymous base, Market base and Market completion
migrations are already installed and compatible, including Phase A
`public.is_admin()` / `public.admin_users`, private Storage, and RLS. This has
**not** been verified. If a prerequisite is absent or different, stop and
prepare a separate installation plan; do not rerun existing migrations.

After approval and prerequisite verification, run the following files **once
each**, in this order, using the Supabase SQL Editor:

1. `database/migration_anonymous_active_participants.sql`
2. `database/migration_campus_market_image_privacy.sql`
3. `database/migration_anonymous_message_retention.sql`
4. `database/migration_anonymous_signal_expiry.sql`

Each file uses a transaction and stops on a preflight/collision error. Do not
drop or overwrite conflicting objects to force installation. The first script
stops if any student is already in more than one active room; resolving those
rooms is a separate, explicitly approved operation. It renames the existing
matchmaking implementation and installs a serialized wrapper with the original
RPC name/signature in the same transaction. It stops if the legacy matchmaking
or leave functions, other detected room-inserting functions, or dependencies
on the old matchmaking function are present; dynamic SQL and privileged
entry points still require a manual audit.

The fourth script requires an existing, operational **in-database `pg_cron`
extension** and a login role with permission to schedule and inspect jobs. It
does not install an extension or external service. It registers a job that
immediately starts expiring signaling state and ending rooms over two hours
old, so obtain explicit approval for those automatic changes before applying
it. If `pg_cron` is missing or cannot be used without paid infrastructure, stop
and agree on another free in-database mechanism; do not silently install
without cleanup.

The retention script creates a disabled configuration. **Do not enable or
invoke cleanup without separate approval to delete expired messages.** The
proposed values are 30 days after room end and 90 days after the last report
resolution, not legal advice. Once policy and deletion are expressly approved,
a privileged operator can set the values and enable cleanup:

```sql
UPDATE public.anonymous_retention_config
SET unreported_days = 30, resolved_days = 90, cleanup_enabled = true
WHERE singleton IS TRUE;
```

After that separate approval, invoke
`anonymous_admin_cleanup_messages(p_batch_size)` using an **authenticated
administrator's** Supabase session, with `p_batch_size` between 1 and 500. The
SQL Editor's privileged role without an authenticated `auth.uid()` is not a
substitute. The limit is on rooms, not message rows. Each call requires READ
COMMITTED isolation and returns counts.
No schedule is installed. Do not call the cleanup function until deletion is
explicitly authorized; invoking it can permanently delete existing messages.

Do not rerun `schema.sql`, `migration_admin_academic.sql`, or the Market base
migration if already installed. The locally inspected
`migration_campus_market.sql` includes `DROP POLICY` for named storage policies;
do not run it on a project with existing policies without a separate
non-destructive first-install plan. If Market prerequisites are missing, stop:
the completion patch alone cannot install the Market base. The legacy
`migration_anonymous_chat.sql` is **not a prerequisite**: it uses the same
table names, exposes another matchmaking RPC, and its leave RPC deletes
messages. Do not run it alongside the reviewed CampusAnonymous migration.
Other Community/TeamUp migrations are not prerequisites for these scripts,
although marketplace friend/contact features depend on Community being installed.

## Behavior and tradeoffs

- Direct message SELECT/Realtime is restricted to actual room participants.
  Administrators use the report-specific transcript RPC. Reports expose only
  moderation columns to clients; the transcript does not return student UUIDs.
- Anonymous signaling no longer uses the private broadcast channel. RPCs
  validate membership, active room, event, payload, call session and rate on
  each operation; polling also checks room status. Signals for old call IDs
  cannot be submitted to a newer call. Network-delayed responses or an already
  established peer-to-peer stream cannot be instantaneously revoked; clients
  normally notice room closure on the next poll (about 1.5 seconds).
- Until message retention is installed, enabled and manually invoked, messages
  remain indefinitely. That cleanup applies **only to messages**. It locks each ended room,
  rechecks report holds, deletes only expired transcripts and records a
  tombstone; future reports for a purged room are rejected instead of creating
  a pending report without evidence. Existing resolved reports have unknown
  resolution timestamps and are held indefinitely; no unsafe backfill occurs.
  Rooms with no `ended_at` are also held. Report foreign keys restrict deletion
  of referenced profiles and rooms. Deleting an unreported profile can still
  cascade its rooms/messages; an approved account-deletion and evidence-hold
  process is needed. Message cleanup has no scheduler or durable audit log.
- After the separate signaling-expiry migration, SDP/ICE/event records have a
  two-minute TTL matching the current poll window. A database-internal
  `pg_cron` job deletes expired rows in batches, removes abandoned or ended
  call-session state, and ends rooms over two hours old using the existing
  active-participant trigger. It never deletes messages or reports.
  The current transcript RPC defines report evidence as message rows; report
  reasons/snippets remain on reports. Signaling records are **not** included in
  that transcript and are expired even for a pending report. If SDP/ICE data is
  required as report evidence, do not approve this design without a separate
  evidence-hold policy. A connected call retains its session while its room is
  active; the job ends rooms at the existing two-hour lifetime.
  Acknowledged signals are not deleted early because one account may have
  multiple tabs polling at different rates. TTL is eligibility, not a guaranteed
  deletion deadline: paused databases, disabled/failed jobs, locked rooms and
  backlogs delay cleanup. Monitor job execution and backlog; real tests and
  load sizing are required.
- Before the new Market privacy policy, **every authenticated account** can
  sign all uploads. After it is installed, authenticated users may sign only
  images referenced by listings visible under their own listing RLS, plus
  their own uploads; admins may inspect all Market images. The reviewed base
  listing policy makes both available and sold listings visible. It does not
  verify student enrollment. Already-issued signed URLs remain bearer links
  until expiry (the frontend requests one hour by default, but other clients
  may have requested longer); changing RLS does not revoke them.
  External/legacy URLs are not protected by Storage RLS.
  The frontend no longer shares a path-only URL cache between accounts.
  Legacy/admin-created objects without an owner cannot be seller-managed
  until reviewed. MIME and size limits do not prove image contents.
- Direct WebRTC exposes network addresses to the other peer; public STUN alone
  may not work behind restrictive NATs. RPC polling and signal cleanup increase
  database traffic and require load planning.
- The new active-participant primary key spans both room positions, and the
  room trigger inserts the two mappings in UUID order or releases both on end.
  Matchmaking calls also take one global transaction lock before the existing
  queue logic. This serializes joins and reduces queue-lock deadlocks at the
  cost of throughput. Other unrelated transaction interactions can still
  deadlock and require normal retries. None of this has been database-tested.

## Local frontend/RPC compatibility

Names and named arguments were checked against the local migration definitions,
not against deployed functions. Anonymous match/check return JSON containing
`matched`, room ID and aliases; message history is a JSON array; message send
returns a JSON message; leave/heartbeat/block/review return booleans; report
returns a UUID; the transcript returns rows of message ID, role, alias, content
and timestamp. The frontend consumes or intentionally ignores these values
accordingly. The new signal send/poll RPCs return JSON consumed by the peer
manager. Both the RPC signatures and client state handling still require live
integration tests.

Market create/report and Community friend/conversation RPCs return UUIDs;
Market update/delete/review return booleans and status toggle returns text.
The UI consumes the conversation UUID and otherwise checks RPC errors before
refreshing its data. Its argument names match the local SQL. The completion
script replaces the local base's already-present Market admin review function;
the previous report's claim that the function was missing from that base file
was incorrect. Market Storage signed-URL handling has a mock test only.

## Required tests after approval, on an isolated Supabase project

These are **not yet run**. Use at least participants A/B, nonparticipant C,
an administrator D who is not a participant, and separate authenticated
connections/transactions. Verify actual row counts, payloads and errors.

1. Establish A/B and unrelated rooms. Check direct SELECT and Postgres Changes
   for A, B, C, D and anonymous users. D must not see A/B messages directly.
   Create a report; D can retrieve only that report's transcript; C cannot.
   Verify neither report SELECT nor transcript returns participant UUIDs.
2. Attempt all signal events from C and from A/B after room closure, including
   unknown events, oversized/malformed SDP and ICE, invalid call IDs and
   excessive sends/polls. Test consent ordering, duplicate/replayed offers,
   old-session IDs after a new call, delayed responses, forged `room_ended`
   broadcasts, two browser tabs, camera denial, and connection interruptions.
   Check media tracks stop and an old session cannot be re-established.
3. Start A/B with known messages and use barriers on separate connections to
   overlap `anonymous_leave`, `anonymous_block_partner`, and
   `anonymous_report_partner` in every ordering, including leave/block first.
   After a report is pending, overlap another report with
   `anonymous_admin_review_report`, and resolve one of multiple pending
   reports. Repeat with the review first and a late report second. Confirm each
   pending report can still retrieve the complete original transcript.
   Also exercise concurrent sends and account/profile deletion attempts.
4. Exercise Market upload, update, delete and signed URL with owner and
   non-owner accounts, anonymous users, another bucket, the four allowed MIME
   types, invalid MIME types, 5 MiB and over-limit files. Test existing correct
   policies as well as identically named policies with modified roles,
   commands, expressions, checks or permissiveness. The latter must fail
   preflight with no changes; verify unrelated policies and buckets remain
   unchanged. Test a broad unrelated permissive policy and objects without
   `owner_id`; confirm the restrictive guards behave as intended.
5. Exercise all Market and Anonymous frontend RPCs and return shapes with real
   authenticated users; verify role grants, PostgreSQL Changes subscriptions,
   Storage signed URLs and the deployment's exact Postgres/Supabase version.
   Repeat concurrent matchmaking with a participant appearing in opposite
   canonical columns. Test rate-limit reset and multi-tab behavior.
6. For the new participant mapping, use barriers and separate transactions to
   race rooms A/B and C/A, simultaneous joins, leave, block and report. Verify
   at most one winning active room, exactly two mappings per active room,
   rollback without partial mappings, release on end, preserved evidence, and
   no queue-lock deadlock between join calls. Test an existing duplicate makes
   migration preflight fail without changing rows.
7. Test retention with cleanup disabled, then separately approve test-data
   deletion and enable it. Race cleanup against report insertion and pending
   review in both orders, including several reports per room. Test recent and
   old resolved reports, legacy NULL resolution timestamps, missing `ended_at`,
   batch boundaries, post-purge reporting rejection and non-READ-COMMITTED
   rejection. Confirm pending and recently resolved evidence is never deleted.
8. After separately approving test signaling deletion, verify the in-database
   cron job is active and runs in the intended database/role. Check fresh
   signals remain available through the poll window, expired signals and
   abandoned sessions are eventually removed, connected active sessions are
   retained until room expiry, and two-hour expiry releases active mappings.
   Create a pending report and confirm its message transcript and snippet remain
   intact while expired signaling is removed. Test lock contention, job failure,
   database pauses, backlog recovery and multiple-tab polling. No message
   retention setting should be enabled by the signaling job.

The local Node tests include static assertions and mocked client behavior.
They cannot validate SQL syntax against the target server, RLS, transaction
isolation, authentication, Storage, Realtime, or real database concurrency.
