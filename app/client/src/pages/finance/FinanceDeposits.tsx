import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { FinanceLayout } from "../../components/FinanceLayout";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "../../components/ui";
import { formatCents, parseDollars } from "../../lib/money";
import { format } from "date-fns";
import { BadgeCheck, Link2 } from "lucide-react";

export default function FinanceDeposits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const roles = user?.roles ?? (user ? [user.role] : []);
  const canPrepare = roles.includes("bookkeeper");
  const canReconcile = roles.includes("treasurer");

  const [form, setForm] = useState({
    depositDate: format(new Date(), "yyyy-MM-dd"),
    amount: "",
    bankRef: "",
    notes: "",
  });
  const [selectedCounts, setSelectedCounts] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: depositsData, isLoading } = useQuery({ queryKey: ["deposits"], queryFn: api.getDeposits });
  const { data: unlinkedData } = useQuery({
    queryKey: ["counts", "unlinked"],
    queryFn: () => api.getCounts(true),
    enabled: canPrepare,
  });

  const verifiedUnlinked = useMemo(
    () => (unlinkedData?.counts ?? []).filter((c) => c.status === "verified"),
    [unlinkedData],
  );

  const linkedTotal = verifiedUnlinked
    .filter((c) => selectedCounts.includes(c.id))
    .reduce((sum, c) => sum + c.totalCents, 0);

  const createMutation = useMutation({
    mutationFn: api.createDeposit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deposits"] });
      queryClient.invalidateQueries({ queryKey: ["counts"] });
      setForm({ depositDate: format(new Date(), "yyyy-MM-dd"), amount: "", bankRef: "", notes: "" });
      setSelectedCounts([]);
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong"),
  });

  const reconcileMutation = useMutation({
    mutationFn: (id: number) => api.reconcileDeposit(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deposits"] }),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amountCents = parseDollars(form.amount);
    if (amountCents === null || amountCents <= 0) {
      setError("Please enter a valid deposit amount");
      return;
    }
    createMutation.mutate({
      depositDate: form.depositDate,
      amountCents,
      bankRef: form.bankRef,
      notes: form.notes,
      countIds: selectedCounts,
    });
  };

  const toggleCount = (id: number) =>
    setSelectedCounts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <FinanceLayout
      title="Deposits"
      description="Record bank deposits, link them to verified offering counts, and mark them reconciled against the bank statement."
    >
      <div className="grid lg:grid-cols-5 gap-8">
        {canPrepare && (
          <Card className="lg:col-span-2 h-max">
            <CardHeader>
              <CardTitle className="text-xl">Record Deposit</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="depositDate">Deposit date</Label>
                    <Input
                      id="depositDate"
                      type="date"
                      required
                      value={form.depositDate}
                      onChange={(e) => setForm((f) => ({ ...f, depositDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="amount">Amount $</Label>
                    <Input
                      id="amount"
                      inputMode="decimal"
                      required
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bankRef">Bank reference / deposit slip #</Label>
                  <Input
                    id="bankRef"
                    placeholder="Optional"
                    value={form.bankRef}
                    onChange={(e) => setForm((f) => ({ ...f, bankRef: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="depositNotes">Notes</Label>
                  <Input
                    id="depositNotes"
                    placeholder="Optional"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Link verified counts</Label>
                  {verifiedUnlinked.length ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto border border-border rounded-md p-2">
                      {verifiedUnlinked.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted rounded px-1.5 py-1">
                          <input
                            type="checkbox"
                            checked={selectedCounts.includes(c.id)}
                            onChange={() => toggleCount(c.id)}
                            className="rounded border-input"
                          />
                          <span className="flex-1">
                            {format(new Date(c.countDate + "T00:00:00"), "MMM d, yyyy")}
                            {c.serviceNote ? ` — ${c.serviceNote}` : ""}
                          </span>
                          <span className="font-medium">{formatCents(c.totalCents)}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No verified, undeposited counts available. Counts must be confirmed by a second person first.
                    </p>
                  )}
                  {selectedCounts.length > 0 && (
                    <div className="flex justify-between text-sm bg-muted rounded-md px-3 py-2">
                      <span>Selected counts total</span>
                      <span className="font-semibold">{formatCents(linkedTotal)}</span>
                    </div>
                  )}
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Recording..." : "Record Deposit"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className={canPrepare ? "lg:col-span-3 space-y-3" : "lg:col-span-5 space-y-3"}>
          {isLoading ? (
            <div className="animate-pulse h-32 bg-muted rounded-lg" />
          ) : depositsData?.deposits.length ? (
            depositsData.deposits.map((d) => (
              <Card key={d.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          Deposit #{d.id} — {format(new Date(d.depositDate + "T00:00:00"), "MMM d, yyyy")}
                        </span>
                        {d.status === "reconciled" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-green-100 text-green-800 px-2 py-0.5 rounded-sm">
                            <BadgeCheck className="w-3 h-3" /> Reconciled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-sm">
                            Recorded
                          </span>
                        )}
                      </div>
                      {d.bankRef && <p className="text-sm text-muted-foreground mt-1">Ref: {d.bankRef}</p>}
                      {d.counts.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                          <Link2 className="w-3 h-3" />
                          {d.counts
                            .map(
                              (c) =>
                                `Count #${c.id} (${format(new Date(c.countDate + "T00:00:00"), "MMM d")}, ${formatCents(c.totalCents)})`,
                            )
                            .join(" · ")}
                        </p>
                      )}
                      {d.notes && <p className="text-xs text-muted-foreground mt-1 italic">{d.notes}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold whitespace-nowrap">{formatCents(d.amountCents)}</span>
                      {canReconcile && d.status === "recorded" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reconcileMutation.mutate(d.id)}
                          disabled={reconcileMutation.isPending}
                        >
                          Mark Reconciled
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 bg-muted/50 rounded-lg border border-border border-dashed">
              <p className="text-muted-foreground">No deposits recorded yet.</p>
            </div>
          )}
        </div>
      </div>
    </FinanceLayout>
  );
}
