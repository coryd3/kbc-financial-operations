import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { LogOut, BookOpen, Home, User, Shield, BarChart, LayoutDashboard, Users, ContactRound, CheckSquare, Gavel } from "lucide-react";
import { cn } from "../lib/utils";
import { CHURCH_CONTACT } from "../lib/contact";
import { NotificationBell } from "./NotificationBell";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isLeadership, refresh } = useAuth();
  const [location, setLocation] = useLocation();

  const { data: pendingCount } = useQuery({
    queryKey: ["pendingCount"],
    queryFn: () => api.getPendingCount().then((d) => d.pendingCount),
    enabled: isAdmin,
    refetchInterval: 60000,
  });

  const { data: checklistSummary } = useQuery({
    queryKey: ["checklistSummary"],
    queryFn: api.getChecklistSummary,
    enabled: !!user,
    refetchInterval: 60000,
  });

  const handleLogout = async () => {
    try {
      await api.logout();
      await refresh();
      setLocation("/login");
    } catch (e) {
      console.error(e);
    }
  };

  const navItems = [
    { href: "/", label: "Home", icon: Home, show: true },
    { href: "/docs", label: "Documentation", icon: BookOpen, show: true },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: !!user },
    { href: "/directory", label: "Directory", icon: ContactRound, show: !!user },
    { href: "/admin/members", label: "Members", icon: Users, show: isLeadership },
    {
      href: "/checklists",
      label: "Checklists",
      icon: CheckSquare,
      show: !!user,
      badge: checklistSummary?.overdue.length ? checklistSummary.overdue.length : null,
    },
    { href: "/committees", label: "Committees", icon: Users, show: !!user },
    { href: "/decisions", label: "Decisions", icon: Gavel, show: !!user },
    { href: "/admin", label: "Admin", icon: Shield, show: isAdmin, badge: pendingCount ? pendingCount : null },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart, show: isAdmin },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="bg-primary text-primary-foreground py-4 px-6 md:px-8 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity group">
            <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-accent-foreground font-serif text-xl font-bold shadow-sm group-hover:scale-105 transition-transform">
              KBC
            </div>
            <div>
              <h1 className="font-serif text-xl md:text-2xl font-semibold leading-tight">Kingsville Baptist Church</h1>
              <p className="text-primary-foreground/80 text-xs md:text-sm font-medium tracking-wide">Operations Portal</p>
            </div>
          </Link>
          <nav className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide text-sm">
            {navItems.filter((i) => i.show).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors whitespace-nowrap",
                  location === item.href || (item.href !== "/" && location.startsWith(item.href))
                    ? "bg-primary-foreground/15 font-medium"
                    : "hover:bg-primary-foreground/10 text-primary-foreground/90"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {item.badge ? (
                  <span className="bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            ))}
            
            {!user ? (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-primary-foreground/20">
                <Link href="/login" className="px-3 py-2 rounded-md hover:bg-primary-foreground/10 transition-colors">
                  Login
                </Link>
                <Link href="/register" className="px-3 py-2 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground font-medium transition-colors shadow-sm">
                  Register
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-primary-foreground/20">
                <NotificationBell />
                <Link href="/account" className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-primary-foreground/10 transition-colors">
                  <User className="w-4 h-4" />
                  Account
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-primary-foreground/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8">
        {children}
      </main>
      <footer className="border-t border-border py-8 text-center text-muted-foreground text-sm">
        <p className="font-serif text-base text-foreground/80 mb-2">{CHURCH_CONTACT.name}</p>
        <p>
          {CHURCH_CONTACT.addressLine1}, {CHURCH_CONTACT.addressLine2}
        </p>
        <p className="mt-1">
          <a href={`tel:${CHURCH_CONTACT.phone}`} className="hover:text-foreground transition-colors">
            {CHURCH_CONTACT.phone}
          </a>
          {" · "}
          <a href={`mailto:${CHURCH_CONTACT.email}`} className="hover:text-foreground transition-colors">
            {CHURCH_CONTACT.email}
          </a>
          {" · "}
          <a
            href={CHURCH_CONTACT.website}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            {CHURCH_CONTACT.websiteLabel}
          </a>
        </p>
        <p className="mt-4 text-xs opacity-70">&copy; {new Date().getFullYear()} {CHURCH_CONTACT.name}. All rights reserved.</p>
      </footer>
    </div>
  );
}
