import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { CustomerNavbar } from './CustomerNavbar';
import { cn } from '@/lib/utils';
import { useCapacitor } from '@/hooks/useCapacitor';

export function CustomerLayout() {
  const { customerId, loading, customerData } = useCustomerAuth();
  const navigate = useNavigate();
  const { isNative, keyboardVisible } = useCapacitor();

  useEffect(() => {
    if (!loading && !customerId) {
      navigate('/customer/auth');
    }
  }, [loading, customerId, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background safe-area-top">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!customerId) {
    return null;
  }

  return (
    <div className={cn(
      "min-h-screen bg-background",
      !keyboardVisible && "pb-20", // Only add bottom padding when keyboard is hidden
      isNative && "safe-area-top"
    )}>
      {/* Mobile Header with safe area */}
      <header className={cn(
        "sticky top-0 z-40 bg-primary text-primary-foreground shadow-md",
        isNative && "pt-[env(safe-area-inset-top)]"
      )}>
        <div className="container py-3 px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">Awadh Dairy</h1>
              {customerData && (
                <p className="text-xs text-primary-foreground/80">
                  Hello, {customerData.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>
      
      <main className="container py-4 px-3">
        <Outlet />
      </main>
      
      {/* Bottom Navigation - hidden when keyboard is open */}
      {!keyboardVisible && <CustomerNavbar />}
    </div>
  );
}
