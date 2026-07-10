import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { FinanceLayout } from "../../components/FinanceLayout";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "../../components/ui";
import { formatCents } from "../../lib/money";
import { printGivingStatement } from "../../lib/printExport";
import { CONTRIBUTION_METHOD_LABELS } from "@shared/schema";
import { format } from "date-fns";
import { ArrowLeft, Printer, Link2, Merge } from "lucide-react";

function fmtDate(d: string) {
  return format(new Date(d + "T00:00:00"), "MMM d, yyyy");
}

export default function FinanceDonorDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();
  const [range, setRange] = useState({
    start: `${currentYear}-01-01`,
    end: `${currentYear}-12-31`,
  });
  const [mergeTarget, setMergeTarget] = useState("");
  const [showMerge, setShowMerge] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["donor", id],
    queryFn: () => api.getDonor(id),
    enabled: Number.isInteger(id),
  });
  const { data: donorsData } = useQuery({
    queryKey: ["donors", "all"],
    queryFn: () => api.getDonors(),
    enabled: showMerge,
  });

  const mergeMutation = useMutation({
    mutationFn: (intoDonorId: number) => api.mergeDonor(id, intoDonorId),
    onSuccess: (_res, intoDonorId) => {
      queryClient.invalidateQueries({ queryKey: ["donors"] });
      queryClient.invalidateQueries({ queryKey: ["donor"] });
      setLocation(`/finance/donors/${intoDonorId}`);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong"),
  });

  const handlePrint = async () => {
    setError(null);
    if (!range.start || !range.end) {
      setError("Please choose a start and end date for the statement");
      return;
    }
    try {
      const s = await api.getDonorStatement(id, range.start, range.end);
      const ok = printGivingStatement({
        donorName: `${s.donor.firstName} ${s.donor.lastName}`,
        address: s.donor.address,
        envelopeNumber: s.donor.envelopeNumber,
        start: s.start,
        end: s.end,
        contributions: s.contributions.map((c) => ({
          contributionDate: c.contributionDate,
          fundName: c.fundName,
          methodLabel: CONTRIBUTION_METHOD_LABELS[c.method],
          checkNumber: c.checkNumber,
          amountLabel: formatCents(c.amountCents),
        })),
        fundTotals: s.fundTotals.map((f) => ({ fundName: f.fundName, amountLabel: formatCents(f.totalCents) })),
        totalLabel: formatCents(s.totalCents),
      });
      if (!ok) setError("Your browser blocked the print window. Please allow pop-ups and try again.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load statement data");
    }
  };

  if (isLoading || !data) {
    return (
      <FinanceLayout title="Donor">
        <div className="animate-pulse h-48 bg-muted rounded-lg" />
      </FinanceLayout>
    );
  }

  const { donor, contributions, byYear } = data;
  const otherDonors = (donorsData?.donors ?? []).filter((d) => d.id !== id);

  return (
    <FinanceLayout
      title={`${donor.firstName} ${donor.lastName}`}
      description="Full giving history and statements — confidential to the Bookkeeper, Treasurer, and Super Admin."
    >
      <div className="mb-4">
        <Link href="/finance/donors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> All donors
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Contact & Details</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            {donor.envelopeNumber && <p><span className="text-muted-foreground">Envelope #:</span> {donor.envelopeNumber}</p>}
            {donor.email && <p><span className="text-muted-foreground">Email:</span> {donor.email}</p>}
            {donor.phone && <p><span className="text-muted-foreground">Phone:</span> {donor.phone}</p>}
            {donor.address && <p><span className="text-muted-foreground">Address:</span> {donor.address}</p>}
            {donor.memberName && (
              <p className="flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Member:</span> {donor.memberName}
              </p>
            )}
            {!donor.isActive && <p className="text-amber-700 font-medium">Inactive donor</p>}
            {donor.notes && <p className="text-muted-foreground italic mt-2">{donor.notes}</p>}
            <div className="pt-3">
              <Button size="sm" variant="outline" onClick={() => setShowMerge((v) => !v)}>
                <Merge className="w-4 h-4 mr-1.5" /> Merge into another donor
              </Button>
              {showMerge && (
                <div className="mt-3 space-y-2">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={mergeTarget}
                    onChange={(e) => setMergeTarget(e.target.value)}
                  >
                    <option value="">Choose the donor to keep...</option>
                    {otherDonors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.lastName}, {d.firstName}
                        {d.envelopeNumber ? ` (#${d.envelopeNumber})` : ""}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    disabled={!mergeTarget || mergeMutation.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          `Move ALL of ${donor.firstName} ${donor.lastName}'s contributions to the selected donor and delete this record? This cannot be undone.`,
                        )
                      ) {
                        mergeMutation.mutate(Number(mergeTarget));
                      }
                    }}
                  >
                    {mergeMutation.isPending ? "Merging..." : "Merge & delete this donor"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Giving by Year</CardTitle>
          </CardHeader>
          <CardContent>
            {byYear.length ? (
              <table className="w-full text-sm">
                <tbody>
                  {byYear.map((y) => (
                    <tr key={y.year} className="border-b border-border last:border-0">
                      <td className="py-1.5">{y.year}</td>
                      <td className="py-1.5 text-muted-foreground">{y.count} gift{y.count === 1 ? "" : "s"}</td>
                      <td className="py-1.5 text-right font-medium">{formatCents(y.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">No contributions recorded yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Giving Statement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="stmtStart">From</Label>
                <Input
                  id="stmtStart"
                  type="date"
                  value={range.start}
                  onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stmtEnd">To</Label>
                <Input
                  id="stmtEnd"
                  type="date"
                  value={range.end}
                  onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[currentYear, currentYear - 1].map((y) => (
                <Button
                  key={y}
                  size="sm"
                  variant="outline"
                  onClick={() => setRange({ start: `${y}-01-01`, end: `${y}-12-31` })}
                >
                  {y}
                </Button>
              ))}
            </div>
            <Button className="w-full" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1.5" /> Print Statement
            </Button>
            <p className="text-xs text-muted-foreground">
              Opens a printable annual or custom-range statement suitable for mailing or handing to the donor.
            </p>
          </CardContent>
        </Card>
      </div>

      <h3 className="text-lg font-serif font-semibold mb-3">Contribution History</h3>
      {contributions.length ? (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Fund</th>
                <th className="px-3 py-2 font-medium">Method</th>
                <th className="px-3 py-2 font-medium">Batch</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(c.contributionDate)}</td>
                  <td className="px-3 py-2">
                    {c.fundName}
                    {c.note && <div className="text-xs text-muted-foreground italic">{c.note}</div>}
                  </td>
                  <td className="px-3 py-2">
                    {CONTRIBUTION_METHOD_LABELS[c.method]}
                    {c.checkNumber ? ` #${c.checkNumber}` : ""}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/finance/giving/${c.batchId}`} className="hover:underline">
                      #{c.batchId} ({fmtDate(c.batchDate)})
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-medium whitespace-nowrap">{formatCents(c.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-muted/50 rounded-lg border border-border border-dashed">
          <p className="text-muted-foreground">No contributions recorded for this donor yet.</p>
        </div>
      )}
    </FinanceLayout>
  );
}
