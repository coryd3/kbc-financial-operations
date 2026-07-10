import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { api, type HistoryInstance, type Timeliness } from "../lib/api";
import { Card, CardContent } from "../components/ui";
import { ROLE_LABELS, RECURRENCE_LABELS, CHECKLIST_MANAGER_ROLES } from "@shared/schema";
import { ArrowLeft, Check, ChevronDown, ChevronRight, ClipboardList, AlertTriangle, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "../lib/utils";

function TimelinessBadge({ timeliness, status }: { timeliness: Timeliness; status: string }) {
  if (timeliness === "on_time") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-green-100 text-green-800 font-medium whitespace-nowrap">
        <Check className="w-3 h-3" /> On time
      </span>
    );
  }
  if (timeliness === "late") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-accent/15 text-accent font-medium whitespace-nowrap">
        <Clock className="w-3 h-3" /> Completed late
      </span>
    );
  }
  if (timeliness === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-destructive/10 text-destructive font-medium whitespace-nowrap">
        <AlertTriangle className="w-3 h-3" /> Overdue
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-green-100 text-green-800 font-medium whitespace-nowrap">
        <Check className="w-3 h-3" /> Completed
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground whitespace-nowrap">In progress</span>
  );
}

function HistoryRow({ instance }: { instance: HistoryInstance }) {
  const [open, setOpen] = useState(false);
  const { total, completed } = instance.progress;

  return (
    <Card>
      <CardContent className="p-0">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
        >
          {open ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 hidden sm:block" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 hidden sm:block" />
          )}
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="font-serif font-semibold truncate">{instance.name}</p>
            <p className="text-xs text-muted-foreground">
              Started {format(new Date(instance.createdAt), "MMM d, yyyy")}
              {instance.dueDate && ` · Due ${format(new Date(instance.dueDate), "MMM d, yyyy")}`}
              {instance.completedAt && ` · Completed ${format(new Date(instance.completedAt), "MMM d, yyyy 'at' h:mm a")}`}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {completed}/{total} steps
            </span>
            <TimelinessBadge timeliness={instance.timeliness} status={instance.status} />
          </div>
        </button>

        {open && (
          <div className="border-t border-border divide-y divide-border">
            {instance.steps.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">This run had no steps.</p>
            ) : (
              instance.steps.map((step) => {
                const done = !!step.completedAt;
                return (
                  <div key={step.id} className="flex items-start gap-3 px-4 py-3">
                    <span
                      className={cn(
                        "mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0",
                        done ? "bg-green-600 border-green-600 text-white" : "border-input",
                      )}
                    >
                      {done && <Check className="w-3.5 h-3.5" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm", !done && "text-muted-foreground")}>
                        <span className="text-muted-foreground mr-1.5">{step.position}.</span>
                        {step.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {step.assignedRole && (
                          <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded font-medium">
                            {ROLE_LABELS[step.assignedRole]}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {done
                            ? `Completed by ${step.completedByName ?? "unknown"} on ${format(new Date(step.completedAt!), "MMM d, yyyy 'at' h:mm a")}`
                            : "Not completed"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div className="px-4 py-3">
              <Link href={`/checklists/${instance.id}`} className="text-sm text-primary hover:underline font-medium">
                Open this checklist &rarr;
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ChecklistHistory() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { user } = useAuth();
  const isManager = !!user && CHECKLIST_MANAGER_ROLES.includes(user.role);

  const { data, isLoading, error } = useQuery({
    queryKey: ["checklistTemplateHistory", id],
    queryFn: () => api.getChecklistTemplateHistory(id),
    enabled: Number.isInteger(id) && isManager,
  });

  if (!user) return null;
  if (!isManager) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">You don't have permission to view checklist history.</p>
        <Link href="/checklists" className="text-primary hover:underline">
          Back to checklists
        </Link>
      </div>
    );
  }
  if (isLoading) return <div className="text-muted-foreground py-8">Loading history...</div>;
  if (error || !data) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">This template could not be found.</p>
        <Link href="/checklists/templates" className="text-primary hover:underline">
          Back to templates
        </Link>
      </div>
    );
  }

  const { template, instances } = data;
  const completedRuns = instances.filter((i) => i.status === "completed");
  const onTimeRuns = completedRuns.filter((i) => i.timeliness === "on_time");
  const withDue = completedRuns.filter((i) => i.timeliness === "on_time" || i.timeliness === "late");

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link
        href="/checklists/templates"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Back to templates
      </Link>

      <div className="space-y-2">
        <h1 className="text-3xl font-serif text-primary font-bold">{template.name} — History</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="bg-primary/10 text-primary px-2 py-1 rounded font-medium">
            {RECURRENCE_LABELS[template.recurrence]}
          </span>
        </div>
        {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{instances.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total runs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{completedRuns.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {withDue.length > 0 ? `${Math.round((onTimeRuns.length / withDue.length) * 100)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">On time</p>
          </CardContent>
        </Card>
      </div>

      {instances.length === 0 ? (
        <div className="text-center py-12 bg-muted/50 rounded-lg border border-border border-dashed">
          <ClipboardList className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No checklists have been started from this template yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {instances.map((instance) => (
            <HistoryRow key={instance.id} instance={instance} />
          ))}
        </div>
      )}
    </div>
  );
}
