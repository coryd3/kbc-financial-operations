import { Link, useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { api, ApiError, type InstanceDetail } from "../lib/api";
import { Card, CardContent, Button } from "../components/ui";
import { ROLE_LABELS, CHECKLIST_MANAGER_ROLES } from "@shared/schema";
import { ArrowLeft, Check, Trash2, RotateCcw, History } from "lucide-react";
import { format } from "date-fns";
import { cn } from "../lib/utils";
import { DueBadge } from "./Checklists";

export default function ChecklistDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const isManager = !!user && CHECKLIST_MANAGER_ROLES.includes(user.role);

  const { data, isLoading, error } = useQuery({
    queryKey: ["checklistInstance", id],
    queryFn: () => api.getChecklistInstance(id),
    enabled: Number.isInteger(id),
  });

  const invalidate = (instance: InstanceDetail) => {
    queryClient.setQueryData(["checklistInstance", id], { instance });
    queryClient.invalidateQueries({ queryKey: ["checklistInstances"] });
    queryClient.invalidateQueries({ queryKey: ["myTasks"] });
    queryClient.invalidateQueries({ queryKey: ["checklistSummary"] });
  };

  const completeMut = useMutation({
    mutationFn: api.completeStep,
    onSuccess: (res) => invalidate(res.instance),
    onError: (e) => alert(e instanceof ApiError ? e.message : "Could not complete step"),
  });
  const uncompleteMut = useMutation({
    mutationFn: api.uncompleteStep,
    onSuccess: (res) => invalidate(res.instance),
    onError: (e) => alert(e instanceof ApiError ? e.message : "Could not undo step"),
  });
  const deleteMut = useMutation({
    mutationFn: () => api.deleteChecklistInstance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklistInstances"] });
      queryClient.invalidateQueries({ queryKey: ["myTasks"] });
      queryClient.invalidateQueries({ queryKey: ["checklistSummary"] });
      setLocation("/checklists");
    },
  });

  if (!user) return null;
  if (isLoading) return <div className="text-muted-foreground py-8">Loading checklist...</div>;
  if (error || !data?.instance) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">This checklist could not be found.</p>
        <Link href="/checklists" className="text-primary hover:underline">
          Back to checklists
        </Link>
      </div>
    );
  }

  const instance = data.instance;
  const total = instance.steps.length;
  const completed = instance.steps.filter((s) => s.completedAt).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const canCheck = (assignedRole: string | null) =>
    isManager || !assignedRole || assignedRole === user.role;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link href="/checklists" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to checklists
      </Link>

      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-serif text-primary font-bold">{instance.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Started {format(new Date(instance.createdAt), "MMM d, yyyy")}</span>
            <DueBadge dueDate={instance.dueDate} status={instance.status} />
            {instance.status === "completed" && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md font-medium">
                Completed {instance.completedAt ? format(new Date(instance.completedAt), "MMM d, yyyy") : ""}
              </span>
            )}
          </div>
        </div>
        {isManager && (
          <div className="flex gap-2 flex-shrink-0">
            {instance.templateId && (
              <Link href={`/checklists/templates/${instance.templateId}/history`}>
                <Button variant="outline" size="sm" className="gap-1.5" title="View past runs of this checklist">
                  <History className="w-4 h-4" /> History
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
              onClick={() => {
                if (confirm("Delete this checklist and its history? This cannot be undone.")) {
                  deleteMut.mutate();
                }
              }}
            >
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">
            {completed} of {total} steps ({pct}%)
          </span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-green-600" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0 divide-y divide-border">
          {instance.steps.map((step) => {
            const done = !!step.completedAt;
            const allowed = canCheck(step.assignedRole);
            return (
              <div key={step.id} className={cn("flex items-start gap-3 p-4", done && "bg-muted/30")}>
                <button
                  disabled={(!done && !allowed) || completeMut.isPending || uncompleteMut.isPending}
                  onClick={() => (done ? uncompleteMut.mutate(step.id) : completeMut.mutate(step.id))}
                  title={
                    done
                      ? "Undo completion"
                      : allowed
                        ? "Mark step complete"
                        : `Assigned to ${step.assignedRole ? ROLE_LABELS[step.assignedRole] : "another role"}`
                  }
                  className={cn(
                    "mt-0.5 w-6 h-6 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors",
                    done
                      ? "bg-green-600 border-green-600 text-white hover:bg-green-700"
                      : allowed
                        ? "border-input hover:border-primary hover:bg-primary/5"
                        : "border-input opacity-40 cursor-not-allowed",
                  )}
                >
                  {done && <Check className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm leading-relaxed", done && "line-through text-muted-foreground")}>
                    <span className="text-muted-foreground mr-1.5">{step.position}.</span>
                    {step.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {step.assignedRole && (
                      <span
                        className={cn(
                          "text-[11px] px-2 py-0.5 rounded font-medium",
                          step.assignedRole === user.role
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {ROLE_LABELS[step.assignedRole]}
                        {step.assignedRole === user.role && " (you)"}
                      </span>
                    )}
                    {done && (
                      <span className="text-[11px] text-muted-foreground">
                        Completed by {step.completedByName ?? "unknown"} on{" "}
                        {format(new Date(step.completedAt!), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    )}
                  </div>
                </div>
                {done && (step.completedBy === user.id || isManager) && (
                  <button
                    onClick={() => uncompleteMut.mutate(step.id)}
                    className="text-muted-foreground hover:text-foreground p-1"
                    title="Undo completion"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
