-- Add unique constraint for milk_production upsert to work
-- This allows updating existing records for the same cattle/date/session combination
ALTER TABLE public.milk_production
ADD CONSTRAINT milk_production_cattle_date_session_unique 
UNIQUE (cattle_id, production_date, session);