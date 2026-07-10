import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../lib/auth";

export function ProtectedRoute({ 
  children, 
  requireAdmin = false,
  requireLeadership = false,
}: { 
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireLeadership?: boolean;
}) {
  const { user, isLoading, isAdmin, isLeadership } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        setLocation("/login");
      } else if (user.mustChangePassword && location !== "/account") {
        setLocation("/account");
      } else if (requireAdmin && !isAdmin) {
        setLocation("/dashboard");
      } else if (requireLeadership && !isLeadership) {
        setLocation("/dashboard");
      }
    }
  }, [user, isLoading, isAdmin, isLeadership, location, setLocation, requireAdmin, requireLeadership]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse text-muted-foreground font-serif text-xl">Loading...</div>
      </div>
    );
  }

  if (
    !user ||
    (requireAdmin && !isAdmin) ||
    (requireLeadership && !isLeadership) ||
    (user.mustChangePassword && location !== "/account")
  ) {
    return null;
  }

  return <>{children}</>;
}
