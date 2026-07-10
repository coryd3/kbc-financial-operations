import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, AlertTriangle, Clock, CheckCheck } from "lucide-react";
import { api, type AppNotification } from "../lib/api";
import { cn } from "../lib/utils";

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.getNotifications,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const readMut = useMutation({
    mutationFn: (id: number) => api.markNotificationRead(id),
    onSuccess: invalidate,
  });

  const readAllMut = useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: invalidate,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const openNotification = (n: AppNotification) => {
    if (!n.readAt) readMut.mutate(n.id);
    setOpen(false);
    setLocation(`/checklists/${n.instanceId}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center px-3 py-2 rounded-md hover:bg-primary-foreground/10 transition-colors"
        aria-label={unreadCount ? `Notifications (${unreadCount} unread)` : "Notifications"}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 right-0.5 bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.1rem] text-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-card text-card-foreground border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => readAllMut.mutate()}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
                disabled={readAllMut.isPending}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">
                No notifications yet. You'll be reminded here when a checklist you're part of is
                due soon or overdue.
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/60 transition-colors",
                    !n.readAt && "bg-primary/5",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {n.type === "overdue" ? (
                      <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className={cn("text-sm leading-snug", !n.readAt && "font-semibold")}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.body}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground/80 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.readAt && <span className="ml-auto mt-1 w-2 h-2 rounded-full bg-accent shrink-0" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
