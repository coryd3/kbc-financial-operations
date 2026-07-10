import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { GIVING_ROLES } from "@shared/schema";
import { FinanceLayout } from "../../components/FinanceLayout";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "../../components/ui";
import { formatCents } from "../../lib/money";
import { format } from "date-fns";

export default function FinanceFunds() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManageFunds = !!user && GIVING_ROLES.includes(user.role);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [fundForm, setFundForm] = useState({ name: "", description: "" });
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["fundSummary", year],
    queryFn: () => api.getFundSummary({ year }),
  });
  const { data: fundsData } = useQuery({
    queryKey: ["givingFunds"],
    queryFn: api.getGivingFunds,
    enabled: canManageFunds,
  });

  const createFundMutation = useMutation({
    mutationFn: api.createGivingFund,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["givingFunds"] });
      queryClient.invalidateQueries({ queryKey: ["fundSummary"] });
      setFundForm({ name: "", description: "" });
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong"),
  });

  const toggleFundMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => api.updateGivingFund(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["givingFunds"] });
      queryClient.invalidateQueries({ queryKey: ["fundSummary"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong"),
  });

  const months = useMemo(() => {
    const set = new Set((data?.monthly ?? []).map((m) => m.month));
    return [...set].sort();
  }, [data]);

  const monthlyTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of data?.monthly ?? []) {
      map.set(m.month, (map.get(m.month) ?? 0) + m.totalCents);
    }
    return map;
  }, [data]);

  return (
    <FinanceLayout
      title="Fund Summary"
      description="Aggregate giving totals by fund and designation — no individual donor detail. Available to the Treasurer, Bookkeeper, Finance Committee, and Super Admin."
    >
      <div className="flex items-center gap-3 mb-6">
        <Label htmlFor="year" className="whitespace-nowrap">Year</Label>
        <select
          id="year"
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {Array.from({ length: 6 }, (_, i) => currentYear - i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="animate-pulse h-48 bg-muted rounded-lg" />
      ) : (
        <div className="space-y-8">
          <div className="grid sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Total giving ({year})</p>
                <p className="text-2xl font-semibold mt-1">{formatCents(data?.totalCents ?? 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Contributions</p>
                <p className="text-2xl font-semibold mt-1">
                  {(data?.byFund ?? []).reduce((s, f) => s + f.contributionCount, 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Active months</p>
                <p className="text-2xl font-semibold mt-1">{months.length}</p>
              </CardContent>
            </Card>
          </div>

          <div>
            <h3 className="text-lg font-serif font-semibold mb-3">Totals by Fund</h3>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Fund</th>
                    <th className="px-3 py-2 font-medium text-right">Gifts</th>
                    <th className="px-3 py-2 font-medium text-right">Donors</th>
                    <th className="px-3 py-2 font-medium text-right">Total</th>
                    <th className="px-3 py-2 font-medium text-right">% of giving</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.byFund ?? []).map((f) => (
                    <tr key={f.fundId} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{f.fundName}</td>
                      <td className="px-3 py-2 text-right">{f.contributionCount}</td>
                      <td className="px-3 py-2 text-right">{f.donorCount}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCents(f.totalCents)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {data && data.totalCents > 0 ? `${((f.totalCents / data.totalCents) * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30">
                  <tr className="border-t border-border">
                    <td className="px-3 py-2 font-semibold">Total</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {(data?.byFund ?? []).reduce((s, f) => s + f.contributionCount, 0)}
                    </td>
                    <td />
                    <td className="px-3 py-2 text-right font-semibold">{formatCents(data?.totalCents ?? 0)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Donor counts are aggregate numbers only — individual giving records remain confidential.
            </p>
          </div>

          {months.length > 0 && (
            <div>
              <h3 className="text-lg font-serif font-semibold mb-3">Monthly Giving</h3>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Month</th>
                      <th className="px-3 py-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => (
                      <tr key={m} className="border-t border-border">
                        <td className="px-3 py-2">{format(new Date(m + "-01T00:00:00"), "MMMM yyyy")}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCents(monthlyTotals.get(m) ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {canManageFunds && (
            <div className="grid lg:grid-cols-2 gap-8">
              <Card className="h-max">
                <CardHeader>
                  <CardTitle className="text-xl">Add Fund</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setError(null);
                      createFundMutation.mutate({ name: fundForm.name, description: fundForm.description });
                    }}
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="fundName">Fund name</Label>
                      <Input
                        id="fundName"
                        required
                        placeholder="e.g. Youth Camp"
                        value={fundForm.name}
                        onChange={(e) => setFundForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="fundDescription">Description</Label>
                      <Input
                        id="fundDescription"
                        placeholder="Optional"
                        value={fundForm.description}
                        onChange={(e) => setFundForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={createFundMutation.isPending}>
                      {createFundMutation.isPending ? "Adding..." : "Add Fund"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div>
                <h3 className="text-lg font-serif font-semibold mb-3">Manage Funds</h3>
                <div className="space-y-2">
                  {(fundsData?.funds ?? []).map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-3 border border-border rounded-md px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {f.name}
                          {!f.isActive && (
                            <span className="ml-2 text-[10px] uppercase font-bold tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded-sm">
                              Inactive
                            </span>
                          )}
                        </p>
                        {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleFundMutation.mutate({ id: f.id, isActive: !f.isActive })}
                        disabled={toggleFundMutation.isPending}
                      >
                        {f.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Funds with recorded contributions can be deactivated (hidden from entry) but not deleted, preserving history.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </FinanceLayout>
  );
}
