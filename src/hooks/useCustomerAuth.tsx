import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

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

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user?.user_metadata?.is_customer) {
          setCustomerId(session.user.user_metadata.customer_id);
          // Defer data fetch
          setTimeout(() => {
            fetchCustomerData(session.user.user_metadata.customer_id);
          }, 0);
        } else {
          setCustomerId(null);
          setCustomerData(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user?.user_metadata?.is_customer) {
        setCustomerId(session.user.user_metadata.customer_id);
        fetchCustomerData(session.user.user_metadata.customer_id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchCustomerData = async (custId: string) => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', custId)
      .single();
    
    if (!error && data) {
      setCustomerData(data);
    }
  };

  const refreshCustomerData = async () => {
    if (customerId) {
      await fetchCustomerData(customerId);
    }
  };

  const login = async (phone: string, pin: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-auth', {
        body: { action: 'login', phone, pin }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.success) {
        return { success: false, error: data.error, pending: data.pending };
      }

      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });
        setCustomerId(data.customer_id);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const register = async (phone: string, pin: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-auth', {
        body: { action: 'register', phone, pin }
      });

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
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setCustomerId(null);
    setCustomerData(null);
  };

  const changePin = async (currentPin: string, newPin: string) => {
    if (!customerId) {
      return { success: false, error: 'Not logged in' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('customer-auth', {
        body: { action: 'change-pin', customerId, currentPin, newPin }
      });

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
