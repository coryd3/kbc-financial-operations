import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../../lib/auth";
import { financeTabsForRoles } from "../../components/FinanceLayout";

export function FinanceIndexRedirect() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      const tabs = financeTabsForRoles(user.roles ?? [user.role]);
      setLocation(tabs[0]?.href ?? "/dashboard", { replace: true });
    }
  }, [user, setLocation]);

  return null;
}
