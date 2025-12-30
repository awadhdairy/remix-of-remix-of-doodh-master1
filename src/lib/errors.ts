/**
 * Error sanitization utility to prevent exposing raw PostgreSQL errors to users
 */

// Common PostgreSQL error codes mapped to user-friendly messages
const PG_ERROR_MESSAGES: Record<string, string> = {
  "23505": "This record already exists.",
  "23503": "This operation references data that doesn't exist.",
  "23502": "Required information is missing.",
  "23514": "The provided data doesn't meet the requirements.",
  "42501": "You don't have permission to perform this action.",
  "42P01": "The requested resource could not be found.",
  "28P01": "Authentication failed.",
  "P0001": "This operation is not allowed.",
  "PGRST301": "You don't have permission to access this resource.",
  "PGRST116": "No matching record found.",
};

// RLS-related error patterns
const RLS_ERROR_PATTERNS = [
  /row-level security/i,
  /violates row-level security policy/i,
  /permission denied/i,
  /new row violates/i,
];

// Auth-related error patterns
const AUTH_ERROR_PATTERNS = [
  /invalid.*credentials/i,
  /user not found/i,
  /email.*already.*registered/i,
  /password.*too.*weak/i,
  /account.*locked/i,
];

interface PostgrestError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

interface SupabaseError {
  error?: PostgrestError;
  message?: string;
  code?: string;
}

/**
 * Sanitizes database and API errors to prevent information leakage
 * @param error - The error object from Supabase or other sources
 * @param fallbackMessage - Optional custom fallback message
 * @returns User-safe error message
 */
export function sanitizeError(
  error: unknown,
  fallbackMessage = "An unexpected error occurred. Please try again."
): string {
  if (!error) return fallbackMessage;

  // Handle string errors
  if (typeof error === "string") {
    return sanitizeErrorMessage(error, fallbackMessage);
  }

  // Handle Error objects
  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message, fallbackMessage);
  }

  // Handle Supabase/Postgrest errors
  const supabaseError = error as SupabaseError;
  
  // Check for PostgreSQL error code
  const code = supabaseError.code || supabaseError.error?.code;
  if (code && PG_ERROR_MESSAGES[code]) {
    return PG_ERROR_MESSAGES[code];
  }

  // Check the message
  const message = supabaseError.message || supabaseError.error?.message;
  if (message) {
    return sanitizeErrorMessage(message, fallbackMessage);
  }

  return fallbackMessage;
}

/**
 * Sanitizes an error message string
 */
function sanitizeErrorMessage(message: string, fallback: string): string {
  // Check for RLS errors
  if (RLS_ERROR_PATTERNS.some(pattern => pattern.test(message))) {
    return "You don't have permission to perform this action.";
  }

  // Check for auth errors (these are usually safe to show)
  if (AUTH_ERROR_PATTERNS.some(pattern => pattern.test(message))) {
    // Return a generic auth error to prevent user enumeration
    return "Authentication failed. Please check your credentials.";
  }

  // Check for account locked error (specific case)
  if (/account.*temporarily.*locked/i.test(message) || /try again later/i.test(message)) {
    return "Account temporarily locked. Please try again later.";
  }

  // Check for network errors
  if (/network/i.test(message) || /fetch/i.test(message) || /connection/i.test(message)) {
    return "Network error. Please check your connection and try again.";
  }

  // If message looks technical (contains SQL, table names, etc.), use fallback
  if (
    /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|TABLE|COLUMN|INDEX)\b/i.test(message) ||
    /\b(public\.|auth\.|storage\.)\b/.test(message) ||
    /\b(uuid|varchar|integer|boolean|timestamp)\b/i.test(message)
  ) {
    return fallback;
  }

  // For non-technical looking messages, we can show them but truncate if too long
  if (message.length > 100) {
    return fallback;
  }

  return message;
}

/**
 * Logs error details for debugging while returning sanitized message for users
 * Use this in catch blocks for comprehensive error handling
 */
export function handleError(
  error: unknown,
  context: string,
  fallbackMessage?: string
): string {
  // Log full error for debugging (only in development)
  if (import.meta.env.DEV) {
    console.error(`[${context}] Error:`, error);
  }

  return sanitizeError(error, fallbackMessage);
}
