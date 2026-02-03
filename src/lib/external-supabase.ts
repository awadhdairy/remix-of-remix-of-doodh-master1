import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// External Supabase credentials - configured via environment variables
// These should be set in Vercel (production) or .env (local development)
const EXTERNAL_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ohrytohcbbkorivsuukm.supabase.co';
const EXTERNAL_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnl0b2hjYmJrb3JpdnN1dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTI0ODUsImV4cCI6MjA4NTY4ODQ4NX0.IRvIKtTaxZ5MYm6Ju30cxHMQG5xCq9tWJOfSFbNAIUg';

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
