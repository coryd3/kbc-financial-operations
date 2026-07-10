import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type TransactionRow } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { LEDGER_EDIT_ROLES, type TransactionType } from "@shared/schema";
import { FinanceLayout } from "../../components/FinanceLayout";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "../../components/ui";
import { formatCents, parseDollars } from "../../lib/money";
import { format } from "date-fns";
import { Pencil, Trash2, X } from "lucide-react";

const emptyForm = {
  txnDate: format(new Date(), "yyyy-MM-dd"),
  type: "expense" as TransactionType,
  categoryId: "",
  amount: "",
  payee: "",
  memo: "",
};

export default function FinanceLedger() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = !!user && LEDGER_EDIT_ROLES.includes(user.role);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [search, setSearch] = useState("");

  const { data: categoriesData } = useQuery({ queryKey: ["categories"], queryFn: api.getCategories });
  const categories = categoriesData?.categories ?? [];
  const activeCategories = categories.filter((c) => c.isActive);

  const filters = {
    type: filterType || undefined,
    categoryId: filterCategory ? Number(filterCategory) : undefined,
    month: filterMonth || undefined,
    search: search || undefined,
  };
  const { data, isLoading } = useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => api.getTransactions(filters),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["financeSummary"] });
  };

  const saveMutation = useMutation({
    mutationFn: (input: { id: number | null; data: Parameters<typeof api.createTransaction>[0] }) =>
      input.id ? api.updateTransaction(input.id, input.data) : api.createTransaction(input.data),
    onSuccess: () => {
      invalidate();
      setForm(emptyForm);
      setEditingId(null);
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteTransaction(id),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amountCents = parseDollars(form.amount);
    if (amountCents === null || amountCents <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    if (!form.categoryId) {
      setError("Please choose a category");
      return;
    }
    saveMutation.mutate({
      id: editingId,
      data: {
        txnDate: form.txnDate,
        type: form.type,
        categoryId: Number(form.categoryId),
        amountCents,
        payee: form.payee,
        memo: form.memo,
      },
    });
  };

  const startEdit = (t: TransactionRow) => {
    setEditingId(t.id);
    setForm({
      txnDate: t.txnDate,
      type: t.type,
      categoryId: String(t.categoryId),
      amount: (t.amountCents / 100).toFixed(2),
      payee: t.payee,
      memo: t.memo ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  };

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const formCategories = activeCategories.filter((c) => c.type === form.type);

  return (
    <FinanceLayout
      title="Transaction Ledger"
      description="Income and expense entries by budget category."
    >
      <div className="grid lg:grid-cols-5 gap-8">
        {canEdit && (
          <Card className="lg:col-span-2 h-max">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xl">{editingId ? `Edit Entry #${editingId}` : "New Entry"}</CardTitle>
              {editingId && (
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="txnDate">Date</Label>
                    <Input
                      id="txnDate"
                      type="date"
                      required
                      value={form.txnDate}
                      onChange={(e) => setForm((f) => ({ ...f, txnDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="txnType">Type</Label>
                    <select
                      id="txnType"
                      className={selectClass}
                      value={form.type}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, type: e.target.value as TransactionType, categoryId: "" }))
                      }
                    >
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="txnCategory">Category</Label>
                    <select
                      id="txnCategory"
                      className={selectClass}
                      required
                      value={form.categoryId}
                      onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                    >
                      <option value="">Choose...</option>
                      {formCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="txnAmount">Amount $</Label>
                    <Input
                      id="txnAmount"
                      inputMode="decimal"
                      required
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="txnPayee">{form.type === "income" ? "Source" : "Payee"}</Label>
                  <Input
                    id="txnPayee"
                    required
                    placeholder={form.type === "income" ? "e.g., Sunday offering deposit" : "e.g., Entergy"}
                    value={form.payee}
                    onChange={(e) => setForm((f) => ({ ...f, payee: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="txnMemo">Memo</Label>
                  <Input
                    id="txnMemo"
                    placeholder="Optional"
                    value={form.memo}
                    onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : editingId ? "Save Changes" : "Add Entry"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className={canEdit ? "lg:col-span-3 space-y-4" : "lg:col-span-5 space-y-4"}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select className={selectClass} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <select className={selectClass} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
            <Input placeholder="Search payee/memo..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {isLoading ? (
            <div className="animate-pulse h-32 bg-muted rounded-lg" />
          ) : data?.transactions.length ? (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Payee / Source</th>
                    <th className="px-3 py-2 font-medium hidden md:table-cell">Category</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                    {canEdit && <th className="px-3 py-2 w-20"></th>}
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((t) => (
                    <tr key={t.id} className="border-t border-border hover:bg-muted/40">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {format(new Date(t.txnDate + "T00:00:00"), "MMM d, yyyy")}
                      </td>
                      <td className="px-3 py-2">
                        <div>{t.payee}</div>
                        {t.memo && <div className="text-xs text-muted-foreground">{t.memo}</div>}
                        <div className="text-xs text-muted-foreground md:hidden">{t.categoryName}</div>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">{t.categoryName}</td>
                      <td
                        className={
                          "px-3 py-2 text-right font-medium whitespace-nowrap " +
                          (t.type === "income" ? "text-green-700" : "text-foreground")
                        }
                      >
                        {t.type === "income" ? "+" : "−"}
                        {formatCents(t.amountCents)}
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2">
                          <div className="flex gap-1 justify-end">
                            <button
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                              onClick={() => startEdit(t)}
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                              onClick={() => {
                                if (window.confirm("Delete this entry? This cannot be undone.")) {
                                  deleteMutation.mutate(t.id);
                                }
                              }}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/50 rounded-lg border border-border border-dashed">
              <p className="text-muted-foreground">No transactions found.</p>
            </div>
          )}
        </div>
      </div>
    </FinanceLayout>
  );
}
