import { useState, useEffect, createContext, useContext } from 'react';
import { externalSupabase as supabase, invokeExternalFunction } from '@/lib/external-supabase';
import { User, Session } from '@supabase/supabase-js';

const CUSTOMER_ID_KEY = 'awadh_customer_id';

interface CustomerAuthContext {
  user: User | null;
  session: Session | null;
  customerId: string | null;
  customerData: CustomerData | null;
  loading: boolean;
  login: (phone: string, pin: string) => Promise<{ success: boolean; error?: string; pending?: boolean }>;
  register: (phone: string, pin: string) => Promise<{ success: boolean; error?: string; approved?: boolean }>;
  logout: () => Promise<void>;
  changePin: (currentPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  refreshCustomerData: () => Promise<void>;
}

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

const CustomerAuthContext = createContext<CustomerAuthContext | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);

  // Persist customerId to localStorage
  const persistCustomerId = (id: string | null) => {
    if (id) {
      localStorage.setItem(CUSTOMER_ID_KEY, id);
    } else {
      localStorage.removeItem(CUSTOMER_ID_KEY);
    }
    setCustomerId(id);
  };

  // Restore customerId from localStorage
  const restoreCustomerId = (): string | null => {
    return localStorage.getItem(CUSTOMER_ID_KEY);
  };

  const fetchCustomerData = async (custId: string) => {
    try {
      console.log('[CustomerAuth] Fetching customer data for:', custId);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', custId)
        .single();
      
      if (!error && data) {
        console.log('[CustomerAuth] Customer data loaded:', data.name);
        setCustomerData(data);
      } else {
        console.error('[CustomerAuth] Failed to fetch customer data:', error);
      }
    } catch (err) {
      console.error('[CustomerAuth] Error fetching customer data:', err);
    }
  };

  useEffect(() => {
    // Try to restore customer ID from localStorage first
    const storedCustomerId = restoreCustomerId();
    console.log('[CustomerAuth] Restored customer ID from storage:', storedCustomerId);
    
    if (storedCustomerId) {
      setCustomerId(storedCustomerId);
      // Fetch customer data immediately if we have a stored ID
      fetchCustomerData(storedCustomerId);
    }

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[CustomerAuth] Auth state changed:', event);
        setSession(session);
        setUser(session?.user ?? null);
        
        // If we have customer metadata, use it
        if (session?.user?.user_metadata?.is_customer && session.user.user_metadata.customer_id) {
          const metaCustomerId = session.user.user_metadata.customer_id;
          console.log('[CustomerAuth] Customer ID from metadata:', metaCustomerId);
          persistCustomerId(metaCustomerId);
          // Defer data fetch to avoid deadlocks
          setTimeout(() => {
            fetchCustomerData(metaCustomerId);
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          // Clear everything on sign out
          persistCustomerId(null);
          setCustomerData(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[CustomerAuth] Got existing session:', !!session);
      setSession(session);
      setUser(session?.user ?? null);
      
      // Priority: stored customerId > metadata customerId
      const effectiveCustomerId = storedCustomerId || session?.user?.user_metadata?.customer_id;
      
      if (effectiveCustomerId) {
        console.log('[CustomerAuth] Using effective customer ID:', effectiveCustomerId);
        setCustomerId(effectiveCustomerId);
        if (!storedCustomerId) {
          // Persist if not already stored
          persistCustomerId(effectiveCustomerId);
        }
        fetchCustomerData(effectiveCustomerId);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshCustomerData = async () => {
    if (customerId) {
      await fetchCustomerData(customerId);
    }
  };

  const login = async (phone: string, pin: string) => {
    try {
      console.log('[CustomerAuth] Attempting login for phone:', phone.slice(-4));
      
      const { data, error } = await invokeExternalFunction<{
        success: boolean;
        error?: string;
        pending?: boolean;
        session?: { access_token: string; refresh_token: string };
        customer_id?: string;
      }>('customer-auth', { action: 'login', phone, pin });

      if (error) {
        console.error('[CustomerAuth] Login API error:', error);
        return { success: false, error: error.message };
      }

      if (!data.success) {
        console.log('[CustomerAuth] Login failed:', data.error);
        return { success: false, error: data.error, pending: data.pending };
      }

      // Set session if provided
      if (data.session) {
        console.log('[CustomerAuth] Setting session from login response');
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });
      }

      // CRITICAL: Store customer ID from API response directly
      if (data.customer_id) {
        console.log('[CustomerAuth] Storing customer ID:', data.customer_id);
        persistCustomerId(data.customer_id);
        // Immediately fetch customer data
        await fetchCustomerData(data.customer_id);
      }

      return { success: true };
    } catch (err: any) {
      console.error('[CustomerAuth] Login exception:', err);
      return { success: false, error: err.message };
    }
  };

  const register = async (phone: string, pin: string) => {
    try {
      const { data, error } = await invokeExternalFunction<{
        success: boolean;
        error?: string;
        approved?: boolean;
      }>('customer-auth', { action: 'register', phone, pin });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.success) {
        return { success: false, error: data.error };
      }

      return { success: true, approved: data.approved };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const logout = async () => {
    console.log('[CustomerAuth] Logging out');
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    persistCustomerId(null);
    setCustomerData(null);
  };

  const changePin = async (currentPin: string, newPin: string) => {
    // Use stored or current customerId
    const effectiveCustomerId = customerId || restoreCustomerId();
    
    if (!effectiveCustomerId) {
      console.error('[CustomerAuth] No customer ID available for PIN change');
      return { success: false, error: 'Not logged in' };
    }

    try {
      console.log('[CustomerAuth] Changing PIN for customer:', effectiveCustomerId);
      const { data, error } = await invokeExternalFunction<{
        success: boolean;
        error?: string;
      }>('customer-auth', { action: 'change-pin', customerId: effectiveCustomerId, currentPin, newPin });

      if (error) {
        return { success: false, error: error.message };
      }

      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return (
    <CustomerAuthContext.Provider value={{
      user,
      session,
      customerId,
      customerData,
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
