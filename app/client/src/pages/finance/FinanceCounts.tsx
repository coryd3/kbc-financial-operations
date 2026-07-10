import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { COUNT_ENTRY_ROLES } from "@shared/schema";
import { FinanceLayout } from "../../components/FinanceLayout";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "../../components/ui";
import { formatCents, parseDollars } from "../../lib/money";
import { format } from "date-fns";
import { CheckCircle2, ShieldCheck, Link2 } from "lucide-react";

const emptyForm = {
  countDate: format(new Date(), "yyyy-MM-dd"),
  serviceNote: "",
  cash: "",
  coin: "",
  checks: "",
  checkCount: "",
  other: "",
  counter1: "",
  counter2: "",
  notes: "",
};

export default function FinanceCounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canEnter = !!user && COUNT_ENTRY_ROLES.includes(user.role);

  const { data, isLoading } = useQuery({ queryKey: ["counts"], queryFn: () => api.getCounts() });

  const createMutation = useMutation({
    mutationFn: api.createCount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["counts"] });
      setForm(emptyForm);
      setError(null);
      setSuccess("Count sheet submitted. A second person must confirm it before it can be deposited.");
    },
    onError: (e) => {
      setSuccess(null);
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (id: number) => api.verifyCount(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["counts"] }),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong"),
  });

  const set = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const dollars = (v: string) => parseDollars(v) ?? 0;
  const formTotal = dollars(form.cash) + dollars(form.coin) + dollars(form.checks) + dollars(form.other);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const cash = parseDollars(form.cash);
    const coin = parseDollars(form.coin);
    const checks = parseDollars(form.checks);
    const other = parseDollars(form.other);
    if (cash === null || coin === null || checks === null || other === null) {
      setError("Please enter valid dollar amounts");
      return;
    }
    createMutation.mutate({
      countDate: form.countDate,
      serviceNote: form.serviceNote,
      cashCents: cash,
      coinCents: coin,
      checksCents: checks,
      checkCount: Number(form.checkCount) || 0,
      otherCents: other,
      notes: form.notes,
      counter1: form.counter1,
      counter2: form.counter2,
    });
  };

  return (
    <FinanceLayout
      title="Weekly Offering Counts"
      description="Count sheets require two counters and confirmation by a second portal user before deposit."
    >
      <div className="grid lg:grid-cols-5 gap-8">
        {canEnter && (
          <Card className="lg:col-span-2 h-max">
            <CardHeader>
              <CardTitle className="text-xl">New Count Sheet</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="countDate">Count date</Label>
                    <Input id="countDate" type="date" required value={form.countDate} onChange={set("countDate")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="serviceNote">Service</Label>
                    <Input id="serviceNote" placeholder="e.g., Sunday AM" value={form.serviceNote} onChange={set("serviceNote")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cash">Currency (bills) $</Label>
                    <Input id="cash" inputMode="decimal" placeholder="0.00" value={form.cash} onChange={set("cash")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="coin">Coin $</Label>
                    <Input id="coin" inputMode="decimal" placeholder="0.00" value={form.coin} onChange={set("coin")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="checks">Checks total $</Label>
                    <Input id="checks" inputMode="decimal" placeholder="0.00" value={form.checks} onChange={set("checks")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="checkCount"># of checks</Label>
                    <Input id="checkCount" type="number" min="0" placeholder="0" value={form.checkCount} onChange={set("checkCount")} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="other">Other (money orders, etc.) $</Label>
                  <Input id="other" inputMode="decimal" placeholder="0.00" value={form.other} onChange={set("other")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="counter1">Counter 1</Label>
                    <Input id="counter1" required placeholder="Full name" value={form.counter1} onChange={set("counter1")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="counter2">Counter 2</Label>
                    <Input id="counter2" required placeholder="Full name" value={form.counter2} onChange={set("counter2")} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" placeholder="Optional" value={form.notes} onChange={set("notes")} />
                </div>
                <div className="flex items-center justify-between bg-muted rounded-md px-3 py-2">
                  <span className="text-sm font-medium">Count total</span>
                  <span className="font-semibold">{formatCents(formTotal)}</span>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                {success && <p className="text-sm text-green-700">{success}</p>}
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Submitting..." : "Submit Count Sheet"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className={canEnter ? "lg:col-span-3 space-y-3" : "lg:col-span-5 space-y-3"}>
          {isLoading ? (
            <div className="animate-pulse h-32 bg-muted rounded-lg" />
          ) : data?.counts.length ? (
            data.counts.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {format(new Date(c.countDate + "T00:00:00"), "EEE, MMM d, yyyy")}
                        </span>
                        {c.serviceNote && <span className="text-sm text-muted-foreground">{c.serviceNote}</span>}
                        {c.status === "verified" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-green-100 text-green-800 px-2 py-0.5 rounded-sm">
                            <ShieldCheck className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-sm">
                            Awaiting confirmation
                          </span>
                        )}
                        {c.depositId && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-sm">
                            <Link2 className="w-3 h-3" /> Deposit #{c.depositId}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Cash {formatCents(c.cashCents + c.coinCents)} &middot; Checks {formatCents(c.checksCents)} ({c.checkCount})
                        {c.otherCents > 0 && <> &middot; Other {formatCents(c.otherCents)}</>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Counters: {c.counter1} &amp; {c.counter2}
                        {c.enteredByName && <> &middot; Entered by {c.enteredByName}</>}
                        {c.verifiedByName && <> &middot; Confirmed by {c.verifiedByName}</>}
                      </p>
                      {c.notes && <p className="text-xs text-muted-foreground mt-1 italic">{c.notes}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold whitespace-nowrap">{formatCents(c.totalCents)}</span>
                      {canEnter && c.status === "submitted" && c.enteredBy !== user?.id && (
                        <Button
                          size="sm"
                          variant="accent"
                          onClick={() => verifyMutation.mutate(c.id)}
                          disabled={verifyMutation.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 bg-muted/50 rounded-lg border border-border border-dashed">
              <p className="text-muted-foreground">No offering counts recorded yet.</p>
            </div>
          )}
        </div>
      </div>
    </FinanceLayout>
  );
}
