import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../lib/auth";

export function ProtectedRoute({ 
  children, 
  requireAdmin = false 
}: { 
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, isLoading, isAdmin } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        setLocation("/login");
      } else if (user.mustChangePassword && location !== "/account") {
        setLocation("/account");
      } else if (requireAdmin && !isAdmin) {
        setLocation("/dashboard");
      }
    }
  }, [user, isLoading, isAdmin, location, setLocation, requireAdmin]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse text-muted-foreground font-serif text-xl">Loading...</div>
      </div>
    );
  }

  if (!user || (requireAdmin && !isAdmin) || (user.mustChangePassword && location !== "/account")) {
    return null;
  }

  return <>{children}</>;
}
