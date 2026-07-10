import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { FinanceLayout } from "../../components/FinanceLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui";
import { formatCents, MONTH_NAMES } from "../../lib/money";
import { TrendingDown, TrendingUp } from "lucide-react";

export default function FinanceReports() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data, isLoading } = useQuery({
    queryKey: ["financeSummary", year],
    queryFn: () => api.getFinanceSummary(year),
  });

  const monthlyRows = MONTH_NAMES.map((name, idx) => {
    const m = idx + 1;
    const income = data?.monthly.find((r) => r.month === m && r.type === "income")?.totalCents ?? 0;
    const expense = data?.monthly.find((r) => r.month === m && r.type === "expense")?.totalCents ?? 0;
    return { name, income, expense, net: income - expense };
  });

  const incomeCats = (data?.byCategory ?? []).filter((c) => c.type === "income");
  const expenseCats = (data?.byCategory ?? []).filter((c) => c.type === "expense");

  const ytdNet = (data?.ytd.incomeCents ?? 0) - (data?.ytd.expenseCents ?? 0);
  const priorNet = (data?.prior.incomeCents ?? 0) - (data?.prior.expenseCents ?? 0);

  return (
    <FinanceLayout
      title="Financial Reports"
      description="Monthly and year-to-date summaries by category, compared to the prior year."
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <label htmlFor="reportYear" className="text-sm font-medium">
            Year
          </label>
          <select
            id="reportYear"
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {Array.from({ length: 6 }, (_, i) => currentYear - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="animate-pulse h-40 bg-muted rounded-lg" />
        ) : data ? (
          <>
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-green-700" /> Income ({data.year})
                  </p>
                  <p className="text-2xl font-semibold mt-1">{formatCents(data.ytd.incomeCents)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.priorYear}: {formatCents(data.prior.incomeCents)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-destructive" /> Expenses ({data.year})
                  </p>
                  <p className="text-2xl font-semibold mt-1">{formatCents(data.ytd.expenseCents)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.priorYear}: {formatCents(data.prior.expenseCents)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">Net ({data.year})</p>
                  <p className={"text-2xl font-semibold mt-1 " + (ytdNet < 0 ? "text-destructive" : "text-green-700")}>
                    {formatCents(ytdNet)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.priorYear}: {formatCents(priorNet)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Monthly Income &amp; Expense — {data.year}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left border-b border-border">
                      <tr>
                        <th className="py-2 pr-3 font-medium">Month</th>
                        <th className="py-2 px-3 font-medium text-right">Income</th>
                        <th className="py-2 px-3 font-medium text-right">Expenses</th>
                        <th className="py-2 pl-3 font-medium text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyRows.map((r) => (
                        <tr key={r.name} className="border-b border-border/50">
                          <td className="py-1.5 pr-3">{r.name}</td>
                          <td className="py-1.5 px-3 text-right">{r.income ? formatCents(r.income) : "—"}</td>
                          <td className="py-1.5 px-3 text-right">{r.expense ? formatCents(r.expense) : "—"}</td>
                          <td
                            className={
                              "py-1.5 pl-3 text-right font-medium " +
                              (r.net < 0 ? "text-destructive" : r.net > 0 ? "text-green-700" : "text-muted-foreground")
                            }
                          >
                            {r.income || r.expense ? formatCents(r.net) : "—"}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-semibold">
                        <td className="py-2 pr-3">Total</td>
                        <td className="py-2 px-3 text-right">{formatCents(data.ytd.incomeCents)}</td>
                        <td className="py-2 px-3 text-right">{formatCents(data.ytd.expenseCents)}</td>
                        <td className={"py-2 pl-3 text-right " + (ytdNet < 0 ? "text-destructive" : "text-green-700")}>
                          {formatCents(ytdNet)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Income by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  {incomeCats.length ? (
                    <ul className="space-y-2 text-sm">
                      {incomeCats.map((c) => (
                        <li key={c.categoryId} className="flex justify-between border-b border-border/50 pb-1.5">
                          <span>{c.categoryName}</span>
                          <span className="font-medium">{formatCents(c.totalCents)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No income recorded for {data.year}.</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Expenses by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  {expenseCats.length ? (
                    <ul className="space-y-2 text-sm">
                      {expenseCats.map((c) => (
                        <li key={c.categoryId} className="flex justify-between border-b border-border/50 pb-1.5">
                          <span>{c.categoryName}</span>
                          <span className="font-medium">{formatCents(c.totalCents)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No expenses recorded for {data.year}.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </FinanceLayout>
  );
}
