import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../../lib/auth";
import { financeTabsForRole } from "../../components/FinanceLayout";

export function FinanceIndexRedirect() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      const tabs = financeTabsForRole(user.role);
      setLocation(tabs[0]?.href ?? "/dashboard", { replace: true });
    }
  }, [user, setLocation]);

  return null;
}
