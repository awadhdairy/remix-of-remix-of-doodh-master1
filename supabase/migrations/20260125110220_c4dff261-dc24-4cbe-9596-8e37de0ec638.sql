-- Enable pgcrypto extension for gen_salt and crypt functions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Grant usage to public schema functions
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;