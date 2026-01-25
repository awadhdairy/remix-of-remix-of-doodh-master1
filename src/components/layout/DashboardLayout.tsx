import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileNavbar } from "@/components/mobile/MobileNavbar";
import { QuickActionFab } from "@/components/mobile/QuickActionFab";
import { useCapacitor } from "@/hooks/useCapacitor";

export function DashboardLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isNative, keyboardVisible } = useCapacitor();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_OUT') {
          navigate('/auth');
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (!session) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out successfully",
        description: "See you next time!",
      });
      navigate('/auth');
    }
  };

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

  if (!user) {
    return null;
  }

  return (
    <div className={cn(
      "min-h-screen bg-background",
      isNative && "safe-area-top"
    )}>
      {/* Desktop Sidebar - hidden on mobile */}
      {!isMobile && <AppSidebar onLogout={handleLogout} />}
      
      <main className={cn(
        "min-h-screen transition-all duration-300",
        !isMobile && "ml-[260px]", // Sidebar width on desktop
        isMobile && "pb-20" // Bottom nav padding on mobile
      )}>
        <div className={cn(
          "container py-4 md:py-6",
          isMobile && "px-3" // Tighter padding on mobile
        )}>
          <Outlet />
        </div>
      </main>

      {/* Mobile Navigation */}
      {isMobile && !keyboardVisible && (
        <>
          <MobileNavbar />
          <QuickActionFab />
        </>
      )}
    </div>
  );
}
