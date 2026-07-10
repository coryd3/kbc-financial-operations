import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { CLOSE_MANAGE_ROLES, CLOSE_SIGNOFF_ROLES, GIVING_ROLES } from "@shared/schema";
import { FinanceLayout } from "../../components/FinanceLayout";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "../../components/ui";
import { MONTH_NAMES, formatCents } from "../../lib/money";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Lock, RotateCcw } from "lucide-react";

export default function FinanceClose() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = !!user && CLOSE_MANAGE_ROLES.includes(user.role);
  const canSignoff = !!user && CLOSE_SIGNOFF_ROLES.includes(user.role);
  const canViewGiving = !!user && GIVING_ROLES.includes(user.role);

  const now = new Date();
  const [newYear, setNewYear] = useState(String(now.getFullYear()));
  const [newMonth, setNewMonth] = useState(String(now.getMonth() + 1));
  const [signoffNotes, setSignoffNotes] = useState<Record<number, string>>({});
  const [acknowledged, setAcknowledged] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["closes"], queryFn: api.getCloses });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["closes"] });
  const onError = (e: unknown) => setError(e instanceof ApiError ? e.message : "Something went wrong");

  const createMutation = useMutation({
    mutationFn: api.createClose,
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError,
  });
  const toggleMutation = useMutation({
    mutationFn: (v: { closeId: number; itemId: number; isDone: boolean }) =>
      api.toggleCloseItem(v.closeId, v.itemId, v.isDone),
    onSuccess: invalidate,
    onError,
  });
  const signoffMutation = useMutation({
    mutationFn: (v: { id: number; notes?: string; acknowledgeOpenBatches?: boolean }) =>
      api.signoffClose(v.id, v.notes, v.acknowledgeOpenBatches),
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError,
  });
  const reopenMutation = useMutation({
    mutationFn: (id: number) => api.reopenClose(id),
    onSuccess: invalidate,
    onError,
  });

  const statusBadge = (status: string) => {
    if (status === "closed")
      return (
        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-green-100 text-green-800 px-2 py-0.5 rounded-sm">
          <Lock className="w-3 h-3" /> Closed
        </span>
      );
    if (status === "in_review")
      return (
        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-sm">
          In Review
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-sm">
        Open
      </span>
    );
  };

  return (
    <FinanceLayout
      title="Monthly Close"
      description="Work through the close checklist each month. The Treasurer signs off once every item is complete."
    >
      <div className="space-y-6">
        {canManage && (
          <Card>
            <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="closeMonth">Month</Label>
                <select
                  id="closeMonth"
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newMonth}
                  onChange={(e) => setNewMonth(e.target.value)}
                >
                  {MONTH_NAMES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="closeYear">Year</Label>
                <Input
                  id="closeYear"
                  type="number"
                  className="w-28"
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                />
              </div>
              <Button
                onClick={() => createMutation.mutate({ year: Number(newYear), month: Number(newMonth) })}
                disabled={createMutation.isPending}
              >
                Start Month Close
              </Button>
              {error && <p className="text-sm text-destructive md:ml-4">{error}</p>}
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="animate-pulse h-32 bg-muted rounded-lg" />
        ) : data?.closes.length ? (
          <div className="space-y-4">
            {data.closes.map((close) => {
              const doneCount = close.items.filter((i) => i.isDone).length;
              const allDone = doneCount === close.items.length && close.items.length > 0;
              const isClosed = close.status === "closed";
              const openBatches = close.openBatches ?? [];
              const hasOpenBatches = !isClosed && openBatches.length > 0;
              const isAcknowledged = !!acknowledged[close.id];
              return (
                <Card key={close.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-xl">
                          {MONTH_NAMES[close.month - 1]} {close.year}
                        </CardTitle>
                        {statusBadge(close.status)}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {doneCount} of {close.items.length} items complete
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      {close.items.map((item) => (
                        <label
                          key={item.id}
                          className={
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm border border-border " +
                            (canManage && !isClosed ? "cursor-pointer hover:bg-muted/50" : "opacity-90")
                          }
                        >
                          <input
                            type="checkbox"
                            checked={item.isDone}
                            disabled={!canManage || isClosed || toggleMutation.isPending}
                            onChange={(e) =>
                              toggleMutation.mutate({
                                closeId: close.id,
                                itemId: item.id,
                                isDone: e.target.checked,
                              })
                            }
                            className="rounded border-input"
                          />
                          <span className={item.isDone ? "line-through text-muted-foreground" : ""}>{item.label}</span>
                          {item.isDone && item.completedAt && (
                            <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(item.completedAt), "MMM d")}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>

                    {hasOpenBatches && (
                      <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 space-y-2">
                        <p className="text-sm font-medium text-amber-900 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          {openBatches.length === 1
                            ? "1 contribution batch is still open for this month"
                            : `${openBatches.length} contribution batches are still open for this month`}
                        </p>
                        <ul className="text-sm text-amber-900 space-y-1 pl-6">
                          {openBatches.map((b) => (
                            <li key={b.id} className="list-disc">
                              {canViewGiving ? (
                                <Link
                                  href={`/finance/giving/${b.id}`}
                                  className="underline underline-offset-2 hover:text-amber-700"
                                >
                                  {format(new Date(b.batchDate + "T00:00:00"), "MMM d, yyyy")}
                                  {b.description ? ` — ${b.description}` : ""}
                                </Link>
                              ) : (
                                <span>
                                  {format(new Date(b.batchDate + "T00:00:00"), "MMM d, yyyy")}
                                  {b.description ? ` — ${b.description}` : ""}
                                </span>
                              )}{" "}
                              <span className="text-amber-700">
                                ({b.contributionCount} {b.contributionCount === 1 ? "entry" : "entries"},{" "}
                                {formatCents(b.totalCents)})
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-amber-800 pl-6">
                          {canViewGiving
                            ? "Close these batches in Giving before signing off, or acknowledge below to sign off anyway."
                            : "These batches must be closed in Giving (Treasurer/Bookkeeper) before sign-off, or acknowledged by the signer."}
                        </p>
                      </div>
                    )}

                    {isClosed ? (
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-green-50 border border-green-200 rounded-md px-4 py-3">
                        <p className="text-sm text-green-900 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          Signed off{close.signedOffByName ? ` by ${close.signedOffByName}` : ""}
                          {close.signedOffAt ? ` on ${format(new Date(close.signedOffAt), "MMM d, yyyy")}` : ""}
                          {close.notes ? ` — ${close.notes}` : ""}
                        </p>
                        {canSignoff && (
                          <Button size="sm" variant="outline" onClick={() => reopenMutation.mutate(close.id)}>
                            <RotateCcw className="w-4 h-4 mr-1" /> Reopen
                          </Button>
                        )}
                      </div>
                    ) : canSignoff ? (
                      <div className="space-y-2">
                        {hasOpenBatches && (
                          <label className="flex items-start gap-2 text-sm text-amber-900 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded border-input"
                              checked={isAcknowledged}
                              onChange={(e) =>
                                setAcknowledged((s) => ({ ...s, [close.id]: e.target.checked }))
                              }
                            />
                            <span>
                              I acknowledge the open contribution {openBatches.length === 1 ? "batch" : "batches"}{" "}
                              above and want to sign off this month anyway.
                            </span>
                          </label>
                        )}
                        <div className="flex flex-col md:flex-row gap-2 md:items-center">
                          <Input
                            placeholder="Sign-off notes (optional)"
                            value={signoffNotes[close.id] ?? ""}
                            onChange={(e) => setSignoffNotes((s) => ({ ...s, [close.id]: e.target.value }))}
                          />
                          <Button
                            variant="accent"
                            className="whitespace-nowrap"
                            disabled={!allDone || (hasOpenBatches && !isAcknowledged) || signoffMutation.isPending}
                            title={
                              !allDone
                                ? "All checklist items must be completed first"
                                : hasOpenBatches && !isAcknowledged
                                  ? "Close the open contribution batches or acknowledge them first"
                                  : ""
                            }
                            onClick={() =>
                              signoffMutation.mutate({
                                id: close.id,
                                notes: signoffNotes[close.id],
                                acknowledgeOpenBatches: hasOpenBatches ? isAcknowledged : undefined,
                              })
                            }
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Treasurer Sign-off
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Awaiting Treasurer sign-off once all items are complete.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/50 rounded-lg border border-border border-dashed">
            <p className="text-muted-foreground">No monthly close records yet. Start one above.</p>
          </div>
        )}
      </div>
    </FinanceLayout>
  );
}
