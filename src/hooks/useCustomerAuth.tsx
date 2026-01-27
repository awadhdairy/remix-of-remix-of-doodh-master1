import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Session storage key
const CUSTOMER_SESSION_KEY = 'awadh_customer_session';

interface CustomerData {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  area: string | null;
  credit_balance: number;
  advance_balance: number;
  subscription_type: string | null;
  billing_cycle: string | null;
}

interface CustomerSession {
  session_token: string;
  customer_id: string;
  customer_name: string;
  expires_at: string;
}

interface LoginResponse {
  success: boolean;
  error?: string;
  pending?: boolean;
  session_token?: string;
  customer_id?: string;
  customer_name?: string;
}

interface RegisterResponse {
  success: boolean;
  error?: string;
  approved?: boolean;
  message?: string;
  customer_id?: string;
}

interface ValidateResponse {
  success: boolean;
  error?: string;
  customer?: CustomerData;
}

interface ChangePinResponse {
  success: boolean;
  error?: string;
  message?: string;
}

interface CustomerAuthContext {
  customerId: string | null;
  customerData: CustomerData | null;
  sessionToken: string | null;
  loading: boolean;
  login: (phone: string, pin: string) => Promise<{ success: boolean; error?: string; pending?: boolean }>;
  register: (phone: string, pin: string) => Promise<{ success: boolean; error?: string; approved?: boolean }>;
  logout: () => Promise<void>;
  changePin: (currentPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  refreshCustomerData: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContext | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedSession = localStorage.getItem(CUSTOMER_SESSION_KEY);
        if (storedSession) {
          const session: CustomerSession = JSON.parse(storedSession);
          
          // Check if session is expired locally first
          if (new Date(session.expires_at) < new Date()) {
            localStorage.removeItem(CUSTOMER_SESSION_KEY);
            setLoading(false);
            return;
          }

          // Validate session with server
          const { data, error } = await supabase.rpc('validate_customer_session', {
            _session_token: session.session_token
          });

          const response = data as unknown as ValidateResponse;

          if (error || !response?.success) {
            localStorage.removeItem(CUSTOMER_SESSION_KEY);
            setLoading(false);
            return;
          }

          if (response.customer) {
            setCustomerId(response.customer.id);
            setCustomerData(response.customer);
            setSessionToken(session.session_token);
          }
        }
      } catch (err) {
        console.error('Error loading session:', err);
        localStorage.removeItem(CUSTOMER_SESSION_KEY);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, []);

  const refreshCustomerData = async () => {
    if (!sessionToken) return;

    try {
      const { data, error } = await supabase.rpc('validate_customer_session', {
        _session_token: sessionToken
      });

      const response = data as unknown as ValidateResponse;

      if (!error && response?.success && response.customer) {
        setCustomerData(response.customer);
      }
    } catch (err) {
      console.error('Error refreshing customer data:', err);
    }
  };

  const login = async (phone: string, pin: string) => {
    try {
      const { data, error } = await supabase.rpc('customer_login', {
        _phone: phone,
        _pin: pin
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const response = data as unknown as LoginResponse;

      if (!response?.success) {
        return { success: false, error: response?.error, pending: response?.pending };
      }

      if (!response.session_token || !response.customer_id) {
        return { success: false, error: 'Invalid server response' };
      }

      // Store session
      const session: CustomerSession = {
        session_token: response.session_token,
        customer_id: response.customer_id,
        customer_name: response.customer_name || 'Customer',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      };

      localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session));
      setCustomerId(response.customer_id);
      setSessionToken(response.session_token);
      
      // Fetch full customer data
      await refreshCustomerData();

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const register = async (phone: string, pin: string) => {
    try {
      const { data, error } = await supabase.rpc('customer_register', {
        _phone: phone,
        _pin: pin
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const response = data as unknown as RegisterResponse;

      if (!response?.success) {
        return { success: false, error: response?.error };
      }

      return { success: true, approved: response.approved };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const logout = async () => {
    try {
      if (sessionToken) {
        await supabase.rpc('customer_logout', { _session_token: sessionToken });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem(CUSTOMER_SESSION_KEY);
      setCustomerId(null);
      setCustomerData(null);
      setSessionToken(null);
    }
  };

  const changePin = async (currentPin: string, newPin: string) => {
    if (!sessionToken) {
      return { success: false, error: 'Not logged in' };
    }

    try {
      const { data, error } = await supabase.rpc('customer_change_pin', {
        _session_token: sessionToken,
        _current_pin: currentPin,
        _new_pin: newPin
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const response = data as unknown as ChangePinResponse;

      if (!response?.success) {
        return { success: false, error: response?.error };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return (
    <CustomerAuthContext.Provider value={{
      customerId,
      customerData,
      sessionToken,
      loading,
      login,
      register,
      logout,
      changePin,
      refreshCustomerData
    }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (context === undefined) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
}
