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
  odd numeric(5,2) not null,
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
  odd numeric(5,2) not null,
  votes_happened integer not null default 0,
  votes_not integer not null default 0,
  resolved text check (resolved in ('happened', 'not')),
  placements_count integer not null default 0,
  dispute_type text check (dispute_type in ('change_odd', 'delete')),
  dispute_new_odd numeric(5,2),
  dispute_approvals integer not null default 0,
  dispute_rejections integer not null default 0,
  dispute_needed integer not null default 1,
  dispute_status text not null default 'none' check (dispute_status in ('none', 'pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

-- Bet placements (who bet how much)
create table bet_placements (
  bet_id text not null references bets(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  amount integer not null,
  primary key (bet_id, user_id)
);

-- Outcome votes on live bets
create table bet_votes (
  bet_id text not null references bets(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  vote text not null check (vote in ('happened', 'not')),
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

-- ─── Realtime: enable on key tables ──────────────────────────────────────────
alter publication supabase_realtime add table users;
alter publication supabase_realtime add table groups;
alter publication supabase_realtime add table parties;
alter publication supabase_realtime add table pending_bets;
alter publication supabase_realtime add table bets;
alter publication supabase_realtime add table esmolas;
