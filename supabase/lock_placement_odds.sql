-- Locks the payable odd at the exact moment a user places a bet.
-- Run this after supabase/dynamic_odds.sql.

ALTER TABLE bet_placements ADD COLUMN IF NOT EXISTS locked_odd numeric(10,2);

UPDATE bet_placements
SET locked_odd = ROUND(GREATEST(1.01, COALESCE(bets.current_odd, bets.odd, bets.initial_odd, 1.01)), 2)
FROM bets
WHERE bets.id = bet_placements.bet_id
  AND bet_placements.locked_odd IS NULL;

ALTER TABLE bet_placements ALTER COLUMN locked_odd SET DEFAULT 1.01;
ALTER TABLE bet_placements ALTER COLUMN locked_odd SET NOT NULL;

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

DROP TRIGGER IF EXISTS trg_lock_bet_placement_odd ON bet_placements;
CREATE TRIGGER trg_lock_bet_placement_odd
BEFORE INSERT ON bet_placements
FOR EACH ROW
EXECUTE FUNCTION public.lock_bet_placement_odd();
