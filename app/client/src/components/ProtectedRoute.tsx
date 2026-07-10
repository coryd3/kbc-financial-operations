import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../lib/auth";
import type { Role } from "@shared/schema";

export function ProtectedRoute({ 
  children, 
  requireAdmin = false,
  requireLeadership = false,
  allowedRoles,
}: { 
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireLeadership?: boolean;
  allowedRoles?: Role[];
}) {
  const { user, isLoading, isAdmin, isLeadership } = useAuth();
  const [location, setLocation] = useLocation();

  const roleAllowed = !allowedRoles || (user ? allowedRoles.includes(user.role) : false);

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
      } else if (!roleAllowed) {
        setLocation("/dashboard");
      }
    }
  }, [user, isLoading, isAdmin, isLeadership, location, setLocation, requireAdmin, requireLeadership, roleAllowed]);

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
    !roleAllowed ||
    (user.mustChangePassword && location !== "/account")
  ) {
    return null;
  }

  return <>{children}</>;
}
