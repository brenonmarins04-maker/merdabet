-- Enables realtime updates needed by group member lists and return rankings.
-- Safe to run more than once.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'group_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'bet_placements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bet_placements;
  END IF;
END;
$$;
