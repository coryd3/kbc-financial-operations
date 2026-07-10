import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { Card, CardContent, Button } from "../components/ui";
import { ROLE_LABELS, CHECKLIST_MANAGER_ROLES } from "@shared/schema";
import { CheckSquare, ClipboardList, Settings, AlertTriangle, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { cn } from "../lib/utils";

type Tab = "my-tasks" | "active" | "completed";

function ProgressBar({ total, completed }: { total: number; completed: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-green-600" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {completed}/{total}
      </span>
    </div>
  );
}

export function DueBadge({ dueDate, status }: { dueDate: string | Date | null; status?: string }) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  const overdue = status !== "completed" && due < now;
  const soon = !overdue && status !== "completed" && due.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md whitespace-nowrap",
        overdue
          ? "bg-destructive/10 text-destructive font-medium"
          : soon
            ? "bg-accent/15 text-accent font-medium"
            : "bg-muted text-muted-foreground",
      )}
    >
      {overdue ? <AlertTriangle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
      {overdue ? "Overdue — " : "Due "}
      {format(due, "MMM d")}
    </span>
  );
}

export default function Checklists() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("my-tasks");
  const isManager = !!user && (user.roles ?? [user.role]).some((role) => CHECKLIST_MANAGER_ROLES.includes(role));

  const myTasksQuery = useQuery({
    queryKey: ["myTasks"],
    queryFn: api.getMyTasks,
    enabled: tab === "my-tasks",
  });
  const instancesQuery = useQuery({
    queryKey: ["checklistInstances", tab],
    queryFn: () => api.getChecklistInstances(tab === "active" ? "open" : "completed"),
    enabled: tab === "active" || tab === "completed",
  });

  if (!user) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "my-tasks", label: "My Tasks" },
    { key: "active", label: "Active Checklists" },
    { key: "completed", label: "Completed" },
  ];

  // Group my tasks by checklist
  const taskGroups = new Map<number, { name: string; dueDate: string | null; tasks: NonNullable<typeof myTasksQuery.data>["tasks"] }>();
  for (const t of myTasksQuery.data?.tasks ?? []) {
    const g = taskGroups.get(t.instanceId) ?? { name: t.instanceName, dueDate: t.dueDate, tasks: [] };
    g.tasks.push(t);
    taskGroups.set(t.instanceId, g);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-primary font-bold">Tasks &amp; Checklists</h1>
          <p className="text-muted-foreground mt-1">
            Track recurring procedures and check off the steps you're responsible for.
          </p>
        </div>
        {isManager && (
          <Link href="/checklists/templates">
            <Button variant="outline" className="gap-2">
              <Settings className="w-4 h-4" /> Manage Templates
            </Button>
          </Link>
        )}
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "my-tasks" && (
        <div className="space-y-6">
          {myTasksQuery.isLoading ? (
            <div className="text-muted-foreground py-8">Loading your tasks...</div>
          ) : taskGroups.size === 0 ? (
            <div className="text-center py-12 bg-muted/50 rounded-lg border border-border border-dashed">
              <CheckSquare className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">You're all caught up — no open steps assigned to you.</p>
            </div>
          ) : (
            Array.from(taskGroups.entries()).map(([instanceId, group]) => (
              <Card key={instanceId}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <Link
                      href={`/checklists/${instanceId}`}
                      className="font-serif font-semibold text-lg text-primary hover:underline"
                    >
                      {group.name}
                    </Link>
                    <DueBadge dueDate={group.dueDate} />
                  </div>
                  <ul className="space-y-2">
                    {group.tasks.map((t) => (
                      <li key={t.stepId} className="flex items-center gap-3 text-sm">
                        <span className="w-5 h-5 rounded border border-input flex-shrink-0" />
                        <span className="flex-1">{t.title}</span>
                        {t.assignedRole && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded whitespace-nowrap">
                            {ROLE_LABELS[t.assignedRole]}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <Link href={`/checklists/${instanceId}`} className="inline-block text-sm text-primary hover:underline font-medium">
                    Open checklist &rarr;
                  </Link>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {(tab === "active" || tab === "completed") && (
        <div className="space-y-3">
          {instancesQuery.isLoading ? (
            <div className="text-muted-foreground py-8">Loading checklists...</div>
          ) : !instancesQuery.data?.instances.length ? (
            <div className="text-center py-12 bg-muted/50 rounded-lg border border-border border-dashed">
              <ClipboardList className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                {tab === "active" ? "No active checklists right now." : "No completed checklists yet."}
              </p>
            </div>
          ) : (
            instancesQuery.data.instances.map((instance) => (
              <Link key={instance.id} href={`/checklists/${instance.id}`} className="block">
                <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-serif font-semibold text-lg truncate">{instance.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        Started {format(new Date(instance.createdAt), "MMM d, yyyy")}
                        {instance.completedAt && ` · Completed ${format(new Date(instance.completedAt), "MMM d, yyyy")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      {instance.status === "open" && <DueBadge dueDate={instance.dueDate} status={instance.status} />}
                      {instance.status === "completed" && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md font-medium">
                          Completed
                        </span>
                      )}
                      <ProgressBar total={instance.progress.total} completed={instance.progress.completed} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
