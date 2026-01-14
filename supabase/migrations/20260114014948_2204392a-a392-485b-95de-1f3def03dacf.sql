-- Remove the pg_cron keep-alive job if it exists
DO $$
BEGIN
  -- Check if cron extension exists before trying to unschedule
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('keep-alive-ping');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Job might not exist, that's fine
  NULL;
END $$;

-- Drop the keep_alive_ping function that was inserting into activity_logs
DROP FUNCTION IF EXISTS public.keep_alive_ping();