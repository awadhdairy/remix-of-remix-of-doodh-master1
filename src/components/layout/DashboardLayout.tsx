import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useStaffAuth } from "@/contexts/StaffAuthContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileNavbar } from "@/components/mobile/MobileNavbar";
import { QuickActionFab } from "@/components/mobile/QuickActionFab";
import { useCapacitor } from "@/hooks/useCapacitor";

export function DashboardLayout() {
  const { user, loading, logout } = useStaffAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isNative, keyboardVisible } = useCapacitor();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [loading, user, navigate]);

  const handleLogout = async () => {
    await logout();
    toast({
      title: "Signed out successfully",
      description: "See you next time!",
    });
    navigate('/auth');
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
