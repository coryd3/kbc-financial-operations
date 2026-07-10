import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type CommitteeInput } from "../lib/api";
import { COMMITTEE_POSITION_LABELS } from "@shared/schema";
import { Button, Card, CardContent, Input, Label } from "../components/ui";
import { Users, Lock, Plus, ChevronRight } from "lucide-react";

export default function Committees() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["committees"],
    queryFn: api.getCommittees,
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CommitteeInput>({ name: "", description: "", isSensitive: false });
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (input: CommitteeInput) => api.createCommittee(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["committees"] });
      setShowForm(false);
      setForm({ name: "", description: "", isSensitive: false });
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <div className="space-y-8">
      <header className="border-b border-border pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-primary font-bold">Committees</h1>
          <p className="text-muted-foreground mt-1">
            Committee rosters, meeting records, and governance for Kingsville Baptist Church.
          </p>
        </div>
        {data?.canCreate && (
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="w-4 h-4 mr-1.5" /> New Committee
          </Button>
        )}
      </header>

      {showForm && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-serif font-semibold">Create Committee</h2>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Building & Grounds Committee"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this committee do?"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isSensitive}
                onChange={(e) => setForm({ ...form, isSensitive: e.target.checked })}
              />
              Restricted committee (only its members and the Super Admin can view records)
            </label>
            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending || form.name.trim().length < 2}
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setError(null); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-muted rounded-lg"></div>
          <div className="h-24 bg-muted rounded-lg"></div>
        </div>
      ) : data?.committees.length ? (
        <div className="grid md:grid-cols-2 gap-4">
          {data.committees.map((c) => (
            <Link key={c.id} href={`/committees/${c.id}`}>
              <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer h-full">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="p-2.5 bg-primary/10 rounded-md text-primary mt-0.5">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-serif font-semibold text-lg">{c.name}</h3>
                      {c.isSensitive && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-accent/20 text-accent px-2 py-0.5 rounded-sm">
                          <Lock className="w-3 h-3" /> Restricted
                        </span>
                      )}
                    </div>
                    {c.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{c.memberCount} member{c.memberCount === 1 ? "" : "s"}</span>
                      {c.myPosition && (
                        <span className="bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-sm">
                          You: {COMMITTEE_POSITION_LABELS[c.myPosition]}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground mt-1" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-muted/50 rounded-lg border border-border border-dashed">
          <p className="text-muted-foreground">
            You are not a member of any committees you can view. Contact a church administrator if you believe this is incorrect.
          </p>
        </div>
      )}
    </div>
  );
}
