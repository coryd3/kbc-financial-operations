import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type DonorInput, type DonorRow } from "../../lib/api";
import { FinanceLayout } from "../../components/FinanceLayout";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "../../components/ui";
import { formatCents } from "../../lib/money";
import { printGivingStatementsBulk } from "../../lib/printExport";
import { CONTRIBUTION_METHOD_LABELS } from "@shared/schema";
import { format } from "date-fns";
import { Search, UserPlus, Link2, Printer } from "lucide-react";

const emptyForm: DonorInput & { memberIdStr: string } = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  envelopeNumber: "",
  notes: "",
  isActive: true,
  memberIdStr: "",
};

export default function FinanceDonors() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statementYear, setStatementYear] = useState(String(new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0)));
  const [statementError, setStatementError] = useState<string | null>(null);
  const [statementInfo, setStatementInfo] = useState<string | null>(null);
  const [printingStatements, setPrintingStatements] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["donors", "all"], queryFn: () => api.getDonors() });
  const { data: membersData } = useQuery({
    queryKey: ["linkableMembersForDonors"],
    queryFn: () => api.getMembers(),
  });

  const donors = useMemo(() => {
    let list = data?.donors ?? [];
    if (!showInactive) list = list.filter((d) => d.isActive);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          `${d.firstName} ${d.lastName}`.toLowerCase().includes(q) ||
          (d.envelopeNumber ?? "").toLowerCase().includes(q) ||
          (d.email ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, search, showInactive]);

  const linkedMemberIds = useMemo(
    () => new Set((data?.donors ?? []).filter((d) => d.memberId != null && d.id !== editingId).map((d) => d.memberId)),
    [data, editingId],
  );

  const saveMutation = useMutation({
    mutationFn: (input: DonorInput) =>
      editingId ? api.updateDonor(editingId, input) : api.createDonor(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["donors"] });
      setForm({ ...emptyForm });
      setEditingId(null);
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong"),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteDonor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["donors"] });
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { memberIdStr, ...rest } = form;
    saveMutation.mutate({
      ...rest,
      memberId: memberIdStr ? Number(memberIdStr) : null,
    });
  };

  const handlePrintYearEnd = async () => {
    setStatementError(null);
    setStatementInfo(null);
    const year = Number(statementYear);
    if (!Number.isInteger(year) || year < 1900 || year > 2200) {
      setStatementError("Please enter a valid four-digit year");
      return;
    }
    setPrintingStatements(true);
    try {
      const res = await api.getBulkStatements(`${year}-01-01`, `${year}-12-31`);
      if (!res.statements.length) {
        setStatementError(`No contributions were recorded in ${year}.`);
        return;
      }
      const ok = printGivingStatementsBulk(
        res.statements.map((s) => ({
          donorName: `${s.donor.firstName} ${s.donor.lastName}`,
          address: s.donor.address,
          envelopeNumber: s.donor.envelopeNumber,
          start: res.start,
          end: res.end,
          contributions: s.contributions.map((c) => ({
            contributionDate: c.contributionDate,
            fundName: c.fundName,
            methodLabel: CONTRIBUTION_METHOD_LABELS[c.method],
            checkNumber: c.checkNumber,
            amountLabel: formatCents(c.amountCents),
          })),
          fundTotals: s.fundTotals.map((f) => ({ fundName: f.fundName, amountLabel: formatCents(f.totalCents) })),
          totalLabel: formatCents(s.totalCents),
        })),
        res.start,
        res.end,
      );
      if (ok) {
        setStatementInfo(
          `Prepared ${res.statements.length} statement${res.statements.length === 1 ? "" : "s"} for ${year}. Each donor starts on a new page.`,
        );
      } else {
        setStatementError("Your browser blocked the print window. Please allow pop-ups and try again.");
      }
    } catch (e) {
      setStatementError(e instanceof ApiError ? e.message : "Could not load statement data");
    } finally {
      setPrintingStatements(false);
    }
  };

  const startEdit = (d: DonorRow) => {
    setEditingId(d.id);
    setForm({
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email ?? "",
      phone: d.phone ?? "",
      address: d.address ?? "",
      envelopeNumber: d.envelopeNumber ?? "",
      notes: d.notes ?? "",
      isActive: d.isActive,
      memberIdStr: d.memberId != null ? String(d.memberId) : "",
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <FinanceLayout
      title="Donors"
      description="Donor records used for contribution entry and giving statements. Donors can be linked to membership directory records. Confidential — visible only to the Bookkeeper, Treasurer, and Super Admin."
    >
      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2 space-y-8 h-max">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{editingId ? "Edit Donor" : "Add Donor"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    required
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    required
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="envelopeNumber">Envelope #</Label>
                  <Input
                    id="envelopeNumber"
                    placeholder="Optional"
                    value={form.envelopeNumber}
                    onChange={(e) => setForm((f) => ({ ...f, envelopeNumber: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    placeholder="Optional"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Optional"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Mailing address</Label>
                <Input
                  id="address"
                  placeholder="Used on giving statements"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="memberLink">Link to member record</Label>
                <select
                  id="memberLink"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.memberIdStr}
                  onChange={(e) => setForm((f) => ({ ...f, memberIdStr: e.target.value }))}
                >
                  <option value="">Not linked</option>
                  {(membersData?.members ?? [])
                    .filter((m) => !linkedMemberIds.has(m.id) || String(m.id) === form.memberIdStr)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.lastName}, {m.firstName}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="donorNotes">Notes</Label>
                <Input
                  id="donorNotes"
                  placeholder="Optional"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-input"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                Active donor
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
                  <UserPlus className="w-4 h-4 mr-1.5" />
                  {saveMutation.isPending ? "Saving..." : editingId ? "Save Changes" : "Add Donor"}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setForm({ ...emptyForm });
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Year-End Statements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Print giving statements for every donor with contributions in a year — one document, one
              statement per donor, each on its own page. Uses the same letterhead and tax wording as
              individual statements.
            </p>
            <div className="flex items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="statementYear">Year</Label>
                <Input
                  id="statementYear"
                  type="number"
                  className="w-28"
                  min={1900}
                  max={2200}
                  value={statementYear}
                  onChange={(e) => setStatementYear(e.target.value)}
                />
              </div>
              <Button type="button" onClick={handlePrintYearEnd} disabled={printingStatements}>
                <Printer className="w-4 h-4 mr-1.5" />
                {printingStatements ? "Preparing..." : "Print All Statements"}
              </Button>
            </div>
            {statementError && <p className="text-sm text-destructive">{statementError}</p>}
            {statementInfo && <p className="text-sm text-muted-foreground">{statementInfo}</p>}
          </CardContent>
        </Card>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, envelope #, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                className="rounded border-input"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show inactive
            </label>
          </div>

          {isLoading ? (
            <div className="animate-pulse h-32 bg-muted rounded-lg" />
          ) : donors.length ? (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Donor</th>
                    <th className="px-3 py-2 font-medium">Env #</th>
                    <th className="px-3 py-2 font-medium text-right">Lifetime giving</th>
                    <th className="px-3 py-2 font-medium">Last gift</th>
                    <th className="px-3 py-2 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {donors.map((d) => (
                    <tr key={d.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <Link href={`/finance/donors/${d.id}`} className="font-medium hover:underline">
                          {d.lastName}, {d.firstName}
                        </Link>
                        {!d.isActive && (
                          <span className="ml-2 text-[10px] uppercase font-bold tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded-sm">
                            Inactive
                          </span>
                        )}
                        {d.memberName && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Link2 className="w-3 h-3" /> Member: {d.memberName}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">{d.envelopeNumber ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-medium whitespace-nowrap">{formatCents(d.totalCents)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {d.lastContributionDate
                          ? format(new Date(d.lastContributionDate + "T00:00:00"), "MMM d, yyyy")
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(d)}>
                            Edit
                          </Button>
                          {d.contributionCount === 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => {
                                if (confirm(`Delete donor ${d.firstName} ${d.lastName}?`)) deleteMutation.mutate(d.id);
                              }}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/50 rounded-lg border border-border border-dashed">
              <p className="text-muted-foreground">No donors found. Add your first donor to begin recording contributions.</p>
            </div>
          )}
        </div>
      </div>
    </FinanceLayout>
  );
}
