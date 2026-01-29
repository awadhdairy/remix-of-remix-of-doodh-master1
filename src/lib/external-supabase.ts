import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// External Supabase credentials - completely separate from Lovable Cloud
const EXTERNAL_URL = 'https://htsfxnuttobkdquxwvjj.supabase.co';
const EXTERNAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0c2Z4bnV0dG9ia2RxdXh3dmpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1ODQ1ODgsImV4cCI6MjA4NTE2MDU4OH0.kM-uVIvO_bGqBeBQgoXBLlzTbTyQGVRgL6aVYMG2OcM';

// Create the external Supabase client with proper typing
export const externalSupabase = createClient<Database>(EXTERNAL_URL, EXTERNAL_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Edge function base URL for external Supabase
export const EXTERNAL_FUNCTIONS_URL = `${EXTERNAL_URL}/functions/v1`;

// Export URL for edge function calls
export const EXTERNAL_SUPABASE_URL = EXTERNAL_URL;
