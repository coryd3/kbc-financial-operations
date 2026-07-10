import { Link, useLocation } from "wouter";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/utils";
import {
  COUNT_VIEW_ROLES,
  FINANCE_VIEW_ROLES,
  REPORT_VIEW_ROLES,
  CATEGORY_MANAGE_ROLES,
  type Role,
} from "@shared/schema";
import { ClipboardList, Landmark, BookText, CalendarCheck, PieChart, Tags } from "lucide-react";

export const FINANCE_TABS: { href: string; label: string; icon: any; roles: Role[] }[] = [
  { href: "/finance/counts", label: "Offering Counts", icon: ClipboardList, roles: COUNT_VIEW_ROLES },
  { href: "/finance/deposits", label: "Deposits", icon: Landmark, roles: FINANCE_VIEW_ROLES },
  { href: "/finance/ledger", label: "Ledger", icon: BookText, roles: FINANCE_VIEW_ROLES },
  { href: "/finance/close", label: "Monthly Close", icon: CalendarCheck, roles: FINANCE_VIEW_ROLES },
  { href: "/finance/reports", label: "Reports", icon: PieChart, roles: REPORT_VIEW_ROLES },
  { href: "/finance/categories", label: "Categories", icon: Tags, roles: CATEGORY_MANAGE_ROLES },
];

export function financeTabsForRole(role: Role) {
  return FINANCE_TABS.filter((t) => t.roles.includes(role));
}

export function FinanceLayout({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  if (!user) return null;
  const tabs = financeTabsForRole(user.role);

  return (
    <div className="space-y-6">
      <header className="border-b border-border pb-4">
        <h1 className="text-3xl font-serif text-primary font-bold">Finance</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Offering counts, deposits, bookkeeping, and monthly close
        </p>
      </header>

      <nav className="flex gap-1 overflow-x-auto scrollbar-hide border-b border-border -mt-2">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors",
              location === tab.href
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </Link>
        ))}
      </nav>

      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-serif font-semibold">{title}</h2>
          {description && <p className="text-muted-foreground text-sm mt-1">{description}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
