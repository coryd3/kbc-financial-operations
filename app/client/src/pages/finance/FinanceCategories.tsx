import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import type { CategoryType } from "@shared/schema";
import { FinanceLayout } from "../../components/FinanceLayout";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "../../components/ui";

export default function FinanceCategories() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["categories"], queryFn: api.getCategories });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["categories"] });
  const onError = (e: unknown) => setError(e instanceof ApiError ? e.message : "Something went wrong");

  const createMutation = useMutation({
    mutationFn: api.createCategory,
    onSuccess: () => {
      invalidate();
      setName("");
      setError(null);
    },
    onError,
  });

  const toggleMutation = useMutation({
    mutationFn: (v: { id: number; isActive: boolean }) => api.updateCategory(v.id, { isActive: v.isActive }),
    onSuccess: invalidate,
    onError,
  });

  const categories = data?.categories ?? [];
  const income = categories.filter((c) => c.type === "income");
  const expense = categories.filter((c) => c.type === "expense");

  const list = (items: typeof categories, title: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="space-y-2">
            {items.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
                <span className={c.isActive ? "" : "text-muted-foreground line-through"}>{c.name}</span>
                <Button
                  size="sm"
                  variant={c.isActive ? "outline" : "secondary"}
                  onClick={() => toggleMutation.mutate({ id: c.id, isActive: !c.isActive })}
                  disabled={toggleMutation.isPending}
                >
                  {c.isActive ? "Deactivate" : "Reactivate"}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">None yet.</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <FinanceLayout
      title="Budget Categories"
      description="Categories used for ledger entries and reports. Deactivated categories keep their history but can't be used for new entries."
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="p-4">
            <form
              className="flex flex-col md:flex-row gap-3 md:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                createMutation.mutate({ name, type });
              }}
            >
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="catName">Category name</Label>
                <Input id="catName" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Youth Ministry" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="catType">Type</Label>
                <select
                  id="catType"
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value as CategoryType)}
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <Button type="submit" disabled={createMutation.isPending}>
                Add Category
              </Button>
            </form>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="animate-pulse h-32 bg-muted rounded-lg" />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {list(income, "Income Categories")}
            {list(expense, "Expense Categories")}
          </div>
        )}
      </div>
    </FinanceLayout>
  );
}
