import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type DirectoryMember } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent, Input, Button } from "../components/ui";
import { MEMBER_STATUS_LABELS } from "@shared/schema";
import { Search, Mail, Phone, MapPin, Users, List, Download, Printer } from "lucide-react";
import { downloadCsv, openPrintView } from "../lib/printDirectory";

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "bg-primary/10 text-primary"
      : status === "visitor"
        ? "bg-accent/20 text-accent-foreground"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {MEMBER_STATUS_LABELS[status as keyof typeof MEMBER_STATUS_LABELS] ?? status}
    </span>
  );
}

function MemberCard({ member }: { member: DirectoryMember }) {
  return (
    <div className="bg-background border border-border rounded-md p-4 shadow-sm flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">
          {member.firstName} {member.lastName}
        </h3>
        <StatusBadge status={member.status} />
      </div>
      <div className="text-sm text-muted-foreground space-y-1">
        {member.phone ? (
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <span>{member.phone}</span>
          </div>
        ) : null}
        {member.email ? (
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span className="break-all">{member.email}</span>
          </div>
        ) : null}
        {member.address ? (
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>{member.address}</span>
          </div>
        ) : null}
        {!member.phone && !member.email && !member.address ? (
          <p className="text-xs italic opacity-70">Contact info not shared</p>
        ) : null}
      </div>
    </div>
  );
}

export default function Directory() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [householdFilter, setHouseholdFilter] = useState("");
  const [view, setView] = useState<"list" | "households">("list");

  const { data: membersData, isLoading } = useQuery({
    queryKey: ["members", search, statusFilter, householdFilter],
    queryFn: () =>
      api.getMembers({
        search: search || undefined,
        status: statusFilter || undefined,
        householdId: householdFilter ? Number(householdFilter) : undefined,
      }),
  });

  const { data: householdsData } = useQuery({
    queryKey: ["households"],
    queryFn: () => api.getHouseholds(),
  });

  const members = membersData?.members ?? [];
  const households = householdsData?.households ?? [];

  const householdName = (id: number | null) =>
    id ? households.find((h) => h.id === id)?.name ?? "" : "";

  const exportFilters = {
    search: search || undefined,
    status: statusFilter || undefined,
    householdId: householdFilter || undefined,
  };

  const grouped = useMemo(() => {
    const byHousehold = new Map<number, DirectoryMember[]>();
    const unassigned: DirectoryMember[] = [];
    for (const m of members) {
      if (m.householdId) {
        const list = byHousehold.get(m.householdId) ?? [];
        list.push(m);
        byHousehold.set(m.householdId, list);
      } else {
        unassigned.push(m);
      }
    }
    return { byHousehold, unassigned };
  }, [members]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif text-primary font-bold">Member Directory</h1>
        <p className="text-muted-foreground mt-1">
          Contact information for the Kingsville Baptist Church family. Members control what is shared here.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4">
          <CardTitle className="text-xl">
            {view === "list" ? "All Members" : "Households"}
            <span className="ml-2 text-sm font-sans font-normal text-muted-foreground">
              ({members.length})
            </span>
          </CardTitle>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <div className="relative flex-1 min-w-[12rem] sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="visitor">Visitor</option>
            </select>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-w-[12rem]"
              value={householdFilter}
              onChange={(e) => setHouseholdFilter(e.target.value)}
            >
              <option value="">All Households</option>
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <div className="flex rounded-md border border-input overflow-hidden">
              <button
                className={`px-3 h-9 text-sm flex items-center gap-1.5 transition-colors ${
                  view === "list" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                }`}
                onClick={() => setView("list")}
              >
                <List className="w-4 h-4" /> List
              </button>
              <button
                className={`px-3 h-9 text-sm flex items-center gap-1.5 transition-colors ${
                  view === "households" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                }`}
                onClick={() => setView("households")}
              >
                <Users className="w-4 h-4" /> Households
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => downloadCsv("/api/members/export.csv", exportFilters)}
              disabled={isLoading || members.length === 0}
            >
              <Download className="w-4 h-4 mr-1.5" /> Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() =>
                openPrintView({
                  title: "KBC Member Directory",
                  subtitle: "Contact info shown as shared by each member",
                  members,
                  householdName,
                })
              }
              disabled={isLoading || members.length === 0}
            >
              <Printer className="w-4 h-4 mr-1.5" /> Print
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-muted-foreground">Loading directory...</p>
          ) : members.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No members found.</p>
          ) : view === "list" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((m) => (
                <MemberCard key={m.id} member={m} />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {households
                .filter((h) => grouped.byHousehold.has(h.id))
                .map((h) => (
                  <div key={h.id}>
                    <div className="flex items-baseline gap-2 mb-3">
                      <h3 className="font-serif text-lg font-semibold text-primary flex items-center gap-2">
                        <Users className="w-4 h-4" /> {h.name}
                      </h3>
                      {h.address ? (
                        <span className="text-xs text-muted-foreground">{h.address}</span>
                      ) : null}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {(grouped.byHousehold.get(h.id) ?? []).map((m) => (
                        <MemberCard key={m.id} member={m} />
                      ))}
                    </div>
                  </div>
                ))}
              {grouped.unassigned.length > 0 && (
                <div>
                  <h3 className="font-serif text-lg font-semibold text-muted-foreground mb-3">
                    No Household Assigned
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {grouped.unassigned.map((m) => (
                      <MemberCard key={m.id} member={m} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
