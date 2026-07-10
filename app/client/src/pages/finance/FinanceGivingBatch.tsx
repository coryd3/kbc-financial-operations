import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type ContributionInput } from "../../lib/api";
import { FinanceLayout } from "../../components/FinanceLayout";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "../../components/ui";
import { formatCents, parseDollars } from "../../lib/money";
import { CONTRIBUTION_METHODS, CONTRIBUTION_METHOD_LABELS, type ContributionMethod } from "@shared/schema";
import { format } from "date-fns";
import { ArrowLeft, Lock, Trash2, Pencil, AlertTriangle, CheckCircle2, RotateCcw, X } from "lucide-react";
import { useAuth } from "../../lib/auth";

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
  const { user } = useAuth();
  const roles = user?.roles ?? (user ? [user.role] : []);
  const canApprove = roles.includes("treasurer");
  const canPrepare = roles.includes("bookkeeper");

  const [entry, setEntry] = useState({ ...emptyEntry });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [externalLedgerReference, setExternalLedgerReference] = useState("");
  const [mismatchOverrideReason, setMismatchOverrideReason] = useState("");
  const [adjustment, setAdjustment] = useState<null | {
    id: number;
    donorName: string;
    fundId: number;
    amount: string;
    date: string;
    reason: string;
    externalLedgerReference: string;
  }>(null);
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
    mutationFn: (allowMismatch: boolean) => api.closeGivingBatch(id, {
      allowMismatch,
      externalLedgerReference,
      mismatchOverrideReason: allowMismatch ? mismatchOverrideReason : undefined,
    }),
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

  const deleteBatchMutation = useMutation({
    mutationFn: () => api.deleteGivingBatch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["givingBatches"] });
      setLocation("/finance/giving");
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong"),
  });

  const adjustmentMutation = useMutation({
    mutationFn: (value: NonNullable<typeof adjustment>) => {
      const replacementAmountCents = parseDollars(value.amount);
      if (!replacementAmountCents || replacementAmountCents <= 0) throw new Error("Enter a valid replacement amount");
      return api.adjustContribution(value.id, {
        replacementFundId: value.fundId,
        replacementAmountCents,
        replacementDate: value.date,
        reason: value.reason,
        externalLedgerReference: value.externalLedgerReference,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["givingBatches"] });
      setAdjustment(null);
      setLocation(`/finance/giving/${result.batch.id}`);
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "Unable to create adjustment"),
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
  const canEdit = isOpen && canPrepare;
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
              {canPrepare && contributions.length === 0 && (
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
              {canApprove && (
                <Button size="sm" onClick={() => closeMutation.mutate(false)} disabled={closeMutation.isPending || !externalLedgerReference.trim()}>
                  <Lock className="w-4 h-4 mr-1.5" /> Approve and Close
                </Button>
              )}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Closed records are corrected through an adjustment.</span>
          )}
        </div>
      </div>

      {isOpen && canApprove && (
        <div className="mb-4 max-w-xl space-y-1.5 rounded-md border border-border bg-muted/30 p-4">
          <Label htmlFor="external-ledger-reference">External ledger reference</Label>
          <Input
            id="external-ledger-reference"
            value={externalLedgerReference}
            onChange={(event) => setExternalLedgerReference(event.target.value)}
            placeholder="Deposit, journal, or accounting-system reference"
          />
          <p className="text-xs text-muted-foreground">Required before Treasurer approval. The external accounting system remains the official ledger.</p>
        </div>
      )}

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
                disabled={closeMutation.isPending || !mismatchOverrideReason.trim() || !externalLedgerReference.trim()}
              >
                Close anyway with the discrepancy noted
              </Button>
              <div className="mt-3 max-w-xl space-y-1.5">
                <Label htmlFor="mismatch-reason">Written reason for the mismatch override</Label>
                <Input id="mismatch-reason" value={mismatchOverrideReason} onChange={(event) => setMismatchOverrideReason(event.target.value)} />
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-8">
        {canEdit && (
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

        <div className={canEdit ? "lg:col-span-3" : "lg:col-span-5"}>
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
                    {(canEdit || (canPrepare && !isOpen && batch.kind === "regular")) && <th className="px-3 py-2 w-20" />}
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
                      {canEdit && (
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
                      {!isOpen && canPrepare && batch.kind === "regular" && (
                        <td className="px-3 py-2 text-right">
                          <button
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Create correction adjustment"
                            onClick={() => setAdjustment({
                              id: c.id,
                              donorName: c.donorName,
                              fundId: c.fundId,
                              amount: (c.amountCents / 100).toFixed(2),
                              date: c.contributionDate,
                              reason: "",
                              externalLedgerReference: "",
                            })}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30">
                  <tr className="border-t border-border">
                    <td className="px-3 py-2 font-semibold" colSpan={4}>Total</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCents(batch.totalCents)}</td>
                    {(canEdit || (canPrepare && !isOpen && batch.kind === "regular")) && <td />}
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
      {adjustment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl">Create Contribution Adjustment</CardTitle>
              <button onClick={() => setAdjustment(null)} aria-label="Close"><X className="h-5 w-5" /></button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The original entry for {adjustment.donorName} will remain unchanged. This creates a reversal and replacement batch for Treasurer approval.
              </p>
              <div>
                <Label htmlFor="adjust-fund">Replacement fund</Label>
                <select id="adjust-fund" className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3" value={adjustment.fundId} onChange={(event) => setAdjustment({ ...adjustment, fundId: Number(event.target.value) })}>
                  {activeFunds.map((fund) => <option key={fund.id} value={fund.id}>{fund.name}</option>)}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor="adjust-amount">Replacement amount</Label><Input id="adjust-amount" value={adjustment.amount} onChange={(event) => setAdjustment({ ...adjustment, amount: event.target.value })} /></div>
                <div><Label htmlFor="adjust-date">Replacement date</Label><Input id="adjust-date" type="date" value={adjustment.date} onChange={(event) => setAdjustment({ ...adjustment, date: event.target.value })} /></div>
              </div>
              <div><Label htmlFor="adjust-reason">Reason</Label><textarea id="adjust-reason" className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2" value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} /></div>
              <div><Label htmlFor="adjust-ledger">External ledger reference</Label><Input id="adjust-ledger" value={adjustment.externalLedgerReference} onChange={(event) => setAdjustment({ ...adjustment, externalLedgerReference: event.target.value })} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAdjustment(null)}>Cancel</Button>
                <Button disabled={adjustmentMutation.isPending || adjustment.reason.trim().length < 10 || !adjustment.externalLedgerReference.trim()} onClick={() => adjustmentMutation.mutate(adjustment)}>
                  {adjustmentMutation.isPending ? "Creating..." : "Create Adjustment"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </FinanceLayout>
  );
}
