import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Session storage key
const SESSION_KEY = 'awadh_staff_session';

// Type definitions for RPC responses
interface LoginResponse {
  success: boolean;
  error?: string;
  session_token?: string;
  user?: StaffUser;
}

interface ValidateSessionResponse {
  success: boolean;
  error?: string;
  user_type?: string;
  user?: StaffUser;
}

interface BootstrapResponse {
  success: boolean;
  error?: string;
  message?: string;
  user_id?: string;
}

interface StaffUser {
  id: string;
  full_name: string;
  phone: string;
  role: string;
}

interface StaffSession {
  session_token: string;
  user: StaffUser;
  expires_at: string;
}

interface StaffAuthContextType {
  user: StaffUser | null;
  sessionToken: string | null;
  loading: boolean;
  login: (phone: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  bootstrap: (phone: string, pin: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  refreshSession: () => Promise<boolean>;
}

const StaffAuthContext = createContext<StaffAuthContextType | undefined>(undefined);

export function StaffAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedSession = localStorage.getItem(SESSION_KEY);
        if (storedSession) {
          const session: StaffSession = JSON.parse(storedSession);
          
          // Check if session is expired locally first
          if (new Date(session.expires_at) < new Date()) {
            localStorage.removeItem(SESSION_KEY);
            setLoading(false);
            return;
          }

          // Validate session with server
          const { data, error } = await supabase.rpc('validate_session', {
            _session_token: session.session_token
          });

          const response = data as unknown as ValidateSessionResponse;

          if (error || !response?.success) {
            localStorage.removeItem(SESSION_KEY);
            setLoading(false);
            return;
          }

          if (response.user) {
            setUser(response.user);
            setSessionToken(session.session_token);
          }
        }
      } catch (err) {
        console.error('Error loading session:', err);
        localStorage.removeItem(SESSION_KEY);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, []);

  const login = useCallback(async (phone: string, pin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.rpc('staff_login', {
        _phone: phone,
        _pin: pin
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const response = data as unknown as LoginResponse;

      if (!response?.success) {
        return { success: false, error: response?.error || 'Login failed' };
      }

      if (!response.session_token || !response.user) {
        return { success: false, error: 'Invalid server response' };
      }

      // Store session
      const session: StaffSession = {
        session_token: response.session_token,
        user: response.user,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setUser(response.user);
      setSessionToken(response.session_token);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (sessionToken) {
        await supabase.rpc('staff_logout', { _session_token: sessionToken });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem(SESSION_KEY);
      setUser(null);
      setSessionToken(null);
    }
  }, [sessionToken]);

  const bootstrap = useCallback(async (phone: string, pin: string): Promise<{ success: boolean; error?: string; message?: string }> => {
    try {
      const { data, error } = await supabase.rpc('bootstrap_super_admin', {
        _phone: phone,
        _pin: pin
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const response = data as unknown as BootstrapResponse;

      if (!response?.success) {
        return { success: false, error: response?.error || 'Bootstrap failed' };
      }

      return { success: true, message: response.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Bootstrap failed' };
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!sessionToken) return false;

    try {
      const { data, error } = await supabase.rpc('validate_session', {
        _session_token: sessionToken
      });

      const response = data as unknown as ValidateSessionResponse;

      if (error || !response?.success) {
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
        setSessionToken(null);
        return false;
      }

      if (response.user) {
        setUser(response.user);
      }
      return true;
    } catch (err) {
      console.error('Session refresh error:', err);
      return false;
    }
  }, [sessionToken]);

  return (
    <StaffAuthContext.Provider value={{
      user,
      sessionToken,
      loading,
      login,
      logout,
      bootstrap,
      refreshSession
    }}>
      {children}
    </StaffAuthContext.Provider>
  );
}

export function useStaffAuth() {
  const context = useContext(StaffAuthContext);
  if (context === undefined) {
    throw new Error('useStaffAuth must be used within a StaffAuthProvider');
  }
  return context;
}

// Hook to get session token for API calls
export function useSessionToken(): string | null {
  const { sessionToken } = useStaffAuth();
  return sessionToken;
}
