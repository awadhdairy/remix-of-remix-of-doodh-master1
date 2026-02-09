/**
 * Shared CORS configuration for all Edge Functions
 * Issue 4.3 Fix: Replace wildcard (*) with origin whitelist
 */

export const ALLOWED_ORIGINS = [
  'https://admin.awadhdairy.com',           // PRIMARY production domain
  'https://awadhdairyfinal.vercel.app',
  'https://awadh-dairy.vercel.app',
  'https://awadhdairy.vercel.app',
  'https://id-preview--fe319f03-610b-496f-b31c-17c1dc16ca01.lovable.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
];

export function getCorsHeaders(origin: string | null): Record<string, string> {
  // Check if origin is in allowed list (or starts with an allowed origin)
  const isAllowed = origin && ALLOWED_ORIGINS.some(allowed => 
    origin === allowed || origin.startsWith(allowed.replace(/\/$/, '') + '/')
  );
  
  // Use the requesting origin if allowed, otherwise use the first allowed origin
  const allowedOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPrelight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response(null, { headers: getCorsHeaders(origin) });
  }
  return null;
}
