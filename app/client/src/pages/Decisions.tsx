import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type DecisionInput, type DecisionLogEntry } from "../lib/api";
import { DECISION_STATUSES, DECISION_STATUS_LABELS } from "@shared/schema";
import { Button, Card, CardContent, Input, Label } from "../components/ui";
import { Gavel, Plus, Pencil, Trash2, ExternalLink, X, Printer } from "lucide-react";
import { format } from "date-fns";
import { printDecisionLog } from "../lib/printExport";

const DOCS_DECISION_LOG_URL =
  "https://coryd3.github.io/kbc-financial-operations/02-decision-log/";

const inputClass = "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function formatDate(d: string | null | undefined) {
  if (!d) return "TBD";
  try {
    return format(new Date(d + "T00:00:00"), "MMM d, yyyy");
  } catch {
    return d;
  }
}

const STATUS_STYLES: Record<string, string> = {
  proposed: "bg-muted text-foreground/80",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  complete: "bg-primary/10 text-primary",
  needs_review: "bg-accent/20 text-accent",
  superseded: "bg-muted text-muted-foreground line-through",
};

export default function Decisions() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["decisions"],
    queryFn: api.getDecisions,
  });

  const [committeeFilter, setCommitteeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionError, setActionError] = useState<string | null>(null);

  const emptyForm: DecisionInput = {
    committeeId: null,
    meetingId: null,
    decisionDate: "",
    decision: "",
    owner: "",
    status: "proposed",
    notes: "",
  };
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DecisionInput>(emptyForm);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["decisions"] });
    queryClient.invalidateQueries({ queryKey: ["committee"] });
  };
  const onError = (err: unknown) =>
    setActionError(err instanceof ApiError ? err.message : "Something went wrong");

  const save = useMutation({
    mutationFn: (input: DecisionInput) =>
      editingId ? api.updateDecision(editingId, input) : api.createDecision(input),
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setActionError(null);
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteDecision(id),
    onSuccess: invalidate,
    onError,
  });

  const startEdit = (d: DecisionLogEntry) => {
    setEditingId(d.id);
    setForm({
      committeeId: d.committeeId,
      meetingId: d.meetingId,
      decisionDate: d.decisionDate ?? "",
      decision: d.decision,
      owner: d.owner ?? "",
      status: d.status,
      notes: d.notes ?? "",
    });
    setFormOpen(true);
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.decisions.filter((d) => {
      if (committeeFilter === "general" && d.committeeId !== null) return false;
      if (committeeFilter !== "all" && committeeFilter !== "general" && d.committeeId !== Number(committeeFilter)) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      return true;
    });
  }, [data, committeeFilter, statusFilter]);

  const canCreate = data?.canCreateGeneral || (data?.committees.length ?? 0) > 0;

  const handlePrint = () => {
    const committeeName =
      committeeFilter === "all"
        ? "All bodies"
        : committeeFilter === "general"
          ? "Congregation / General"
          : data?.committees.find((c) => String(c.id) === committeeFilter)?.name ?? "Selected committee";
    const statusName =
      statusFilter === "all" ? "All statuses" : DECISION_STATUS_LABELS[statusFilter as keyof typeof DECISION_STATUS_LABELS] ?? statusFilter;
    const opened = printDecisionLog(
      committeeFilter === "all" && statusFilter === "all" ? "Full Log" : "Filtered View",
      `${committeeName} · ${statusName}`,
      filtered.map((d) => ({
        decisionDate: d.decisionDate,
        decision: d.decision,
        bodyName: d.committeeName ?? "Congregation / General",
        statusLabel: DECISION_STATUS_LABELS[d.status],
        owner: d.owner,
        meetingTitle: d.meetingTitle,
        notes: d.notes,
      })),
    );
    if (!opened) {
      setActionError("Your browser blocked the print window. Please allow pop-ups for this site and try again.");
    }
  };

  return (
    <div className="space-y-8">
      <header className="border-b border-border pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-primary font-bold flex items-center gap-2">
            <Gavel className="w-7 h-7" /> Decision Log
          </h1>
          <p className="text-muted-foreground mt-1">
            Motions, approvals, and governance decisions across committees and the congregation.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handlePrint} disabled={isLoading}>
            <Printer className="w-4 h-4 mr-1.5" /> Print / Export
          </Button>
          {canCreate && (
            <Button onClick={() => { setFormOpen((v) => !v); setEditingId(null); setForm(emptyForm); }}>
              <Plus className="w-4 h-4 mr-1.5" /> Record Decision
            </Button>
          )}
        </div>
      </header>

      <div className="bg-muted/50 border border-border rounded-md px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
        <span className="text-muted-foreground">
          Looking for older decisions? The historical decision log lives in the handbook's Current Workroom.
        </span>
        <a
          href={DOCS_DECISION_LOG_URL}
          target="_blank"
          rel="noreferrer"
          className="text-primary font-medium inline-flex items-center gap-1 hover:underline whitespace-nowrap"
        >
          View historical log <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {actionError && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-md px-4 py-3 flex justify-between items-center">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {formOpen && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-serif font-semibold text-lg">{editingId ? "Edit Decision" : "Record a Decision"}</h3>
            <div className="space-y-1.5">
              <Label>Decision / Motion</Label>
              <textarea
                className={inputClass + " min-h-[80px]"}
                value={form.decision}
                onChange={(e) => setForm({ ...form, decision: e.target.value })}
                placeholder="What was decided or moved?"
              />
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Committee / Body</Label>
                <select
                  className={inputClass + " h-10"}
                  value={form.committeeId ?? ""}
                  onChange={(e) => setForm({ ...form, committeeId: e.target.value ? Number(e.target.value) : null, meetingId: null })}
                  disabled={!!editingId}
                >
                  {data?.canCreateGeneral && <option value="">Congregation / General</option>}
                  {data?.committees.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.decisionDate}
                  onChange={(e) => setForm({ ...form, decisionDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Outcome / Status</Label>
                <select
                  className={inputClass + " h-10"}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as DecisionInput["status"] })}
                >
                  {DECISION_STATUSES.map((s) => (
                    <option key={s} value={s}>{DECISION_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Input
                value={form.owner}
                onChange={(e) => setForm({ ...form, owner: e.target.value })}
                placeholder="Who owns this decision?"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea
                className={inputClass + " min-h-[80px]"}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Context, motion language, follow-up needed, etc."
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => save.mutate(form)}
                disabled={save.isPending || !form.decision.trim()}
              >
                {save.isPending ? "Saving..." : editingId ? "Save Changes" : "Save Decision"}
              </Button>
              <Button variant="outline" onClick={() => { setFormOpen(false); setEditingId(null); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <select
          className={inputClass + " h-10 w-auto"}
          value={committeeFilter}
          onChange={(e) => setCommitteeFilter(e.target.value)}
        >
          <option value="all">All bodies</option>
          <option value="general">Congregation / General</option>
          {data?.committees.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
        <select
          className={inputClass + " h-10 w-auto"}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          {DECISION_STATUSES.map((s) => (
            <option key={s} value={s}>{DECISION_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-muted rounded-lg"></div>
          <div className="h-24 bg-muted rounded-lg"></div>
        </div>
      ) : filtered.length ? (
        <div className="space-y-3">
          {filtered.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <p className="font-medium">{d.decision}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span>{formatDate(d.decisionDate)}</span>
                      <span className={`px-2 py-0.5 rounded-sm font-medium ${STATUS_STYLES[d.status] ?? "bg-muted"}`}>
                        {DECISION_STATUS_LABELS[d.status]}
                      </span>
                      {d.committeeId && d.committeeName ? (
                        <Link href={`/committees/${d.committeeId}`} className="text-primary hover:underline">
                          {d.committeeName}
                        </Link>
                      ) : (
                        <span>Congregation / General</span>
                      )}
                      {d.owner && <span>Owner: {d.owner}</span>}
                      {d.meetingTitle && (
                        <span className="text-primary">
                          From: {d.meetingTitle} ({formatDate(d.meetingDate)})
                        </span>
                      )}
                    </div>
                    {d.notes && (
                      <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{d.notes}</p>
                    )}
                  </div>
                  {d.canManage && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(d)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Delete this decision entry?")) remove.mutate(d.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-muted/50 rounded-lg border border-border border-dashed">
          <p className="text-muted-foreground">No decisions match the current filters.</p>
        </div>
      )}
    </div>
  );
}
