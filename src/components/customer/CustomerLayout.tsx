import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { CustomerNavbar } from './CustomerNavbar';
import { cn } from '@/lib/utils';

export function CustomerLayout() {
  const { user, loading, customerData } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/customer/auth');
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Doodh Wallah</h1>
              {customerData && (
                <p className="text-sm text-primary-foreground/80">
                  Hello, {customerData.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>
      
      <main className="container py-4">
        <Outlet />
      </main>
      
      <CustomerNavbar />
    </div>
  );
}
