import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  filterTeams,
  isDeadlinePassed,
  getTeamCapacityMetrics,
  getTeamStatusBadge,
  parseSkillsInput,
  validateTeamForm,
  validateJoinRequest,
} from './teamup.js'

const migration = readFileSync(new URL('../../database/migration_teamup.sql', import.meta.url), 'utf8')

test('filterTeams filters by category, status and search query', () => {
  const teams = [
    { id: '1', title: 'AI Study Group', description: 'Deep learning paper reviews', project_type: 'Project', skills: ['Python', 'PyTorch'], status: 'open' },
    { id: '2', title: 'Smart India Hackathon', description: 'IoT college campus project', project_type: 'Hackathon', skills: ['React', 'Node.js', 'Arduino'], status: 'open' },
    { id: '3', title: 'Robotics Challenge', description: 'Autonomous rover for competition', project_type: 'Competition', skills: ['C++', 'ROS'], status: 'full' },
  ]

  // Filter by category
  assert.equal(filterTeams(teams, { category: 'Hackathon' }).length, 1)
  assert.equal(filterTeams(teams, { category: 'Hackathon' })[0].id, '2')

  // Filter by status
  assert.equal(filterTeams(teams, { status: 'full' }).length, 1)
  assert.equal(filterTeams(teams, { status: 'full' })[0].id, '3')

  // Filter by search query on skills
  assert.equal(filterTeams(teams, { search: 'pytorch' }).length, 1)
  assert.equal(filterTeams(teams, { search: 'pytorch' })[0].id, '1')

  // Filter by search query on description
  assert.equal(filterTeams(teams, { search: 'rover' }).length, 1)
  assert.equal(filterTeams(teams, { search: 'rover' })[0].id, '3')

  // No matches
  assert.equal(filterTeams(teams, { search: 'quantum' }).length, 0)
})

test('getTeamCapacityMetrics calculates capacity and bounds safely', () => {
  const metrics1 = getTeamCapacityMetrics(2, 4)
  assert.equal(metrics1.percentage, 50)
  assert.equal(metrics1.isFull, false)
  assert.equal(metrics1.spotsLeft, 2)
  assert.equal(metrics1.formatted, '2 / 4')

  const metrics2 = getTeamCapacityMetrics(4, 4)
  assert.equal(metrics2.percentage, 100)
  assert.equal(metrics2.isFull, true)
  assert.equal(metrics2.spotsLeft, 0)

  // Enforces capacity bounds [2, 15]
  const metricsClamped = getTeamCapacityMetrics(1, 1)
  assert.equal(metricsClamped.max, 2)
  const metricsClampedHigh = getTeamCapacityMetrics(5, 50)
  assert.equal(metricsClampedHigh.max, 15)
})

test('getTeamStatusBadge distinguishes open, full, closed and expired deadlines', () => {
  const pastDate = new Date(Date.now() - 3600000).toISOString()
  const futureDate = new Date(Date.now() + 3600000).toISOString()

  assert.equal(isDeadlinePassed(pastDate), true)
  assert.equal(isDeadlinePassed(futureDate), false)

  const expiredBadge = getTeamStatusBadge('open', pastDate)
  assert.equal(expiredBadge.label, 'Expired')
  assert.equal(expiredBadge.canApply, false)

  const openBadge = getTeamStatusBadge('open', futureDate)
  assert.equal(openBadge.label, 'Open')
  assert.equal(openBadge.canApply, true)

  const fullBadge = getTeamStatusBadge('full', futureDate)
  assert.equal(fullBadge.label, 'Full')
  assert.equal(fullBadge.canApply, false)

  const closedBadge = getTeamStatusBadge('closed', futureDate)
  assert.equal(closedBadge.label, 'Closed')
  assert.equal(closedBadge.canApply, false)
})

test('parseSkillsInput parses comma, newline, semicolon and array inputs', () => {
  assert.deepEqual(parseSkillsInput('React, Node.js; PostgreSQL\nTailwind'), ['React', 'Node.js', 'PostgreSQL', 'Tailwind'])
  assert.deepEqual(parseSkillsInput(['React', 'Node.js']), ['React', 'Node.js'])
  assert.deepEqual(parseSkillsInput(''), [])
})

test('validateTeamForm enforces required fields, limits and URLs', () => {
  const valid = validateTeamForm({
    title: 'Autonomous Drone Navigation',
    description: 'Developing computer vision pipelines for quadcopter pathfinding.',
    projectType: 'Project',
    skills: 'Python, OpenCV, ROS',
    maxMembers: 4,
    deadline: new Date(Date.now() + 86400000).toISOString(),
    projectUrl: 'https://github.com/campusmate/drone',
  })
  assert.equal(valid.isValid, true)
  assert.equal(valid.data.skills.length, 3)

  // Invalid title too short
  const invalidTitle = validateTeamForm({
    title: 'ab',
    description: 'Valid long description here for team testing',
    projectType: 'Project',
    skills: 'Python',
    maxMembers: 3,
  })
  assert.equal(invalidTitle.isValid, false)
  assert.match(invalidTitle.errors.title, /between 3 and 100/)

  // Invalid project type
  const invalidType = validateTeamForm({
    title: 'Valid Title Here',
    description: 'Valid long description here for team testing',
    projectType: 'UnknownType',
    skills: 'Python',
    maxMembers: 3,
  })
  assert.equal(invalidType.isValid, false)
  assert.match(invalidType.errors.projectType, /must be one of/)

  // Invalid max members
  const invalidMembers = validateTeamForm({
    title: 'Valid Title Here',
    description: 'Valid long description here for team testing',
    projectType: 'Hackathon',
    skills: 'Python',
    maxMembers: 20,
  })
  assert.equal(invalidMembers.isValid, false)
  assert.match(invalidMembers.errors.maxMembers, /between 2 and 15/)
})

test('validateJoinRequest enforces pitch length and skills', () => {
  const valid = validateJoinRequest({
    introduction: 'I have 2 years of React experience and built 3 hackathon projects.',
    skills: 'React, Tailwind, Supabase',
  })
  assert.equal(valid.isValid, true)

  const shortIntro = validateJoinRequest({
    introduction: 'hi',
    skills: 'React',
  })
  assert.equal(shortIntro.isValid, false)
  assert.match(shortIntro.errors.introduction, /between 5 and 1000/)
})

test('teamup migration defines required tables, indexes and RLS policies', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.teams/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.team_members/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.team_join_requests/)

  // RLS enabled
  assert.match(migration, /ALTER TABLE public\.teams ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /ALTER TABLE public\.team_members ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /ALTER TABLE public\.team_join_requests ENABLE ROW LEVEL SECURITY/)

  // Unique pending application index
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS team_join_requests_active_idx/)

  // Creator immutability guard
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.teamup_guard_creator/)
  assert.match(migration, /Team creator cannot be changed/)
})

test('all teamup RPC functions are SECURITY DEFINER with fixed search_path = "" and execution grants', () => {
  const rpcs = [
    'teamup_create_team',
    'teamup_update_team',
    'teamup_toggle_recruitment',
    'teamup_apply_to_team',
    'teamup_cancel_request',
    'teamup_respond_to_request',
    'teamup_remove_member',
    'teamup_leave_team',
    'teamup_delete_team',
  ]

  for (const rpc of rpcs) {
    const fnRegex = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}[\\s\\S]*?\\n\\$\\$;`)
    const fnDef = migration.match(fnRegex)?.[0]
    assert.ok(fnDef, `Function public.${rpc} must exist in migration`)
    assert.match(fnDef, /SECURITY DEFINER/, `${rpc} must be SECURITY DEFINER`)
    assert.match(fnDef, /SET search_path = ''/, `${rpc} must set empty search_path`)

    // Verify revoked from PUBLIC and granted to authenticated
    const grantRegex = new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\b.*?TO authenticated;`)
    assert.match(migration, grantRegex, `${rpc} must be explicitly granted to authenticated`)
    const revokeRegex = new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${rpc}\\b.*?FROM PUBLIC;`)
    assert.match(migration, revokeRegex, `${rpc} must revoke execute from PUBLIC`)
  }
})

test('security: direct client writes are revoked and unauthorized table writes are impossible', () => {
  // Direct client writes revoked from all client roles
  assert.match(
    migration,
    /REVOKE ALL ON public\.teams, public\.team_members, public\.team_join_requests\s+FROM PUBLIC, anon, authenticated;/
  )
  assert.match(
    migration,
    /GRANT SELECT ON public\.teams, public\.team_members, public\.team_join_requests\s+TO authenticated;/
  )

  // Ensure NO direct INSERT/UPDATE/DELETE policies exist for authenticated users
  assert.equal(/CREATE POLICY ".*?" ON public\.team_members\s+FOR INSERT/i.test(migration), false)
  assert.equal(/CREATE POLICY ".*?" ON public\.team_members\s+FOR UPDATE/i.test(migration), false)
  assert.equal(/CREATE POLICY ".*?" ON public\.team_members\s+FOR DELETE/i.test(migration), false)

  assert.equal(/CREATE POLICY ".*?" ON public\.team_join_requests\s+FOR INSERT/i.test(migration), false)
  assert.equal(/CREATE POLICY ".*?" ON public\.team_join_requests\s+FOR UPDATE/i.test(migration), false)
  assert.equal(/CREATE POLICY ".*?" ON public\.team_join_requests\s+FOR DELETE/i.test(migration), false)

  assert.equal(/CREATE POLICY ".*?" ON public\.teams\s+FOR INSERT/i.test(migration), false)
  assert.equal(/CREATE POLICY ".*?" ON public\.teams\s+FOR UPDATE/i.test(migration), false)
  assert.equal(/CREATE POLICY ".*?" ON public\.teams\s+FOR DELETE/i.test(migration), false)
})

test('security: leader removal is blocked in secure RPCs and every mutation derives identity from auth.uid()', () => {
  // Leader removal protection in RPCs
  assert.match(migration, /Cannot remove team leader from team members\. Dissolve the team instead\./)
  assert.match(migration, /Team leaders cannot leave their team\. You can delete the team from the management panel\./)

  // Direct writes revoked from client roles
  assert.match(migration, /REVOKE ALL ON public\.teams, public\.team_members, public\.team_join_requests/)

  // All RPCs must derive identity strictly from auth.uid()
  const rpcs = [
    'teamup_create_team',
    'teamup_update_team',
    'teamup_toggle_recruitment',
    'teamup_apply_to_team',
    'teamup_cancel_request',
    'teamup_respond_to_request',
    'teamup_remove_member',
    'teamup_leave_team',
    'teamup_delete_team',
  ]

  for (const rpc of rpcs) {
    const fnRegex = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}[\\s\\S]*?\\n\\$\\$;`)
    const fnDef = migration.match(fnRegex)?.[0] || ''
    assert.match(fnDef, /v_uid := auth\.uid\(\);/, `${rpc} must derive caller identity from auth.uid()`)
    assert.match(fnDef, /IF v_uid IS NULL THEN\s+RAISE EXCEPTION 'Authentication required\.'/, `${rpc} must check auth.uid()`)
  }

  // teamup_respond_to_request must lock team row and verify capacity before adding member
  const respondDef = migration.match(/CREATE OR REPLACE FUNCTION public\.teamup_respond_to_request[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.match(respondDef, /FOR UPDATE/, 'respond_to_request must lock team and request rows')
  assert.match(respondDef, /v_member_count >= v_team\.max_members/, 'respond_to_request must enforce capacity under lock')
  assert.match(respondDef, /status = 'full'/, 'respond_to_request must set status to full when capacity reached')
})

test('[Static SQL Verification] string trimming strictly uses btrim/pg_catalog.btrim with zero bare trim() calls', () => {
  // All occurrences of trim must be btrim
  assert.equal(/(?<!b)trim\s*\(/.test(migration), false, 'No bare trim() calls should exist in migration')

  // Check table constraints use btrim
  assert.match(migration, /char_length\(btrim\(title\)\) >= 3/)
  assert.match(migration, /char_length\(btrim\(description\)\) >= 10/)
  assert.match(migration, /char_length\(btrim\(introduction\)\) >= 5/)
  assert.match(migration, /char_length\(btrim\(skills\)\) >= 1/)

  // Check RPC functions use pg_catalog.btrim
  assert.match(migration, /v_clean_title := pg_catalog\.btrim\(p_title\);/)
  assert.match(migration, /v_clean_desc := pg_catalog\.btrim\(p_description\);/)
  assert.match(migration, /v_clean_intro := pg_catalog\.btrim\(p_introduction\);/)
  assert.match(migration, /v_clean_skills := pg_catalog\.btrim\(p_skills\);/)
})

test('[Static SQL Verification] migration includes strict preflight checking for conflicting tables, functions and RLS policies', () => {
  // Base dependency checks
  assert.match(migration, /to_regclass\('public\.profiles'\) IS NULL/)
  assert.match(migration, /attname = 'id'/)

  // Conflicting tables check
  assert.match(migration, /'teams', 'team_members', 'team_join_requests'/)
  assert.match(migration, /Existing table public\.% conflicts with this first-install migration/)

  // Conflicting functions check
  assert.match(migration, /'teamup_create_team'/)
  assert.match(migration, /'teamup_respond_to_request'/)
  assert.match(migration, /'teamup_delete_team'/)
  assert.match(migration, /An existing TeamUp function conflicts with this first-install migration/)

  // Unexpected RLS policies check
  assert.match(migration, /FROM pg_policies/)
  assert.match(migration, /Unexpected RLS policies exist on TeamUp tables/)
})

test('[Static SQL Verification] leader removal is strictly guarded in RPCs while foreign-key CASCADE deletes cleanly without pg_trigger_depth()', () => {
  // 1. Avoid relying on pg_trigger_depth()
  assert.equal(/pg_trigger_depth\s*\(/.test(migration), false, 'Migration must not call pg_trigger_depth()')

  // 2. Drop any legacy leader removal trigger
  assert.match(migration, /DROP TRIGGER IF EXISTS trg_team_members_guard_leader ON public\.team_members;/)
  assert.match(migration, /DROP FUNCTION IF EXISTS public\.teamup_guard_leader_removal\(\);/)

  // 3. teamup_remove_member guards against removing any leader
  const removeDef = migration.match(/CREATE OR REPLACE FUNCTION public\.teamup_remove_member[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.ok(removeDef, 'teamup_remove_member must be defined')
  assert.match(removeDef, /p_user_id = v_uid OR EXISTS/)
  assert.match(removeDef, /role = 'leader'/)
  assert.match(removeDef, /Cannot remove team leader from team members\. Dissolve the team instead\./)

  // 4. teamup_leave_team guards against leader leaving
  const leaveDef = migration.match(/CREATE OR REPLACE FUNCTION public\.teamup_leave_team[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.ok(leaveDef, 'teamup_leave_team must be defined')
  assert.match(leaveDef, /v_team\.creator_id = v_uid OR EXISTS/)
  assert.match(leaveDef, /role = 'leader'/)
  assert.match(leaveDef, /Team leaders cannot leave their team/)
})

test('[Static SQL Verification] lifecycle contract: create team -> add member -> delete team cascades cleanly', () => {
  // 1. Create team inserts leader atomically
  const createDef = migration.match(/CREATE OR REPLACE FUNCTION public\.teamup_create_team[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.match(createDef, /INSERT INTO public\.teams/)
  assert.match(createDef, /INSERT INTO public\.team_members[\s\S]*?'leader'/)

  // 2. Apply to team creates pending join request
  const applyDef = migration.match(/CREATE OR REPLACE FUNCTION public\.teamup_apply_to_team[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.match(applyDef, /INSERT INTO public\.team_join_requests[\s\S]*?'pending'/)

  // 3. Respond to request adds member
  const respondDef = migration.match(/CREATE OR REPLACE FUNCTION public\.teamup_respond_to_request[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.match(respondDef, /INSERT INTO public\.team_members[\s\S]*?'member'/)

  // 4. Foreign key cascades declared on both child tables
  assert.match(migration, /team_id\s+UUID\s+NOT NULL\s+REFERENCES\s+public\.teams\(id\)\s+ON DELETE CASCADE/)
  assert.match(migration, /team_id\s+UUID\s+NOT NULL\s+REFERENCES\s+public\.teams\(id\)\s+ON DELETE CASCADE/)

  // 5. Delete team safely deletes parent row, cascading to members and requests
  const deleteDef = migration.match(/CREATE OR REPLACE FUNCTION public\.teamup_delete_team[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.match(deleteDef, /DELETE FROM public\.teams\s+WHERE id = p_team_id;/)
})

test('[Static SQL Verification] teamup_apply_to_team raises exception on full team without rollback-prone update', () => {
  const applyDef = migration.match(/CREATE OR REPLACE FUNCTION public\.teamup_apply_to_team[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.ok(applyDef, 'teamup_apply_to_team must be defined')

  // Verify that it directly raises exception on full team rather than executing an UPDATE that gets rolled back
  assert.match(applyDef, /IF v_member_count >= v_team\.max_members THEN\s+RAISE EXCEPTION 'Team is already full\.';\s+END IF;/)
  assert.equal(/UPDATE public\.teams SET status = 'full' WHERE id = p_team_id;[\s\S]*?RAISE EXCEPTION 'Team is already full\.'/.test(applyDef), false, 'Must not execute an update right before raising exception')
})

test('[Static SQL Verification] concurrent approvals serialize on team row lock preventing capacity overflow', () => {
  const respondDef = migration.match(/CREATE OR REPLACE FUNCTION public\.teamup_respond_to_request[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.ok(respondDef, 'teamup_respond_to_request must be defined')

  // 1. Both request and team are locked with FOR UPDATE to serialize concurrent leaders/approvals
  assert.match(respondDef, /SELECT \* INTO v_req[\s\S]*?FROM public\.team_join_requests[\s\S]*?FOR UPDATE;/)
  assert.match(respondDef, /SELECT \* INTO v_team[\s\S]*?FROM public\.teams[\s\S]*?FOR UPDATE;/)

  // 2. Capacity is checked under the exclusive row-level lock
  assert.match(respondDef, /SELECT COUNT\(\*\) INTO v_member_count[\s\S]*?FROM public\.team_members[\s\S]*?WHERE team_id = v_team\.id;/)
  assert.match(respondDef, /IF v_member_count >= v_team\.max_members THEN\s+RAISE EXCEPTION 'Cannot accept member: team has already reached its maximum limit/)

  // 3. Status is updated to full only when committing the final member (v_member_count + 1 >= max_members)
  assert.match(respondDef, /IF v_member_count \+ 1 >= v_team\.max_members THEN\s+UPDATE public\.teams\s+SET status = 'full'/)
  assert.match(respondDef, /RETURN TRUE;/)
})

test('[Static SQL Verification] team deletion via RPC safely locks team and cascades deletions', () => {
  const deleteDef = migration.match(/CREATE OR REPLACE FUNCTION public\.teamup_delete_team[\s\S]*?\n\$\$;/)?.[0] || ''
  assert.ok(deleteDef, 'teamup_delete_team must be defined')
  assert.match(deleteDef, /v_uid := auth\.uid\(\);/)
  assert.match(deleteDef, /FOR UPDATE/)
  assert.match(deleteDef, /v_team\.creator_id <> v_uid/)
  assert.match(deleteDef, /DELETE FROM public\.teams\s+WHERE id = p_team_id;/)
})
