import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// =============================================================================
// EXTERNAL SUPABASE CONFIGURATION - 100% Independent of Lovable Cloud
// =============================================================================
//
// PROBLEM: Lovable "Secrets" are only available in Edge Functions (Deno env).
// They are NOT available as import.meta.env.* in the frontend Vite build.
// The auto-generated .env file points to the old Lovable Cloud project.
//
// SOLUTION: Detect environment and use hardcoded values for Lovable preview,
// use VITE_* env vars for Vercel production deployment.
// =============================================================================

// Your External Supabase Project Credentials (iupmzocmmjxpeabkmzri)
// These are PUBLIC anon keys - safe to include in frontend code
const HARDCODED_EXTERNAL_URL = 'https://iupmzocmmjxpeabkmzri.supabase.co';
const HARDCODED_EXTERNAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cG16b2NtbWp4cGVhYmttenJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNjAyNjYsImV4cCI6MjA4NTgzNjI2Nn0.UH-Y9FgzjErzJ_MWvkKaZEp8gfSbB1fuoJ_JuMLPEK8';

// ALWAYS use hardcoded credentials for reliability across all environments
// This ensures both Lovable preview AND Vercel use the same external Supabase project
const EXTERNAL_URL = HARDCODED_EXTERNAL_URL;
const EXTERNAL_ANON_KEY = HARDCODED_EXTERNAL_ANON_KEY;

// Log connection info (helpful for debugging)
console.log('[Supabase] Connecting to:', EXTERNAL_URL.replace(/https?:\/\//, '').split('.')[0]);

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

/**
 * Helper function to invoke edge functions on the external Supabase project
 * This ensures all function calls go to YOUR Supabase project, not Lovable Cloud
 */
export async function invokeExternalFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown> = {},
  authToken?: string
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': EXTERNAL_ANON_KEY,
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${EXTERNAL_FUNCTIONS_URL}/${functionName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return { 
        data: null, 
        error: new Error(data.error || `Function call failed with status ${response.status}`) 
      };
    }

    return { data: data as T, error: null };
  } catch (error) {
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Unknown error occurred') 
    };
  }
}

/**
 * Get the current user's auth token for authenticated edge function calls
 */
export async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await externalSupabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Session-aware edge function invocation
 * Automatically handles both staff auth (session_token in localStorage) 
 * and customer auth (Supabase Auth JWT)
 * 
 * This ensures all edge function calls go to the EXTERNAL Supabase project,
 * never to Lovable Cloud
 */
export async function invokeExternalFunctionWithSession<T = unknown>(
  functionName: string,
  body: Record<string, unknown> = {}
): Promise<{ data: T | null; error: Error | null }> {
  // Get Supabase Auth session (this is the primary auth mechanism)
  const { data: { session }, error: sessionError } = await externalSupabase.auth.getSession();
  
  if (sessionError) {
    console.warn('Session error:', sessionError.message);
  }
  
  const authToken = session?.access_token;
  
  if (!authToken) {
    console.warn(`No auth token available for ${functionName}`);
  }
  
  return invokeExternalFunction<T>(functionName, body, authToken || undefined);
}
