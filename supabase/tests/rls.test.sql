-- RLS and sync tests (acceptance 12, 13, 15, 16). Run with scripts/test-db.sh.
-- Each assertion raises an exception on failure; ON_ERROR_STOP aborts the run.
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Seed content as the service owner.
insert into public.exercises (id, content_version, data, review_status) values
  ('approved_ex', 1, '{}', 'approved'), ('draft_ex', 1, '{}', 'not_reviewed');

-- ---------- user A writes through the sync function ----------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');

select pg_temp.check(
  (select count(*) from public.exercises) = 1,
  'clients only see approved catalogue content');

select public.apply_sync_operations('[
  {"opId":"10000000-0000-0000-0000-000000000001","entity":"workout_session","entityId":"20000000-0000-0000-0000-000000000001",
   "payload":{"id":"20000000-0000-0000-0000-000000000001","localDate":"2026-11-02","status":"active","variant":"standard","sessionKey":"A","checkInMethod":"manual","checkInAt":"2026-11-02T17:00:00Z"}},
  {"opId":"10000000-0000-0000-0000-000000000002","entity":"set_log","entityId":"30000000-0000-0000-0000-000000000001",
   "payload":{"id":"30000000-0000-0000-0000-000000000001","sessionId":"20000000-0000-0000-0000-000000000001","workoutExerciseId":"40000000-0000-0000-0000-000000000001","exerciseId":"leg_press","setIndex":0,"kind":"working","reps":10,"weight":{"value":40,"unit":"kg","basis":"machine_stack"},"effort":null,"completedAt":"2026-11-02T17:05:00Z"}},
  {"opId":"10000000-0000-0000-0000-000000000003","entity":"xp_award","entityId":"check_in:2026-11-02",
   "payload":{"awardKey":"check_in:2026-11-02","kind":"check_in","amount":10,"localDate":"2026-11-02","sessionId":"20000000-0000-0000-0000-000000000001","rulesVersion":"t"}}
]'::jsonb);

-- Replay the same batch (reconnect/retry): nothing duplicates.
select pg_temp.check(
  (select bool_and(r->>'result' = 'duplicate') from jsonb_array_elements(public.apply_sync_operations('[
    {"opId":"10000000-0000-0000-0000-000000000001","entity":"workout_session","entityId":"x","payload":{}},
    {"opId":"10000000-0000-0000-0000-000000000002","entity":"set_log","entityId":"x","payload":{}},
    {"opId":"10000000-0000-0000-0000-000000000003","entity":"xp_award","entityId":"x","payload":{}}
  ]'::jsonb)) r),
  'replayed operations are reported as duplicates');
select pg_temp.check((select count(*) from public.set_logs) = 1, 'replay does not duplicate sets');
select pg_temp.check((select total from public.xp_totals) = 10, 'replay does not duplicate XP');
select pg_temp.check((select count(*) from public.check_ins) = 1 and (select method from public.check_ins) = 'manual', 'check-in stores method only');

-- A new op id for the same award key still cannot double-award.
select public.apply_sync_operations('[{"opId":"10000000-0000-0000-0000-000000000004","entity":"xp_award","entityId":"check_in:2026-11-02",
  "payload":{"awardKey":"check_in:2026-11-02","kind":"check_in","amount":10,"localDate":"2026-11-02","rulesVersion":"t"}}]'::jsonb);
select pg_temp.check((select total from public.xp_totals) = 10, 'same award key cannot be awarded twice');

-- Inflated amounts are rejected.
select pg_temp.check(
  (select r->>'result' from jsonb_array_elements(public.apply_sync_operations('[{"opId":"10000000-0000-0000-0000-000000000005","entity":"xp_award","entityId":"k",
    "payload":{"awardKey":"mission:2026-11-02","kind":"mission","amount":9999,"localDate":"2026-11-02","rulesVersion":"t"}}]'::jsonb)) r) = 'rejected_invalid_amount',
  'client cannot inflate XP');

-- Direct writes to authority tables are denied.
do $$ begin
  begin
    insert into public.xp_ledger (user_id, award_key, kind, amount, local_date, rules_version)
    values ('00000000-0000-0000-0000-00000000000a', 'x', 'lesson', 1000, '2026-11-02', 't');
    raise exception 'FAILED: direct xp insert allowed';
  exception when insufficient_privilege then raise notice 'ok - direct XP writes denied';
  end;
  begin
    insert into public.entitlements (user_id, entitlement, active) values ('00000000-0000-0000-0000-00000000000a', 'pro', true);
    raise exception 'FAILED: entitlement insert allowed';
  exception when insufficient_privilege then raise notice 'ok - entitlement writes denied';
  end;
  begin
    update public.exercises set review_status = 'approved' where id = 'draft_ex';
    raise exception 'FAILED: approval update allowed';
  exception when insufficient_privilege then raise notice 'ok - approval writes denied';
  end;
  begin
    perform * from public.licences;
    raise exception 'FAILED: licence read allowed';
  exception when insufficient_privilege then raise notice 'ok - licence records hidden';
  end;
end $$;

-- Finish the session.
select public.apply_sync_operations('[{"opId":"10000000-0000-0000-0000-000000000006","entity":"workout_session","entityId":"20000000-0000-0000-0000-000000000001",
  "payload":{"id":"20000000-0000-0000-0000-000000000001","status":"completed","outcome":"full","finishedAt":"2026-11-02T18:00:00Z"}}]'::jsonb);

-- A second device editing the completed workout is rejected, not silently applied (acceptance 13).
select pg_temp.check(
  (select r->>'result' from jsonb_array_elements(public.apply_sync_operations('[{"opId":"10000000-0000-0000-0000-000000000007","entity":"set_log","entityId":"30000000-0000-0000-0000-000000000001",
    "payload":{"id":"30000000-0000-0000-0000-000000000001","sessionId":"20000000-0000-0000-0000-000000000001","reps":3}}]'::jsonb)) r) = 'conflict_completed_elsewhere',
  'completed session cannot be overwritten by another device');
select pg_temp.check((select reps from public.set_logs) = 10, 'completed set is unchanged');
select pg_temp.check(
  (select r->>'result' from jsonb_array_elements(public.apply_sync_operations('[{"opId":"10000000-0000-0000-0000-000000000008","entity":"workout_session","entityId":"20000000-0000-0000-0000-000000000001",
    "payload":{"id":"20000000-0000-0000-0000-000000000001","status":"active","localDate":"2026-11-02"}}]'::jsonb)) r) = 'conflict_completed_elsewhere',
  'regenerated plan cannot reopen a completed session');

reset role;

-- ---------- user B cannot see or touch A ----------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from public.workout_sessions) = 0, 'other users cannot read sessions');
select pg_temp.check((select count(*) from public.set_logs) = 0, 'other users cannot read sets');
select pg_temp.check((select count(*) from public.xp_ledger) = 0, 'other users cannot read XP');
update public.set_logs set reps = 1;
delete from public.workout_sessions;
reset role;
select pg_temp.check((select reps from public.set_logs) = 10, 'other users cannot update sets');
select pg_temp.check((select count(*) from public.workout_sessions) = 1, 'other users cannot delete sessions');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(
  (select r->>'result' from jsonb_array_elements(public.apply_sync_operations('[{"opId":"10000000-0000-0000-0000-000000000009","entity":"workout_session","entityId":"20000000-0000-0000-0000-000000000001",
    "payload":{"id":"20000000-0000-0000-0000-000000000001","status":"active","localDate":"2026-11-02"}}]'::jsonb)) r) = 'rejected_not_owner',
  'sync cannot write into another user''s session');
do $$ begin
  begin
    insert into public.workout_sessions (id, user_id, local_date, status) values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', '2026-11-02', 'active');
    raise exception 'FAILED: cross-user insert allowed';
  exception when insufficient_privilege or check_violation then raise notice 'ok - cross-user insert denied';
  end;
end $$;
reset role;

-- ---------- unauthenticated access ----------
set role anon;
do $$ begin
  begin
    perform * from public.workout_sessions;
    raise exception 'FAILED: anon read allowed';
  exception when insufficient_privilege then raise notice 'ok - anon cannot read sessions';
  end;
  begin
    perform public.apply_sync_operations('[]'::jsonb);
    raise exception 'FAILED: anon sync allowed';
  exception when insufficient_privilege then raise notice 'ok - anon cannot sync';
  end;
end $$;
reset role;

-- ---------- account deletion cascades ----------
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check(
  (select count(*) from public.workout_sessions) + (select count(*) from public.set_logs) + (select count(*) from public.xp_ledger)
  + (select count(*) from public.check_ins)
  + (select count(*) from public.sync_operations where user_id = '00000000-0000-0000-0000-00000000000a') = 0,
  'deleting the auth user removes their records');

\echo 'ALL RLS TESTS PASSED'
