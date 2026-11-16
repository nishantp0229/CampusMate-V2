# CampusAnonymous review and verification

This is a source review, not evidence of any deployed database state. No SQL
was executed and no Supabase project was contacted. Neither the local migration
order nor these checks are permission to modify a database.

## Findings

### High: one active room across both participant columns

The two partial unique indexes in `migration_campus_anonymous.sql` each cover
only one column. For ordered users A < B < C, rooms A/B and B/C satisfy both
indexes while B is active twice. The base comments claiming a complete
cross-column database guarantee are therefore incorrect.

`migration_anonymous_active_participants.sql` addresses this with a single
primary key on `user_id`, a transactional room trigger, a duplicate preflight,
and a locked backfill. The trigger adds both participants in UUID order,
releases them on room end, and prevents participant changes and reopening.
The wrappers serialize join, match checks, leave, block and report before the
original implementations' locks. This is a static design for ordinary
transactional writes, not a proof of PostgreSQL behavior. Trigger states,
effective privileges, alternate room writers, isolation levels, and real concurrent transactions
still need independent verification. Privileged roles may bypass protections.

The proposed participant patch now also fails closed on inherited client
privileges to its mapping table or unlocked matchmaking function, and checks
the Realtime publication. It does not correct a patch already installed:
compare deployed definitions first and prepare a separately reviewed forward
migration if they differ. Do not rerun it.

### High: blocking an old room could race a new match

The base join and block/report functions could overlap when blocking an ended
room. The pending participant patch now wraps all five entry points with the
same transaction advisory lock and requires READ COMMITTED. After the original
block/report has authorized and recorded the block, it ends any active room
for that same pair. The originals are private and retain their existing
authorization, reporting and evidence behavior. A room-specific leave no
longer deletes a later queue entry. The match-check wrapper also protects its
queue deletion from racing a new search. These changes need actual PostgreSQL
concurrency and permissions tests; the global lock also bounds throughput.

### High: cancellation and stale frontend responses

`src/pages/Anonymous.jsx` now invalidates stale join, poll, history, Realtime
and room callbacks. Stop and Next wait for an in-flight join before leaving;
unmount cleanup is scoped to a session started or restored by the page, and a
same-tab remount waits for that cleanup. StrictMode effect replay does not
automatically leave a session it has not restored. Matchmaking, polling,
heartbeat and cleanup verify the account and pin that access token to each
request. An unconfirmed leave response is treated as a failure. A report
response can still be confirmed after that room ends, but cannot update a
later session.

These protections have local mock tests but not live multi-user tests. A lost
network response does not prove a server transaction has finished; closing a
browser can also interrupt cleanup. Independent tabs do not share the in-memory
barrier, and an unscoped queue leave can affect the same account's other tab.
Failing or ambiguous cleanup requires retry and must not be treated as a
confirmed stop.

### Medium: publication and effective privileges

The base preflight checks that `supabase_realtime` is not an all-tables
publication, but not that it publishes INSERTs. A schema-wide publication can
also include rooms or other sensitive tables with `puballtables = false`.
The participant patch now checks for message INSERT publication and rejects
sensitive Anonymous tables in the publication. This does not verify row
filters, RLS behavior, or actual Realtime delivery.

The base revokes PUBLIC execution on several RPCs, but effective privileges can
also come from explicit/default or inherited role grants. In particular, access
to the renamed unlocked join or direct access to the mapping table can
undermine the intended guard. The participant patch checks the standard
client roles' *effective* privileges, but additional roles, alternate
functions, dynamic SQL, owner membership, and bypass-RLS roles still require
manual audit.

### Medium: rate and retention limitations

Rate-limit updates are transactional. When a caller subsequently raises an
exception, its counter update rolls back; repeated invalid/failing operations
therefore may not consume the intended quota. Successful calls still use the
fixed-window counter. `anonymous_check_match` and message-history reads have no
dedicated limit, and history is returned as one unbounded JSON array. Review
abuse and load protection without assuming the existing limits cover every
failure or read; changing RPC error behavior needs separate design and tests.

Messages and signaling data may remain indefinitely while optional cleanup is
disabled. The proposed retention migration creates a disabled configuration;
its cleanup must not be enabled or invoked without separately approved
deletion. The signaling-expiry migration **registers an active cron job** and
backfills data; do not apply it without separate approval for the resulting
automatic signaling deletion and room expiry. Pending reports do not hold
signaling metadata under that design.

The message SELECT policy and history RPC allow room participants to read
historical room messages after the room ends, despite one base comment saying
“active room.” This is different from deleting evidence or granting admins
direct message access; whether that participant access is desired is a
privacy-policy decision.

### Low: avoidable complexity

- The base creates `anonymous_blocks_blocker_idx` on `(blocker_id, blocked_id)`,
  which duplicates the index backing the identical UNIQUE constraint. The
  reports-room index also has an unnecessary `room_id IS NOT NULL` predicate
  because the column is NOT NULL. Do not drop indexes on an existing database
  without a separately reviewed, measured plan.
- The unused-by-current-frontend `anonymous_get_room_info` RPC, the separate
  queue, mapping, report, rate-limit, video-session and signaling tables, and
  repeated security checks must not be removed just for fewer lines. They
  support different contracts or protections.
- The historical `migration_anonymous_chat.sql` uses the same table names,
  exposes a partner UUID and deletes messages in its leave function. It is
  obsolete and incompatible: **never execute it**. Do not delete the file or
  existing database objects without a separately approved plan.

## Read-only review of other migrations

No other module's files, schemas, or policies were changed.

- `schema.sql` calls `DROP VIEW ... CASCADE` despite its “safely rerunnable”
  comment; do not rerun it against an existing project. Phase A also replaces
  `update_updated_at_column()` and several policy definitions, so its repeated
  helper is not a reason to rerun or consolidate deployed migrations.
- `migration_admin_academic.sql` has an index on `attendance(user_id)` that
  overlaps the leading column of `UNIQUE (user_id, subject)`. TeamUp similarly
  has `team_members_team_idx` alongside `UNIQUE (team_id, user_id)`. These
  narrower indexes may still have different performance benefits; inspect
  deployed indexes and query plans before proposing removal.
- Community's friendship patch intentionally replaces several base RPCs to
  enforce friendship and blocking; those are not safe “duplicates” to delete.
  Market completion also replaces its base admin-review RPC with a stricter
  version, while its privacy guards add defense in depth. Leave these working
  modules and migrations unchanged.

## Conditional installation order

First use an approved isolated fixture and obtain explicit approval for any
SQL execution. No database installation is authorized by this document.
Record the actual installed definitions, roles and publication; stop on any
unexpected or partial installation. Never rerun a base migration merely to
repair an unknown deployment.

1. A compatible core schema, `public.profiles`, Phase A `admin_users` and
   `is_admin()`, Supabase Auth, and an appropriate `supabase_realtime`
   publication are prerequisites. If already installed, inspect rather than
   rerunning `schema.sql` or Phase A.
2. On a genuinely fresh, approved fixture only, the candidate first-install
   file is `migration_campus_anonymous.sql`. If any Anonymous base objects
   already exist, stop and inspect; do not rerun it. Keep client access
   unavailable until the cross-column participant patch is also verified.
3. Next, if the exact compatible base exists and the participant patch has
   never been applied, the candidate is
   `migration_anonymous_active_participants.sql`. It stops on duplicates,
   incompatible role privileges, publications or conflicting objects; do not
   resolve them by deleting data. If its objects already exist, inspect them
   and do not rerun the modified file. The old-room block/report fix also
   depends on this revised patch; an older installed version needs a separately
   reviewed forward migration.
4. `migration_anonymous_message_retention.sql` is optional, proposed, and
   requires its own review. If installed, keep `cleanup_enabled = false`;
   never enable or invoke deletion without separate approval.
5. `migration_anonymous_signal_expiry.sql` is optional and deferred: applying
   it schedules active cleanup. It requires the active-participant patch,
   operational in-database `pg_cron`, and separate explicit approval.
6. Never execute `migration_anonymous_chat.sql`.

Each candidate file has its own transaction. Record exact errors and stop on
the first failure; do not drop policies, disable RLS, delete evidence, or
activate jobs to force installation. Production changes require a separately
approved plan, backup, maintenance window and verified isolated tests.

## Read-only post-install verification

The following are SELECT-only checks to be run by an authorized operator
**after** installation, on the verified target. They are not a substitute for
testing and are not run by this review. Do not publish user IDs or message
content. Run the final mapping query only after confirming both tables exist.

```sql
-- Publication must publish INSERTs, include messages, and exclude all other
-- Anonymous tables. Also inspect any publication row/column filters.
SELECT pubname, puballtables, pubinsert, pubupdate, pubdelete
FROM pg_catalog.pg_publication
WHERE pubname = 'supabase_realtime';

SELECT *
FROM pg_catalog.pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public' AND tablename LIKE 'anonymous\_%' ESCAPE '\'
ORDER BY tablename;

-- RLS and effective client access to private room/mapping tables.
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_catalog.pg_get_userbyid(c.relowner) AS owner, c.relacl,
       pg_catalog.has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER') AS anon_table_access,
       pg_catalog.has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE') AS anon_column_access,
       pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER') AS authenticated_table_access,
       pg_catalog.has_any_column_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE') AS authenticated_column_access
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('anonymous_rooms', 'anonymous_active_participants');

-- Review ALL Anonymous policies, not just their names.
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public' AND tablename LIKE 'anonymous\_%' ESCAPE '\'
ORDER BY tablename, policyname;

-- Review exact definitions, owners, settings, explicit and inherited grants.
-- All unlocked RPCs and the pair helper must be inaccessible to the three
-- client/service roles.
SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS args,
       pg_catalog.pg_get_function_result(p.oid) AS result,
       pg_catalog.pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef, p.proconfig, p.proacl,
       pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_execute,
       pg_catalog.pg_get_functiondef(p.oid) AS definition
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f'
  AND (p.proname LIKE 'anonymous\_%' ESCAPE '\'
       OR p.proname IN ('is_admin', 'match_anonymous_user', 'leave_anonymous_chat'))
ORDER BY p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid);

SELECT c.relname, t.tgname, t.tgenabled, pg_catalog.pg_get_triggerdef(t.oid) AS definition
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal
  AND c.relname IN ('anonymous_rooms', 'anonymous_reports')
ORDER BY c.relname, t.tgname;

SELECT c.relname, con.conname, con.convalidated,
       pg_catalog.pg_get_constraintdef(con.oid) AS definition
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('anonymous_rooms', 'anonymous_active_participants', 'anonymous_reports')
ORDER BY c.relname, con.conname;
```

If both rooms and the participant table exist, compare them in one snapshot.
Expected values are all zero. This returns counts, not participant IDs.

```sql
WITH expected AS (
  SELECT user_1 AS user_id, id AS room_id
  FROM public.anonymous_rooms WHERE status = 'active'
  UNION ALL
  SELECT user_2 AS user_id, id AS room_id
  FROM public.anonymous_rooms WHERE status = 'active'
),
duplicates AS (
  SELECT user_id FROM expected GROUP BY user_id HAVING count(*) > 1
),
missing AS (
  SELECT user_id, room_id FROM expected
  EXCEPT SELECT user_id, room_id FROM public.anonymous_active_participants
),
extra AS (
  SELECT user_id, room_id FROM public.anonymous_active_participants
  EXCEPT SELECT user_id, room_id FROM expected
)
SELECT (SELECT count(*) FROM duplicates) AS users_in_multiple_active_rooms,
       (SELECT count(*) FROM missing) AS missing_mappings,
       (SELECT count(*) FROM extra) AS extra_mappings;
```

If retention is installed, an authorized administrator can separately check
that its singleton `cleanup_enabled` is false with a SELECT. Do not set it.
Do not schedule or invoke any cleanup. Absence of rows or matching definitions
does not prove permissions or concurrency behavior.

## Required isolated tests before any production claim

With separately approved disposable data and actual authenticated sessions,
test A/B, nonparticipant C, and nonparticipant administrator D:

1. Race joins for A/B and C/A using separate transactions and barriers, in
   opposite participant columns. Repeat simultaneous same-user joins,
   join/leave, skip, block, report and room expiry. Include blocking or
   reporting an ended A/B room while A and B concurrently match again; no
   active room between the blocked pair should survive. Assert at most one
   active room per user and exactly two mapping rows per active room after
   commits and rollbacks. Test READ COMMITTED and the chosen deployment
   isolation level.
2. Test duplicate preflight failure without changes; trigger disabled or
   altered; inherited privileges and alternate RPCs; no direct access by C,
   anon, or a nonparticipant admin to room identities, signaling, or
   participant-only messages. An admin's report reason/snippet can contain
   user-supplied identifying text. Verify message Realtime INSERT delivery and
   RLS.
3. Race Stop/Next against delayed join, polling, exit, reconnect and multi-tab
   operations. Check the UI and server agree about whether a room or queue
   entry remains, including StrictMode development remounts, auth switches,
   lost responses and network errors. Independently test the case where an
   old leave arrives after another tab starts a new search.
4. Exercise message and signal rate limits, invalid/failing calls, accepted and
   rejected video handshakes, old sessions, room termination, and P2P privacy.
   Check text chat, block/report, pending evidence, and report-specific admin
   transcripts using real clients.

Node tests include static text assertions and mocks; they do not execute SQL,
prove RLS or grant behavior, or reproduce PostgreSQL transaction concurrency.
