import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type ContributionInput } from "../../lib/api";
import { FinanceLayout } from "../../components/FinanceLayout";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "../../components/ui";
import { formatCents, parseDollars } from "../../lib/money";
import { CONTRIBUTION_METHODS, CONTRIBUTION_METHOD_LABELS, type ContributionMethod } from "@shared/schema";
import { format } from "date-fns";
import { ArrowLeft, Lock, Trash2, Pencil, AlertTriangle, CheckCircle2 } from "lucide-react";

function fmtDate(d: string) {
  return format(new Date(d + "T00:00:00"), "MMM d, yyyy");
}

const emptyEntry = {
  donorId: "",
  fundId: "",
  contributionDate: "",
  amount: "",
  method: "check" as ContributionMethod,
  checkNumber: "",
  note: "",
};

export default function FinanceGivingBatch() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [entry, setEntry] = useState({ ...emptyEntry });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState<{
    varianceCents: number | null;
    batchTotalCents: number | null;
    countTotalCents: number | null;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["givingBatch", id],
    queryFn: () => api.getGivingBatch(id),
    enabled: Number.isInteger(id),
  });
  const { data: donorsData } = useQuery({
    queryKey: ["donors", "active"],
    queryFn: () => api.getDonors({ activeOnly: true }),
  });
  const { data: fundsData } = useQuery({ queryKey: ["givingFunds"], queryFn: api.getGivingFunds });

  const activeFunds = useMemo(() => (fundsData?.funds ?? []).filter((f) => f.isActive), [fundsData]);
  const sortedDonors = donorsData?.donors ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["givingBatch", id] });
    queryClient.invalidateQueries({ queryKey: ["givingBatches"] });
    queryClient.invalidateQueries({ queryKey: ["donors"] });
  };

  const saveMutation = useMutation({
    mutationFn: (input: ContributionInput) =>
      editingId ? api.updateContribution(editingId, input) : api.createContribution(id, input),
    onSuccess: () => {
      invalidate();
      setEntry((e) => ({ ...emptyEntry, contributionDate: e.contributionDate, method: e.method, fundId: e.fundId }));
      setEditingId(null);
      setError(null);
      setMismatch(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong"),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteContribution,
    onSuccess: () => invalidate(),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong"),
  });

  const closeMutation = useMutation({
    mutationFn: (allowMismatch: boolean) => api.closeGivingBatch(id, allowMismatch),
    onSuccess: () => {
      invalidate();
      setMismatch(null);
      setError(null);
    },
    onError: async (e: any) => {
      if (e instanceof ApiError && e.status === 409) {
        setError(e.message);
        const body = e.body ?? {};
        setMismatch({
          varianceCents: typeof body.varianceCents === "number" ? body.varianceCents : null,
          batchTotalCents: typeof body.batchTotalCents === "number" ? body.batchTotalCents : null,
          countTotalCents: typeof body.countTotalCents === "number" ? body.countTotalCents : null,
        });
      } else {
        setError(e instanceof ApiError ? e.message : "Something went wrong");
      }
    },
  });

  const reopenMutation = useMutation({
    mutationFn: () => api.reopenGivingBatch(id),
    onSuccess: () => invalidate(),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong"),
  });

  const deleteBatchMutation = useMutation({
    mutationFn: () => api.deleteGivingBatch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["givingBatches"] });
      setLocation("/finance/giving");
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong"),
  });

  if (isLoading || !data) {
    return (
      <FinanceLayout title="Contribution Batch">
        <div className="animate-pulse h-48 bg-muted rounded-lg" />
      </FinanceLayout>
    );
  }

  const { batch, contributions } = data;
  const isOpen = batch.status === "open";
  const variance = batch.countTotalCents != null ? batch.totalCents - batch.countTotalCents : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amountCents = parseDollars(entry.amount);
    if (amountCents === null || amountCents <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    if (!entry.donorId) {
      setError("Please choose a donor");
      return;
    }
    if (!entry.fundId) {
      setError("Please choose a fund");
      return;
    }
    saveMutation.mutate({
      donorId: Number(entry.donorId),
      fundId: Number(entry.fundId),
      contributionDate: entry.contributionDate || undefined,
      amountCents,
      method: entry.method,
      checkNumber: entry.checkNumber,
      note: entry.note,
    });
  };

  const startEdit = (c: (typeof contributions)[number]) => {
    setEditingId(c.id);
    setEntry({
      donorId: String(c.donorId),
      fundId: String(c.fundId),
      contributionDate: c.contributionDate,
      amount: (c.amountCents / 100).toFixed(2),
      method: c.method,
      checkNumber: c.checkNumber ?? "",
      note: c.note ?? "",
    });
    setError(null);
  };

  return (
    <FinanceLayout
      title={`Batch #${batch.id} — ${fmtDate(batch.batchDate)}`}
      description={batch.description || "Individual contribution entry"}
    >
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <Link href="/finance/giving" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> All batches
        </Link>
        <div className="flex items-center gap-2">
          {isOpen ? (
            <>
              {contributions.length === 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Delete this empty batch?")) deleteBatchMutation.mutate();
                  }}
                  disabled={deleteBatchMutation.isPending}
                >
                  Delete Batch
                </Button>
              )}
              <Button size="sm" onClick={() => closeMutation.mutate(false)} disabled={closeMutation.isPending}>
                <Lock className="w-4 h-4 mr-1.5" /> Close Batch
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => reopenMutation.mutate()} disabled={reopenMutation.isPending}>
              Reopen Batch
            </Button>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Batch total</p>
            <p className="text-2xl font-semibold mt-1">{formatCents(batch.totalCents)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {batch.contributionCount} contribution{batch.contributionCount === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Offering count</p>
            {batch.countTotalCents != null ? (
              <>
                <p className="text-2xl font-semibold mt-1">{formatCents(batch.countTotalCents)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Count #{batch.offeringCountId}
                  {batch.countDate ? ` — ${fmtDate(batch.countDate)}` : ""}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">No count linked</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Reconciliation</p>
            {variance == null ? (
              <p className="text-sm text-muted-foreground mt-2">Nothing to reconcile against</p>
            ) : variance === 0 ? (
              <p className="text-sm mt-2 inline-flex items-center gap-1.5 text-green-700 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Matches the offering count
              </p>
            ) : (
              <p className="text-sm mt-2 inline-flex items-center gap-1.5 text-amber-700 font-medium">
                <AlertTriangle className="w-4 h-4" />
                {variance > 0 ? "Over" : "Under"} by {formatCents(Math.abs(variance))}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <p>{error}</p>
          {mismatch && isOpen && (
            <>
              {mismatch.batchTotalCents != null && mismatch.countTotalCents != null && mismatch.varianceCents != null && (
                <div className="mt-3 rounded-md border border-destructive/30 bg-background/60 px-3 py-2 max-w-sm">
                  <dl className="space-y-1">
                    <div className="flex items-center justify-between gap-6">
                      <dt className="text-muted-foreground">Batch total</dt>
                      <dd className="font-medium tabular-nums text-foreground">
                        {formatCents(mismatch.batchTotalCents)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-6">
                      <dt className="text-muted-foreground">Offering count total</dt>
                      <dd className="font-medium tabular-nums text-foreground">
                        {formatCents(mismatch.countTotalCents)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-6 border-t border-destructive/20 pt-1">
                      <dt className="font-medium">Difference</dt>
                      <dd className="font-semibold tabular-nums">
                        {mismatch.varianceCents > 0 ? "+" : "−"}
                        {formatCents(Math.abs(mismatch.varianceCents))}{" "}
                        {mismatch.varianceCents > 0 ? "over" : "under"}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
              <Button
                size="sm"
                variant="destructive"
                className="mt-3"
                onClick={() => closeMutation.mutate(true)}
                disabled={closeMutation.isPending}
              >
                Close anyway with the discrepancy noted
              </Button>
            </>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-8">
        {isOpen && (
          <Card className="lg:col-span-2 h-max">
            <CardHeader>
              <CardTitle className="text-xl">{editingId ? `Edit Contribution #${editingId}` : "Add Contribution"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="donor">Donor</Label>
                  <select
                    id="donor"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={entry.donorId}
                    onChange={(e) => setEntry((f) => ({ ...f, donorId: e.target.value }))}
                  >
                    <option value="">Choose a donor...</option>
                    {sortedDonors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.lastName}, {d.firstName}
                        {d.envelopeNumber ? ` (#${d.envelopeNumber})` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Missing someone? Add them on the <Link href="/finance/donors" className="underline">Donors</Link> page first.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fund">Fund</Label>
                    <select
                      id="fund"
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={entry.fundId}
                      onChange={(e) => setEntry((f) => ({ ...f, fundId: e.target.value }))}
                    >
                      <option value="">Choose...</option>
                      {activeFunds.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="amount">Amount $</Label>
                    <Input
                      id="amount"
                      inputMode="decimal"
                      required
                      placeholder="0.00"
                      value={entry.amount}
                      onChange={(e) => setEntry((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="method">Method</Label>
                    <select
                      id="method"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={entry.method}
                      onChange={(e) => setEntry((f) => ({ ...f, method: e.target.value as ContributionMethod }))}
                    >
                      {CONTRIBUTION_METHODS.map((m) => (
                        <option key={m} value={m}>{CONTRIBUTION_METHOD_LABELS[m]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="checkNumber">Check #</Label>
                    <Input
                      id="checkNumber"
                      placeholder={entry.method === "check" ? "Required" : "N/A"}
                      disabled={entry.method !== "check"}
                      value={entry.checkNumber}
                      onChange={(e) => setEntry((f) => ({ ...f, checkNumber: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="contributionDate">Date</Label>
                    <Input
                      id="contributionDate"
                      type="date"
                      value={entry.contributionDate}
                      onChange={(e) => setEntry((f) => ({ ...f, contributionDate: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">Blank = batch date</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="note">Note</Label>
                    <Input
                      id="note"
                      placeholder="Optional"
                      value={entry.note}
                      onChange={(e) => setEntry((f) => ({ ...f, note: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Saving..." : editingId ? "Save Changes" : "Add Contribution"}
                  </Button>
                  {editingId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingId(null);
                        setEntry({ ...emptyEntry });
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className={isOpen ? "lg:col-span-3" : "lg:col-span-5"}>
          {contributions.length ? (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Donor</th>
                    <th className="px-3 py-2 font-medium">Fund</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Method</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                    {isOpen && <th className="px-3 py-2 w-20" />}
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        {c.donorName}
                        {c.note && <div className="text-xs text-muted-foreground italic">{c.note}</div>}
                      </td>
                      <td className="px-3 py-2">{c.fundName}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(c.contributionDate)}</td>
                      <td className="px-3 py-2">
                        {CONTRIBUTION_METHOD_LABELS[c.method]}
                        {c.checkNumber ? ` #${c.checkNumber}` : ""}
                      </td>
                      <td className="px-3 py-2 text-right font-medium whitespace-nowrap">{formatCents(c.amountCents)}</td>
                      {isOpen && (
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <button
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Edit"
                              onClick={() => startEdit(c)}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                              title="Delete"
                              onClick={() => {
                                if (confirm("Remove this contribution?")) deleteMutation.mutate(c.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30">
                  <tr className="border-t border-border">
                    <td className="px-3 py-2 font-semibold" colSpan={4}>Total</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCents(batch.totalCents)}</td>
                    {isOpen && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/50 rounded-lg border border-border border-dashed">
              <p className="text-muted-foreground">No contributions in this batch yet.</p>
            </div>
          )}
        </div>
      </div>
    </FinanceLayout>
  );
}
