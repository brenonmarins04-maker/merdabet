-- Migration: add dispute + placements columns to existing tables
-- Safe to run on a live database — uses ADD COLUMN IF NOT EXISTS
-- Run this in the Supabase SQL Editor (does NOT delete any data)

-- 1. bets: new columns
ALTER TABLE bets ADD COLUMN IF NOT EXISTS placements_count   integer       not null default 0;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS dispute_type       text          check (dispute_type in ('change_odd', 'delete'));
ALTER TABLE bets ADD COLUMN IF NOT EXISTS dispute_new_odd    numeric(5,2);
ALTER TABLE bets ADD COLUMN IF NOT EXISTS dispute_approvals  integer       not null default 0;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS dispute_rejections integer       not null default 0;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS dispute_needed     integer       not null default 1;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS dispute_status     text          not null default 'none'
  check (dispute_status in ('none', 'pending', 'approved', 'rejected'));

-- 2. pending_bets: rejections counter
ALTER TABLE pending_bets ADD COLUMN IF NOT EXISTS rejections integer not null default 0;

-- 3. bet_dispute_votes table (votes on dispute requests)
CREATE TABLE IF NOT EXISTS bet_dispute_votes (
  bet_id  text not null references bets(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  vote    text not null check (vote in ('approve', 'reject')),
  primary key (bet_id, user_id)
);

ALTER TABLE bet_dispute_votes DISABLE ROW LEVEL SECURITY;
