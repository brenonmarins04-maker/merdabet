-- Migration: dynamic unilateral odds
-- Safe to run on a live database. It preserves existing bets and backfills odds.

-- Wider precision for long-running dynamic odds.
ALTER TABLE pending_bets ALTER COLUMN odd TYPE numeric(10,2);
ALTER TABLE bets ALTER COLUMN odd TYPE numeric(10,2);
ALTER TABLE bets ALTER COLUMN dispute_new_odd TYPE numeric(10,2);

ALTER TABLE bets ADD COLUMN IF NOT EXISTS initial_odd numeric(10,2);
ALTER TABLE bets ADD COLUMN IF NOT EXISTS current_odd numeric(10,2);
ALTER TABLE bets ADD COLUMN IF NOT EXISTS validated_at timestamptz;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS odd_time_block integer NOT NULL DEFAULT 0;
ALTER TABLE bet_placements ADD COLUMN IF NOT EXISTS locked_odd numeric(10,2);

UPDATE bets
SET
  initial_odd = COALESCE(initial_odd, odd, 2.00),
  current_odd = COALESCE(current_odd, odd, 2.00),
  validated_at = COALESCE(validated_at, created_at, now()),
  placements_count = (
    SELECT COUNT(*)
    FROM bet_placements
    WHERE bet_placements.bet_id = bets.id
  ),
  total_wagered = (
    SELECT COALESCE(SUM(amount), 0)
    FROM bet_placements
    WHERE bet_placements.bet_id = bets.id
  ),
  odd_time_block = GREATEST(
    0,
    FLOOR(EXTRACT(EPOCH FROM (now() - COALESCE(validated_at, created_at, now()))) / 1800)::integer
  );

ALTER TABLE bets ALTER COLUMN initial_odd SET DEFAULT 2.00;
ALTER TABLE bets ALTER COLUMN current_odd SET DEFAULT 2.00;
ALTER TABLE bets ALTER COLUMN validated_at SET DEFAULT now();
ALTER TABLE bets ALTER COLUMN initial_odd SET NOT NULL;
ALTER TABLE bets ALTER COLUMN current_odd SET NOT NULL;
ALTER TABLE bets ALTER COLUMN validated_at SET NOT NULL;

UPDATE bet_placements
SET locked_odd = ROUND(GREATEST(1.01, COALESCE(bets.current_odd, bets.odd, bets.initial_odd, 1.01)), 2)
FROM bets
WHERE bets.id = bet_placements.bet_id
  AND bet_placements.locked_odd IS NULL;

ALTER TABLE bet_placements ALTER COLUMN locked_odd SET DEFAULT 1.01;
ALTER TABLE bet_placements ALTER COLUMN locked_odd SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bets_active_dynamic_odds
  ON bets (resolved, odd_time_block, validated_at);

CREATE INDEX IF NOT EXISTS idx_bet_placements_bet_id
  ON bet_placements (bet_id);

CREATE OR REPLACE FUNCTION public.prepare_bet_dynamic_odd()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.initial_odd := COALESCE(NEW.initial_odd, NEW.odd, 2.00);
  NEW.current_odd := COALESCE(NEW.current_odd, NEW.odd, NEW.initial_odd, 2.00);
  NEW.odd := NEW.current_odd;
  NEW.validated_at := COALESCE(NEW.validated_at, NEW.created_at, now());
  NEW.odd_time_block := COALESCE(
    NEW.odd_time_block,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - NEW.validated_at)) / 1800)::integer)
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_dynamic_odd(
  p_bet_id text,
  p_reference_time timestamptz DEFAULT now()
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
BEGIN
  SELECT
    parties.group_id,
    COALESCE(bets.initial_odd, bets.odd, 2.00),
    COALESCE(bets.validated_at, bets.created_at, now())
  INTO v_group_id, v_initial_odd, v_validated_at
  FROM bets
  JOIN parties ON parties.id = bets.party_id
  WHERE bets.id = p_bet_id
    AND bets.resolved IS NULL;

  IF v_group_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT GREATEST(
    COALESCE(NULLIF(COUNT(group_members.user_id), 0), MAX(groups.members), 1),
    1
  )::numeric
  INTO v_group_size
  FROM groups
  LEFT JOIN group_members ON group_members.group_id = groups.id
  WHERE groups.id = v_group_id;

  SELECT COALESCE(SUM(users.balance), 0)::numeric
  INTO v_group_balance
  FROM group_members
  JOIN users ON users.id = group_members.user_id
  WHERE group_members.group_id = v_group_id;

  SELECT
    COALESCE(SUM(amount), 0)::numeric,
    COUNT(DISTINCT user_id)::numeric
  INTO v_volume, v_unique_placers
  FROM bet_placements
  WHERE bet_id = p_bet_id;

  v_liquidity := v_group_balance * 0.25;
  v_time_blocks := GREATEST(
    0,
    FLOOR(EXTRACT(EPOCH FROM (p_reference_time - v_validated_at)) / 1800)::integer
  );

  v_base_odd := v_initial_odd + (v_time_blocks * 0.20);

  v_volume_factor := CASE
    WHEN v_liquidity <= 0 AND v_volume <= 0 THEN 1
    WHEN v_liquidity <= 0 THEN 0
    ELSE v_liquidity / (v_volume + v_liquidity)
  END;

  v_herd_factor := 1 - (LEAST(v_unique_placers / v_group_size, 1) * 0.20);
  v_final_odd := ROUND(GREATEST(1.01, v_base_odd * v_volume_factor * v_herd_factor), 2);

  RETURN v_final_odd;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_dynamic_odd(
  p_bet_id text,
  p_reference_time timestamptz DEFAULT now()
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_final_odd numeric;
  v_time_block integer;
BEGIN
  SELECT GREATEST(
    0,
    FLOOR(EXTRACT(EPOCH FROM (p_reference_time - COALESCE(validated_at, created_at, now()))) / 1800)::integer
  )
  INTO v_time_block
  FROM bets
  WHERE id = p_bet_id
    AND resolved IS NULL;

  IF v_time_block IS NULL THEN
    RETURN NULL;
  END IF;

  v_final_odd := public.calculate_dynamic_odd(p_bet_id, p_reference_time);

  IF v_final_odd IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE bets
  SET
    current_odd = v_final_odd,
    odd = v_final_odd,
    odd_time_block = v_time_block,
    placements_count = (
      SELECT COUNT(*)
      FROM bet_placements
      WHERE bet_placements.bet_id = bets.id
    ),
    total_wagered = (
      SELECT COALESCE(SUM(amount), 0)
      FROM bet_placements
      WHERE bet_placements.bet_id = bets.id
    )
  WHERE id = p_bet_id
    AND resolved IS NULL;

  RETURN v_final_odd;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_dynamic_odd_after_bet_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_dynamic_odd(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_bet_placement_odd()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked_odd numeric;
BEGIN
  SELECT COALESCE(current_odd, odd, initial_odd, 1.01)
  INTO v_locked_odd
  FROM bets
  WHERE id = NEW.bet_id;

  NEW.locked_odd := ROUND(GREATEST(1.01, COALESCE(v_locked_odd, 1.01)), 2);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_dynamic_odd_after_placement_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_dynamic_odd(NEW.bet_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_due_dynamic_odds(
  p_reference_time timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet record;
  v_updated_count integer := 0;
BEGIN
  FOR v_bet IN
    SELECT
      id,
      GREATEST(
        0,
        FLOOR(EXTRACT(EPOCH FROM (p_reference_time - COALESCE(validated_at, created_at, now()))) / 1800)::integer
      ) AS current_block
    FROM bets
    WHERE resolved IS NULL
  LOOP
    IF v_bet.current_block > COALESCE((SELECT odd_time_block FROM bets WHERE id = v_bet.id), 0) THEN
      PERFORM public.recalculate_dynamic_odd(v_bet.id, p_reference_time);
      v_updated_count := v_updated_count + 1;
    END IF;
  END LOOP;

  RETURN v_updated_count;
END;
$$;

DROP TRIGGER IF EXISTS trg_prepare_bet_dynamic_odd ON bets;
CREATE TRIGGER trg_prepare_bet_dynamic_odd
BEFORE INSERT ON bets
FOR EACH ROW
EXECUTE FUNCTION public.prepare_bet_dynamic_odd();

DROP TRIGGER IF EXISTS trg_recalculate_dynamic_odd_after_bet_insert ON bets;
CREATE TRIGGER trg_recalculate_dynamic_odd_after_bet_insert
AFTER INSERT ON bets
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_dynamic_odd_after_bet_insert();

DROP TRIGGER IF EXISTS trg_lock_bet_placement_odd ON bet_placements;
CREATE TRIGGER trg_lock_bet_placement_odd
BEFORE INSERT ON bet_placements
FOR EACH ROW
EXECUTE FUNCTION public.lock_bet_placement_odd();

DROP TRIGGER IF EXISTS trg_recalculate_dynamic_odd_after_placement_insert ON bet_placements;
CREATE TRIGGER trg_recalculate_dynamic_odd_after_placement_insert
AFTER INSERT ON bet_placements
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_dynamic_odd_after_placement_insert();

SELECT public.recalculate_dynamic_odd(id)
FROM bets
WHERE resolved IS NULL;

-- Supabase Cron uses the pg_cron extension and stores jobs in cron.job.
-- If your project has Cron enabled, this schedules the time inflation check every 5 minutes.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'recalculate-dynamic-odds';

SELECT cron.schedule(
  'recalculate-dynamic-odds',
  '*/5 * * * *',
  'SELECT public.recalculate_due_dynamic_odds();'
);
