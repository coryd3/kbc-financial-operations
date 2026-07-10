import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type TemplateWithSteps } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label } from "../components/ui";
import {
  ROLES,
  ROLE_LABELS,
  RECURRENCES,
  RECURRENCE_LABELS,
  CHECKLIST_MANAGER_ROLES,
  type Role,
  type Recurrence,
} from "@shared/schema";
import { useAuth } from "../lib/auth";
import { ArrowLeft, Plus, Pencil, Trash2, Play, GripVertical, X, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "../lib/utils";

interface StepForm {
  title: string;
  assignedRole: Role | "";
}

interface TemplateForm {
  name: string;
  description: string;
  recurrence: Recurrence;
  isActive: boolean;
  steps: StepForm[];
}

const emptyForm: TemplateForm = {
  name: "",
  description: "",
  recurrence: "on_demand",
  isActive: true,
  steps: [{ title: "", assignedRole: "" }],
};

export default function ChecklistTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["checklistTemplates"],
    queryFn: api.getChecklistTemplates,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["checklistTemplates"] });
    queryClient.invalidateQueries({ queryKey: ["checklistInstances"] });
    queryClient.invalidateQueries({ queryKey: ["myTasks"] });
    queryClient.invalidateQueries({ queryKey: ["checklistSummary"] });
  };

  const toPayload = (f: TemplateForm) => ({
    name: f.name,
    description: f.description,
    recurrence: f.recurrence,
    isActive: f.isActive,
    steps: f.steps
      .filter((s) => s.title.trim())
      .map((s) => ({ title: s.title.trim(), assignedRole: s.assignedRole || null })),
  });

  const createMut = useMutation({
    mutationFn: () => api.createChecklistTemplate(toPayload(form)),
    onSuccess: () => {
      invalidateAll();
      resetForm();
    },
    onError: (e) => setFormError(e instanceof ApiError ? e.message : "Could not save template"),
  });
  const updateMut = useMutation({
    mutationFn: () => api.updateChecklistTemplate(editingId!, toPayload(form)),
    onSuccess: () => {
      invalidateAll();
      resetForm();
    },
    onError: (e) => setFormError(e instanceof ApiError ? e.message : "Could not save template"),
  });
  const deleteMut = useMutation({
    mutationFn: api.deleteChecklistTemplate,
    onSuccess: invalidateAll,
  });
  const startMut = useMutation({
    mutationFn: api.startChecklist,
    onSuccess: invalidateAll,
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setIsFormOpen(false);
    setFormError(null);
  };

  const handleEdit = (t: TemplateWithSteps) => {
    setForm({
      name: t.name,
      description: t.description ?? "",
      recurrence: t.recurrence,
      isActive: t.isActive,
      steps: t.steps.map((s) => ({ title: s.title, assignedRole: s.assignedRole ?? "" })),
    });
    setEditingId(t.id);
    setIsFormOpen(true);
    setFormError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setStep = (i: number, patch: Partial<StepForm>) =>
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }));

  const moveStep = (i: number, dir: -1 | 1) =>
    setForm((f) => {
      const steps = [...f.steps];
      const j = i + dir;
      if (j < 0 || j >= steps.length) return f;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...f, steps };
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.steps.some((s) => s.title.trim())) {
      setFormError("Add at least one step");
      return;
    }
    if (editingId) updateMut.mutate();
    else createMut.mutate();
  };

  if (user && !CHECKLIST_MANAGER_ROLES.includes(user.role)) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">You don't have permission to manage checklist templates.</p>
        <Link href="/checklists" className="text-primary hover:underline">
          Back to checklists
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link href="/checklists" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to checklists
      </Link>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-primary font-bold">Checklist Templates</h1>
          <p className="text-muted-foreground mt-1">
            Define reusable procedures. Weekly and monthly templates start automatically; on-demand templates start when you need them.
          </p>
        </div>
        {!isFormOpen && (
          <Button onClick={() => { setIsFormOpen(true); setFormError(null); }} className="gap-2">
            <Plus className="w-4 h-4" /> New Template
          </Button>
        )}
      </div>

      {isFormOpen && (
        <Card className="border-primary/20 shadow-md">
          <CardHeader>
            <CardTitle>{editingId ? "Edit Template" : "Create Template"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Payroll Run"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recurrence">Schedule</Label>
                  <select
                    id="recurrence"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.recurrence}
                    onChange={(e) => setForm({ ...form, recurrence: e.target.value as Recurrence })}
                  >
                    {RECURRENCES.map((r) => (
                      <option key={r} value={r}>
                        {RECURRENCE_LABELS[r]}
                        {r === "weekly" ? " (starts automatically each week)" : r === "monthly" ? " (starts automatically each month)" : " (start manually)"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <textarea
                  id="description"
                  className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="space-y-3">
                <Label>Steps (in order)</Label>
                {form.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-muted-foreground w-5 text-right flex-shrink-0">{i + 1}.</span>
                    <Input
                      value={step.title}
                      onChange={(e) => setStep(i, { title: e.target.value })}
                      placeholder="Step description"
                      className="flex-1"
                    />
                    <select
                      className="h-10 rounded-md border border-input bg-background px-2 text-sm w-40 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={step.assignedRole}
                      onChange={(e) => setStep(i, { assignedRole: e.target.value as Role | "" })}
                    >
                      <option value="">Anyone</option>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-col">
                      <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => moveStep(i, 1)} disabled={i === form.steps.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }))}
                      disabled={form.steps.length === 1}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-30 p-1 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setForm((f) => ({ ...f, steps: [...f.steps, { title: "", assignedRole: "" }] }))}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Step
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <Label htmlFor="isActive" className="font-normal">
                  Active (recurring templates only start automatically while active)
                </Label>
              </div>

              {formError && <p className="text-sm text-destructive">{formError}</p>}

              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                  {editingId ? "Save Changes" : "Create Template"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-muted-foreground py-8">Loading templates...</div>
        ) : !data?.templates.length ? (
          <div className="text-muted-foreground py-8 text-center bg-muted/30 rounded-lg border border-border border-dashed">
            No templates yet. Create one to get started.
          </div>
        ) : (
          data.templates.map((t) => (
            <Card key={t.id} className={cn(!t.isActive && "opacity-60")}>
              <CardHeader className="pb-3 flex flex-row justify-between items-start gap-4">
                <div className="min-w-0">
                  <CardTitle className="text-xl">{t.name}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded font-medium">
                      {RECURRENCE_LABELS[t.recurrence]}
                    </span>
                    <span className="bg-muted text-muted-foreground px-2 py-1 rounded">
                      {t.steps.length} step{t.steps.length === 1 ? "" : "s"}
                    </span>
                    {!t.isActive && (
                      <span className="bg-muted text-muted-foreground px-2 py-1 rounded">Inactive</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={startMut.isPending}
                    onClick={() => startMut.mutate(t.id)}
                    title="Start a new checklist from this template now"
                  >
                    <Play className="w-3.5 h-3.5" /> Start Now
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(t)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (
                        confirm(
                          `Delete "${t.name}"? All checklists started from this template (including their history) will also be deleted.`,
                        )
                      ) {
                        deleteMut.mutate(t.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                <ol className="space-y-1">
                  {t.steps.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-5 text-right flex-shrink-0">{s.position}.</span>
                      <span className="flex-1">{s.title}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded whitespace-nowrap">
                        {s.assignedRole ? ROLE_LABELS[s.assignedRole] : "Anyone"}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}