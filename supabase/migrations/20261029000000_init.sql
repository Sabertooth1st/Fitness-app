-- ARRIVE initial schema.
-- Every user-owned table has RLS enabled and policies tied to auth.uid().
-- Clients can never write approval, licence, canonical XP totals or entitlements.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles and preferences
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  locale text not null default 'en' check (locale in ('en', 'de-CH')),
  units text not null default 'kg' check (units in ('kg', 'lb')),
  timezone text not null default 'UTC',
  goal text,
  experience text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Gym label and equipment only. Precise gym coordinates stay on the device in v1.
create table public.gym_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  label text not null check (char_length(label) <= 80),
  equipment text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('cloud_backup', 'analytics', 'location_assist')),
  granted boolean not null,
  consent_version text not null,
  recorded_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  hour smallint not null default 17 check (hour between 0 and 23),
  minute smallint not null default 30 check (minute between 0 and 59),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Content catalogue (read-only for clients; written by service role / import scripts)
-- ---------------------------------------------------------------------------
create table public.licences (
  id text primary key,
  provider text not null,
  licence_name text not null,
  licence_version text not null,
  purchase_reference text,           -- receipts themselves are stored outside the database
  permits_offline_cache boolean not null default false,
  permits_app_bundling boolean not null default false,
  attribution_text text,
  recorded_at timestamptz not null default now()
);

create table public.content_reviews (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('exercise', 'template', 'rules', 'copy')),
  subject_id text not null,
  subject_version text not null,
  decision text not null check (decision in ('approved', 'rejected', 'changes_requested')),
  reviewer_name text not null,       -- a real, qualified person; never filled by tooling
  reviewer_qualification text not null,
  evidence_reference text not null,
  notes text,
  reviewed_at timestamptz not null
);

create table public.exercises (
  id text primary key,
  provider text,
  provider_external_id text,
  content_version integer not null,
  data jsonb not null,               -- localized text, muscles, setup, cues, relationships
  licence_id text references public.licences (id),
  review_status text not null default 'not_reviewed' check (review_status in ('not_reviewed', 'approved', 'rejected')),
  disabled boolean not null default false,   -- operational kill switch
  updated_at timestamptz not null default now()
);

create table public.exercise_assets (
  id text primary key,
  exercise_id text not null references public.exercises (id) on delete cascade,
  media_type text not null,
  storage_path text not null,        -- private bucket path; never a public URL
  checksum_sha256 text not null,
  distribution_mode text not null check (distribution_mode in ('stream_only', 'private_cache', 'app_bundle')),
  licence_id text not null references public.licences (id),
  review_status text not null default 'not_reviewed' check (review_status in ('not_reviewed', 'approved', 'rejected'))
);

create table public.exercise_relations (
  from_exercise_id text not null references public.exercises (id) on delete cascade,
  to_exercise_id text not null references public.exercises (id) on delete cascade,
  relation text not null check (relation in ('alternative', 'regression', 'progression')),
  primary key (from_exercise_id, to_exercise_id, relation)
);

create table public.programme_templates (
  id text primary key,
  title text not null,
  disabled boolean not null default false
);

create table public.programme_versions (
  template_id text not null references public.programme_templates (id) on delete cascade,
  version integer not null,
  definition jsonb not null,
  review_status text not null default 'not_reviewed' check (review_status in ('not_reviewed', 'approved', 'rejected')),
  primary key (template_id, version)
);

create table public.feature_switches (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- User programme and training records
-- ---------------------------------------------------------------------------
create table public.user_programmes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  template_id text not null,
  template_version integer not null,
  days_per_week smallint not null check (days_per_week between 2 and 3),
  preferred_weekdays smallint[] not null,
  session_minutes smallint not null,
  start_date date not null,
  pause_from date,
  pause_until date,
  updated_at timestamptz not null default now()
);

create table public.scheduled_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  state text not null check (state in ('planned', 'rescheduled_here', 'paused')),
  primary key (user_id, local_date)
);

create table public.workout_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  status text not null check (status in ('active', 'completed', 'safety_stopped', 'abandoned')),
  outcome text check (outcome in ('full', 'partial', 'introductory', 'safety_stop', 'abandoned')),
  variant text,
  session_key text,
  check_in_method text check (check_in_method in ('manual', 'location_assisted')),
  check_in_at timestamptz,
  finished_at timestamptz,
  device_id text,
  updated_at timestamptz not null default now()
);
create index on public.workout_sessions (user_id, local_date);

create table public.workout_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  position integer,
  slot_id text,
  exercise_id text not null,
  status text,
  replaced_by uuid,
  substitution_reason text,
  prescription jsonb,                -- snapshot of what the user was shown
  content_version integer,
  updated_at timestamptz not null default now()
);

create table public.set_logs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  workout_exercise_id uuid not null,
  exercise_id text not null,
  set_index integer not null,
  kind text not null check (kind in ('warmup', 'working', 'familiarisation')),
  reps integer not null check (reps between 0 and 200),
  weight_value numeric(6, 2) check (weight_value between 0 and 1000),
  weight_unit text check (weight_unit in ('kg', 'lb')),
  load_basis text check (load_basis in ('total', 'per_hand', 'machine_stack')),
  effort text check (effort in ('easy', 'about_right', 'hard')),
  completed_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- Method, session and time only. No coordinates, no trails.
create table public.check_ins (
  session_id uuid primary key references public.workout_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  method text not null check (method in ('manual', 'location_assisted')),
  checked_in_at timestamptz not null
);

create table public.exercise_confidence (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  familiarity text not null check (familiarity in ('new', 'reminder', 'comfortable')),
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

-- ---------------------------------------------------------------------------
-- XP: immutable, deduplicated ledger. Totals are derived, never client-written.
-- ---------------------------------------------------------------------------
create table public.xp_ledger (
  user_id uuid not null references auth.users (id) on delete cascade,
  award_key text not null,
  kind text not null check (kind in ('check_in', 'mission', 'lesson', 'rest_day_learning')),
  amount integer not null,
  local_date date not null,
  session_id uuid,
  rules_version text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, award_key)
);

create table public.earned_milestones (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  local_date date not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, key)
);

create view public.xp_totals with (security_invoker = true) as
  select user_id, sum(amount)::integer as total from public.xp_ledger group by user_id;

-- ---------------------------------------------------------------------------
-- Billing (server-managed only)
-- ---------------------------------------------------------------------------
create table public.entitlements (
  user_id uuid not null references auth.users (id) on delete cascade,
  entitlement text not null,
  active boolean not null,
  expires_at timestamptz,
  store text,
  updated_at timestamptz not null default now(),
  primary key (user_id, entitlement)
);

create table public.billing_events (
  event_id text primary key,         -- provider event id: webhook replays are ignored
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sync bookkeeping
-- ---------------------------------------------------------------------------
create table public.sync_operations (
  op_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entity text not null,
  entity_id text not null,
  result text not null,
  applied_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'gym_profiles', 'consent_records', 'notification_preferences', 'licences', 'content_reviews',
    'exercises', 'exercise_assets', 'exercise_relations', 'programme_templates', 'programme_versions', 'feature_switches',
    'user_programmes', 'scheduled_sessions', 'workout_sessions', 'workout_exercises', 'set_logs', 'check_ins',
    'exercise_confidence', 'xp_ledger', 'earned_milestones', 'entitlements', 'billing_events', 'sync_operations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Own-row read/write tables.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'gym_profiles', 'notification_preferences', 'user_programmes', 'scheduled_sessions',
    'workout_sessions', 'workout_exercises', 'set_logs', 'check_ins', 'exercise_confidence'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy own_select on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy own_insert on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy own_update on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy own_delete on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Consent records are append-only for the owner.
grant select, insert on public.consent_records to authenticated;
create policy own_select on public.consent_records for select to authenticated using (user_id = (select auth.uid()));
create policy own_insert on public.consent_records for insert to authenticated with check (user_id = (select auth.uid()));

-- Read-only for owners; written only through apply_sync_operations / service role.
do $$
declare t text;
begin
  foreach t in array array['xp_ledger', 'earned_milestones', 'entitlements', 'sync_operations'] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy own_select on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;
grant select on public.xp_totals to authenticated;

-- Approved, enabled catalogue content is readable by signed-in users. Never writable by clients.
grant select on public.exercises, public.exercise_relations, public.programme_templates, public.programme_versions, public.feature_switches to authenticated;
create policy approved_read on public.exercises for select to authenticated using (review_status = 'approved' and not disabled);
create policy approved_read on public.exercise_relations for select to authenticated using (true);
create policy enabled_read on public.programme_templates for select to authenticated using (not disabled);
create policy approved_read on public.programme_versions for select to authenticated using (review_status = 'approved');
create policy read_all on public.feature_switches for select to authenticated using (true);
-- exercise_assets, licences, content_reviews, billing_events: no client grants at all.
-- Media is served by the media-url Edge Function as short-lived signed URLs for individual assets.

-- ---------------------------------------------------------------------------
-- Idempotent sync: each operation is applied at most once per op_id.
-- Conflict policy: a session completed on the server is immutable; edits to it
-- are rejected (the client keeps its local copy and surfaces the conflict).
-- ---------------------------------------------------------------------------
create or replace function public.apply_sync_operations(ops jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  op jsonb;
  p jsonb;
  results jsonb := '[]'::jsonb;
  op_result text;
  existing_status text;
  week_count integer;
  expected integer;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if jsonb_array_length(ops) > 100 then raise exception 'batch too large'; end if;

  for op in select * from jsonb_array_elements(ops) loop
    if exists (select 1 from sync_operations where op_id = (op->>'opId')::uuid) then
      results := results || jsonb_build_object('opId', op->>'opId', 'result', 'duplicate');
      continue;
    end if;
    p := op->'payload';
    op_result := 'applied';

    case op->>'entity'
      when 'workout_session' then
        select status into existing_status from workout_sessions where id = (p->>'id')::uuid and user_id = uid;
        if exists (select 1 from workout_sessions where id = (p->>'id')::uuid and user_id <> uid) then
          op_result := 'rejected_not_owner';
        elsif existing_status is not null and existing_status <> 'active' then
          op_result := 'conflict_completed_elsewhere';
        elsif existing_status = 'active' then
          update workout_sessions set
            status = coalesce(p->>'status', status),
            outcome = coalesce(p->>'outcome', outcome),
            finished_at = coalesce((p->>'finishedAt')::timestamptz, finished_at),
            updated_at = now()
          where id = (p->>'id')::uuid and user_id = uid;
        elsif p->>'localDate' is null or p->>'status' is null then
          op_result := 'retry_parent_missing';
        else
          insert into workout_sessions (id, user_id, local_date, status, outcome, variant, session_key, check_in_method, check_in_at, finished_at, device_id)
          values ((p->>'id')::uuid, uid, (p->>'localDate')::date, p->>'status', p->>'outcome', p->>'variant', p->>'sessionKey',
                  p->>'checkInMethod', (p->>'checkInAt')::timestamptz, (p->>'finishedAt')::timestamptz, p->>'deviceId');
          if p ? 'checkInMethod' then
            insert into check_ins (session_id, user_id, method, checked_in_at)
            values ((p->>'id')::uuid, uid, p->>'checkInMethod', (p->>'checkInAt')::timestamptz)
            on conflict (session_id) do nothing;
          end if;
        end if;

      when 'workout_exercise' then
        select s.status into existing_status from workout_exercises e join workout_sessions s on s.id = e.session_id
          where e.id = (p->>'id')::uuid and e.user_id = uid;
        if existing_status is not null then
          if existing_status <> 'active' then op_result := 'conflict_completed_elsewhere';
          else
            update workout_exercises set
              status = coalesce(p->>'status', status),
              replaced_by = coalesce((p->>'replacedBy')::uuid, replaced_by),
              substitution_reason = coalesce(p->>'reason', substitution_reason),
              updated_at = now()
            where id = (p->>'id')::uuid and user_id = uid;
          end if;
        else
          select status into existing_status from workout_sessions where id = (p->>'sessionId')::uuid and user_id = uid;
          if existing_status is null then op_result := 'retry_parent_missing';
          elsif existing_status <> 'active' then op_result := 'conflict_completed_elsewhere';
          else
            insert into workout_exercises (id, user_id, session_id, position, slot_id, exercise_id, status, replaced_by, substitution_reason, prescription, content_version)
            values ((p->>'id')::uuid, uid, (p->>'sessionId')::uuid, (p->>'position')::int, p->>'slotId', p->>'exerciseId', p->>'status',
                    (p->>'replacedBy')::uuid, p->>'reason', p->'prescription', (p->>'contentVersion')::int);
          end if;
        end if;

      when 'set_log' then
        select s.status into existing_status from set_logs l join workout_sessions s on s.id = l.session_id
          where l.id = (p->>'id')::uuid and l.user_id = uid;
        if existing_status is not null then
          if existing_status <> 'active' then op_result := 'conflict_completed_elsewhere';
          else
            update set_logs set
              reps = coalesce((p->>'reps')::int, reps),
              weight_value = case when p ? 'weight' then (p->'weight'->>'value')::numeric else weight_value end,
              weight_unit = case when p ? 'weight' then p->'weight'->>'unit' else weight_unit end,
              load_basis = case when p ? 'weight' then p->'weight'->>'basis' else load_basis end,
              effort = case when p ? 'effort' then p->>'effort' else effort end,
              updated_at = now()
            where id = (p->>'id')::uuid and user_id = uid;
          end if;
        else
          select status into existing_status from workout_sessions where id = (p->>'sessionId')::uuid and user_id = uid;
          if existing_status is null then op_result := 'retry_parent_missing';
          elsif existing_status <> 'active' then op_result := 'conflict_completed_elsewhere';
          else
            insert into set_logs (id, user_id, session_id, workout_exercise_id, exercise_id, set_index, kind, reps, weight_value, weight_unit, load_basis, effort, completed_at)
            values ((p->>'id')::uuid, uid, (p->>'sessionId')::uuid, (p->>'workoutExerciseId')::uuid, p->>'exerciseId', (p->>'setIndex')::int,
                    p->>'kind', (p->>'reps')::int, (p->'weight'->>'value')::numeric, p->'weight'->>'unit', p->'weight'->>'basis', p->>'effort',
                    (p->>'completedAt')::timestamptz);
          end if;
        end if;

      when 'exercise_confidence' then
        insert into exercise_confidence (user_id, exercise_id, familiarity) values (uid, p->>'exerciseId', p->>'familiarity')
        on conflict (user_id, exercise_id) do update set familiarity = excluded.familiarity, updated_at = now();

      when 'gym_profile' then
        insert into gym_profiles (user_id, label, equipment)
        values (uid, p->>'label', array(select jsonb_array_elements_text(p->'equipment')))
        on conflict (user_id) do update set label = excluded.label, equipment = excluded.equipment, updated_at = now();

      when 'xp_award' then
        -- Server-side validation: amount must match the kind, one award per key, weekly training cap.
        expected := case p->>'kind' when 'check_in' then 10 when 'mission' then 30 when 'lesson' then 5 when 'rest_day_learning' then 5 end;
        if expected is null or (p->>'amount')::int <> expected then
          op_result := 'rejected_invalid_amount';
        else
          if p->>'kind' in ('check_in', 'mission') then
            select count(*) into week_count from xp_ledger
              where user_id = uid and kind = p->>'kind'
                and date_trunc('week', local_date) = date_trunc('week', (p->>'localDate')::date);
            if week_count >= coalesce((select days_per_week from user_programmes where user_id = uid), 3) then
              op_result := 'rejected_weekly_cap';
            end if;
          end if;
          if op_result = 'applied' then
            insert into xp_ledger (user_id, award_key, kind, amount, local_date, session_id, rules_version)
            values (uid, p->>'awardKey', p->>'kind', expected, (p->>'localDate')::date, (p->>'sessionId')::uuid, p->>'rulesVersion')
            on conflict (user_id, award_key) do nothing;
          end if;
        end if;

      when 'milestone' then
        insert into earned_milestones (user_id, key, local_date) values (uid, p->>'key', (p->>'localDate')::date)
        on conflict (user_id, key) do nothing;

      else
        op_result := 'rejected_unknown_entity';
    end case;

    -- Retryable outcomes are not recorded, so the same op_id can be applied later.
    if op_result not like 'retry_%' then
      insert into sync_operations (op_id, user_id, entity, entity_id, result)
      values ((op->>'opId')::uuid, uid, op->>'entity', op->>'entityId', op_result);
    end if;
    results := results || jsonb_build_object('opId', op->>'opId', 'result', op_result);
  end loop;
  return results;
end;
$$;

revoke all on function public.apply_sync_operations(jsonb) from public, anon;
grant execute on function public.apply_sync_operations(jsonb) to authenticated;
