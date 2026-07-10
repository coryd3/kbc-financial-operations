import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { FinanceLayout } from "../../components/FinanceLayout";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "../../components/ui";
import { formatCents } from "../../lib/money";
import { format } from "date-fns";
import { Lock, Link2, AlertTriangle } from "lucide-react";

function fmtDate(d: string) {
  return format(new Date(d + "T00:00:00"), "MMM d, yyyy");
}

export default function FinanceGiving() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({
    batchDate: format(new Date(), "yyyy-MM-dd"),
    description: "",
    offeringCountId: "" as string,
  });
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["givingBatches"], queryFn: api.getGivingBatches });
  const { data: countsData } = useQuery({ queryKey: ["counts"], queryFn: () => api.getCounts() });

  const linkedCountIds = new Set((data?.batches ?? []).map((b) => b.offeringCountId).filter(Boolean));
  const linkableCounts = (countsData?.counts ?? []).filter((c) => !linkedCountIds.has(c.id));

  const createMutation = useMutation({
    mutationFn: api.createGivingBatch,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["givingBatches"] });
      setError(null);
      setLocation(`/finance/giving/${res.batch.id}`);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate({
      batchDate: form.batchDate,
      description: form.description,
      offeringCountId: form.offeringCountId ? Number(form.offeringCountId) : null,
    });
  };

  return (
    <FinanceLayout
      title="Contribution Batches"
      description="Enter individual contributions in batches and reconcile each batch against its offering count. Individual giving records are visible only to the Bookkeeper, Treasurer, and Super Admin."
    >
      <div className="grid lg:grid-cols-5 gap-8">
        <Card className="lg:col-span-2 h-max">
          <CardHeader>
            <CardTitle className="text-xl">Start a Batch</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="batchDate">Batch date</Label>
                <Input
                  id="batchDate"
                  type="date"
                  required
                  value={form.batchDate}
                  onChange={(e) => setForm((f) => ({ ...f, batchDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batchDescription">Description</Label>
                <Input
                  id="batchDescription"
                  placeholder="e.g. Sunday morning offering"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="offeringCount">Reconcile against offering count</Label>
                <select
                  id="offeringCount"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.offeringCountId}
                  onChange={(e) => setForm((f) => ({ ...f, offeringCountId: e.target.value }))}
                >
                  <option value="">No linked count (optional)</option>
                  {linkableCounts.map((c) => (
                    <option key={c.id} value={c.id}>
                      Count #{c.id} — {fmtDate(c.countDate)} — {formatCents(c.totalCents)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Linking a count lets the portal verify the batch total matches the counted offering before the batch is closed.
                </p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Start Batch"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-3">
          {isLoading ? (
            <div className="animate-pulse h-32 bg-muted rounded-lg" />
          ) : data?.batches.length ? (
            data.batches.map((b) => {
              const variance = b.countTotalCents != null ? b.totalCents - b.countTotalCents : null;
              return (
                <Link key={b.id} href={`/finance/giving/${b.id}`} className="block">
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              Batch #{b.id} — {fmtDate(b.batchDate)}
                            </span>
                            {b.status === "closed" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-green-100 text-green-800 px-2 py-0.5 rounded-sm">
                                <Lock className="w-3 h-3" /> Closed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-sm">
                                Open
                              </span>
                            )}
                          </div>
                          {b.description && <p className="text-sm text-muted-foreground mt-1">{b.description}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            {b.contributionCount} contribution{b.contributionCount === 1 ? "" : "s"}
                            {b.enteredByName ? ` · entered by ${b.enteredByName}` : ""}
                          </p>
                          {b.offeringCountId != null && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                              <Link2 className="w-3 h-3" />
                              Count #{b.offeringCountId}
                              {b.countTotalCents != null ? ` (${formatCents(b.countTotalCents)})` : ""}
                              {variance != null && variance !== 0 && (
                                <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                                  <AlertTriangle className="w-3 h-3" />
                                  {variance > 0 ? "over" : "under"} by {formatCents(Math.abs(variance))}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                        <span className="text-lg font-semibold whitespace-nowrap">{formatCents(b.totalCents)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          ) : (
            <div className="text-center py-12 bg-muted/50 rounded-lg border border-border border-dashed">
              <p className="text-muted-foreground">No contribution batches yet. Start one to record individual giving.</p>
            </div>
          )}
        </div>
      </div>
    </FinanceLayout>
  );
}
