-- MerdaBet full schema
-- Run this in Supabase SQL Editor to set up the database from scratch.
-- Safe to re-run: uses DROP IF EXISTS cascade.

drop table if exists bet_dispute_votes cascade;
drop table if exists bet_votes cascade;
drop table if exists bet_placements cascade;
drop table if exists bets cascade;
drop table if exists pending_bet_votes cascade;
drop table if exists pending_bets cascade;
drop table if exists party_attendees cascade;
drop table if exists esmolas cascade;
drop table if exists parties cascade;
drop table if exists group_members cascade;
drop table if exists groups cascade;
drop table if exists users cascade;

-- Custom auth users (no Supabase Auth)
create table users (
  id text primary key,
  password text not null,
  balance integer not null default 50,
  bet_count integer not null default 0,
  created_at timestamptz default now()
);

-- Groups (visible to everyone)
create table groups (
  id text primary key,
  name text not null,
  password text not null,
  created_by text not null references users(id) on delete cascade,
  members integer not null default 1,
  created_at timestamptz default now()
);

-- Group members (tracks who joined each group)
create table group_members (
  group_id text not null references groups(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  primary key (group_id, user_id)
);

-- Parties
create table parties (
  id text primary key,
  group_id text not null references groups(id) on delete cascade,
  name text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'pending',
  attendees integer not null default 0,
  created_at timestamptz default now()
);

-- Party attendees
create table party_attendees (
  party_id text not null references parties(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  primary key (party_id, user_id)
);

-- Esmolas (per group)
create table esmolas (
  id text primary key,
  group_id text not null references groups(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  amount integer not null,
  donated boolean not null default false,
  created_at timestamptz default now()
);

-- Pending bets (awaiting approval)
create table pending_bets (
  id text primary key,
  party_id text not null references parties(id) on delete cascade,
  description text not null,
  odd numeric(10,2) not null,
  approvals integer not null default 0,
  rejections integer not null default 0,
  needed integer not null default 1,
  created_at timestamptz default now()
);

-- Votes on pending bets (per user)
create table pending_bet_votes (
  pending_bet_id text not null references pending_bets(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  vote text not null check (vote in ('approve', 'reject')),
  primary key (pending_bet_id, user_id)
);

-- Live bets
create table bets (
  id text primary key,
  party_id text not null references parties(id) on delete cascade,
  description text not null,
  odd numeric(10,2) not null,
  initial_odd numeric(10,2) not null default 2.00,
  current_odd numeric(10,2) not null default 2.00,
  votes_happened integer not null default 0,
  votes_not integer not null default 0,
  resolved text check (resolved in ('happened', 'not')),
  placements_count integer not null default 0,
  total_wagered integer not null default 0,
  dispute_type text check (dispute_type in ('change_odd', 'delete')),
  dispute_new_odd numeric(10,2),
  dispute_approvals integer not null default 0,
  dispute_rejections integer not null default 0,
  dispute_needed integer not null default 1,
  dispute_status text not null default 'none' check (dispute_status in ('none', 'pending', 'approved', 'rejected')),
  validated_at timestamptz not null default now(),
  odd_time_block integer not null default 0,
  created_at timestamptz default now()
);

-- Bet placements (who bet how much)
create table bet_placements (
  bet_id text not null references bets(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  amount integer not null,
  locked_odd numeric(10,2) not null default 1.01,
  primary key (bet_id, user_id)
);

-- Outcome votes on live bets
create table bet_votes (
  bet_id text not null references bets(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  vote text not null check (vote in ('happened', 'not', 'unsure')),
  primary key (bet_id, user_id)
);

-- Dispute votes on live bets
create table bet_dispute_votes (
  bet_id text not null references bets(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  vote text not null check (vote in ('approve', 'reject')),
  primary key (bet_id, user_id)
);

-- ─── RLS: open anon access (custom auth, no Supabase Auth) ───────────────────
-- Disable RLS on all tables so the anon key can read and write freely.

alter table users disable row level security;
alter table groups disable row level security;
alter table group_members disable row level security;
alter table parties disable row level security;
alter table party_attendees disable row level security;
alter table esmolas disable row level security;
alter table pending_bets disable row level security;
alter table pending_bet_votes disable row level security;
alter table bets disable row level security;
alter table bet_placements disable row level security;
alter table bet_votes disable row level security;
alter table bet_dispute_votes disable row level security;

-- Dynamic unilateral odds
create index idx_bets_active_dynamic_odds
  on bets (resolved, odd_time_block, validated_at);

create index idx_bet_placements_bet_id
  on bet_placements (bet_id);

create or replace function public.prepare_bet_dynamic_odd()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.initial_odd := coalesce(new.initial_odd, new.odd, 2.00);
  new.current_odd := coalesce(new.current_odd, new.odd, new.initial_odd, 2.00);
  new.odd := new.current_odd;
  new.validated_at := coalesce(new.validated_at, new.created_at, now());
  new.odd_time_block := coalesce(
    new.odd_time_block,
    greatest(0, floor(extract(epoch from (now() - new.validated_at)) / 1800)::integer)
  );

  return new;
end;
$$;

create or replace function public.calculate_dynamic_odd(
  p_bet_id text,
  p_reference_time timestamptz default now()
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id text;
  v_initial_odd numeric;
  v_validated_at timestamptz;
  v_group_size numeric;
  v_group_balance numeric;
  v_liquidity numeric;
  v_volume numeric;
  v_unique_placers numeric;
  v_time_blocks integer;
  v_base_odd numeric;
  v_volume_factor numeric;
  v_herd_factor numeric;
  v_final_odd numeric;
begin
  select
    parties.group_id,
    coalesce(bets.initial_odd, bets.odd, 2.00),
    coalesce(bets.validated_at, bets.created_at, now())
  into v_group_id, v_initial_odd, v_validated_at
  from bets
  join parties on parties.id = bets.party_id
  where bets.id = p_bet_id
    and bets.resolved is null;

  if v_group_id is null then
    return null;
  end if;

  select greatest(
    coalesce(nullif(count(group_members.user_id), 0), max(groups.members), 1),
    1
  )::numeric
  into v_group_size
  from groups
  left join group_members on group_members.group_id = groups.id
  where groups.id = v_group_id;

  select coalesce(sum(users.balance), 0)::numeric
  into v_group_balance
  from group_members
  join users on users.id = group_members.user_id
  where group_members.group_id = v_group_id;

  select
    coalesce(sum(amount), 0)::numeric,
    count(distinct user_id)::numeric
  into v_volume, v_unique_placers
  from bet_placements
  where bet_id = p_bet_id;

  v_liquidity := v_group_balance * 0.25;
  v_time_blocks := greatest(
    0,
    floor(extract(epoch from (p_reference_time - v_validated_at)) / 1800)::integer
  );

  v_base_odd := v_initial_odd + (v_time_blocks * 0.20);

  v_volume_factor := case
    when v_liquidity <= 0 and v_volume <= 0 then 1
    when v_liquidity <= 0 then 0
    else v_liquidity / (v_volume + v_liquidity)
  end;

  v_herd_factor := 1 - (least(v_unique_placers / v_group_size, 1) * 0.20);
  v_final_odd := round(greatest(1.01, v_base_odd * v_volume_factor * v_herd_factor), 2);

  return v_final_odd;
end;
$$;

create or replace function public.recalculate_dynamic_odd(
  p_bet_id text,
  p_reference_time timestamptz default now()
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_final_odd numeric;
  v_time_block integer;
begin
  select greatest(
    0,
    floor(extract(epoch from (p_reference_time - coalesce(validated_at, created_at, now()))) / 1800)::integer
  )
  into v_time_block
  from bets
  where id = p_bet_id
    and resolved is null;

  if v_time_block is null then
    return null;
  end if;

  v_final_odd := public.calculate_dynamic_odd(p_bet_id, p_reference_time);

  if v_final_odd is null then
    return null;
  end if;

  update bets
  set
    current_odd = v_final_odd,
    odd = v_final_odd,
    odd_time_block = v_time_block,
    placements_count = (
      select count(*)
      from bet_placements
      where bet_placements.bet_id = bets.id
    ),
    total_wagered = (
      select coalesce(sum(amount), 0)
      from bet_placements
      where bet_placements.bet_id = bets.id
    )
  where id = p_bet_id
    and resolved is null;

  return v_final_odd;
end;
$$;

create or replace function public.recalculate_dynamic_odd_after_bet_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_dynamic_odd(new.id);
  return new;
end;
$$;

create or replace function public.lock_bet_placement_odd()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked_odd numeric;
begin
  select coalesce(current_odd, odd, initial_odd, 1.01)
  into v_locked_odd
  from bets
  where id = new.bet_id;

  new.locked_odd := round(greatest(1.01, coalesce(v_locked_odd, 1.01)), 2);
  return new;
end;
$$;

create or replace function public.recalculate_dynamic_odd_after_placement_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_dynamic_odd(new.bet_id);
  return new;
end;
$$;

create or replace function public.recalculate_due_dynamic_odds(
  p_reference_time timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bet record;
  v_updated_count integer := 0;
begin
  for v_bet in
    select
      id,
      greatest(
        0,
        floor(extract(epoch from (p_reference_time - coalesce(validated_at, created_at, now()))) / 1800)::integer
      ) as current_block
    from bets
    where resolved is null
  loop
    if v_bet.current_block > coalesce((select odd_time_block from bets where id = v_bet.id), 0) then
      perform public.recalculate_dynamic_odd(v_bet.id, p_reference_time);
      v_updated_count := v_updated_count + 1;
    end if;
  end loop;

  return v_updated_count;
end;
$$;

create trigger trg_prepare_bet_dynamic_odd
before insert on bets
for each row
execute function public.prepare_bet_dynamic_odd();

create trigger trg_recalculate_dynamic_odd_after_bet_insert
after insert on bets
for each row
execute function public.recalculate_dynamic_odd_after_bet_insert();

create trigger trg_lock_bet_placement_odd
before insert on bet_placements
for each row
execute function public.lock_bet_placement_odd();

create trigger trg_recalculate_dynamic_odd_after_placement_insert
after insert on bet_placements
for each row
execute function public.recalculate_dynamic_odd_after_placement_insert();

-- ─── Realtime: enable on key tables ──────────────────────────────────────────
alter publication supabase_realtime add table users;
alter publication supabase_realtime add table groups;
alter publication supabase_realtime add table group_members;
alter publication supabase_realtime add table parties;
alter publication supabase_realtime add table pending_bets;
alter publication supabase_realtime add table bets;
alter publication supabase_realtime add table bet_placements;
alter publication supabase_realtime add table esmolas;
