import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type DirectoryMember, type MemberInput } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label } from "../components/ui";
import { MEMBER_STATUS_LABELS, MEMBER_STATUSES, type MemberStatus } from "@shared/schema";
import { Search, Plus, Pencil, Trash2, Link2, Unlink, Users, X, Download, Printer, ChevronLeft, ChevronRight } from "lucide-react";
import { downloadCsv, openPrintView } from "../lib/printDirectory";
import { useDebounce } from "../lib/useDebounce";

const PAGE_SIZE = 50;

const emptyForm: MemberInput = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  householdId: null,
  status: "active",
  joinDate: "",
  notes: "",
  hideEmail: false,
  hidePhone: false,
  hideAddress: false,
};

function MemberFormModal({
  title,
  initial,
  onClose,
  onSave,
  saving,
  error,
  households,
}: {
  title: string;
  initial: MemberInput;
  onClose: () => void;
  onSave: (data: MemberInput) => void;
  saving: boolean;
  error: string;
  households: { id: number; name: string }[];
}) {
  const [form, setForm] = useState<MemberInput>(initial);
  const set = (patch: Partial<MemberInput>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto p-4">
      <Card className="w-full max-w-2xl my-8">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl">{title}</CardTitle>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              onSave(form);
            }}
          >
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                {error}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email ?? ""} onChange={(e) => set({ email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Address</Label>
                <Input value={form.address ?? ""} onChange={(e) => set({ address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Household</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.householdId ?? ""}
                  onChange={(e) => set({ householdId: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">No household</option>
                  {households.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.status}
                  onChange={(e) => set({ status: e.target.value as MemberStatus })}
                >
                  {MEMBER_STATUSES.map((s) => (
                    <option key={s} value={s}>{MEMBER_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Join Date</Label>
                <Input type="date" value={form.joinDate ?? ""} onChange={(e) => set({ joinDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Leadership Notes (visible to admins/leadership only)</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.notes ?? ""}
                onChange={(e) => set({ notes: e.target.value })}
              />
            </div>
            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-muted-foreground">Directory privacy (hide from other members)</Label>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.hideEmail} onChange={(e) => set({ hideEmail: e.target.checked })} />
                  Hide email
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.hidePhone} onChange={(e) => set({ hidePhone: e.target.checked })} />
                  Hide phone
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.hideAddress} onChange={(e) => set({ hideAddress: e.target.checked })} />
                  Hide address
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Member"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function LinkModal({
  member,
  onClose,
}: {
  member: DirectoryMember;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState("");

  const { data } = useQuery({
    queryKey: ["linkableUsers"],
    queryFn: () => api.getLinkableUsers(),
  });

  const linkMut = useMutation({
    mutationFn: (userId: number | null) => api.linkMember(member.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["linkableUsers"] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto p-4">
      <Card className="w-full max-w-md my-8">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl">
            Link Account — {member.firstName} {member.lastName}
          </CardTitle>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
              {error}
            </div>
          )}
          {member.userId ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This profile is linked to a registered account. Unlink it to connect a different account.
              </p>
              <Button
                variant="outline"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => linkMut.mutate(null)}
                disabled={linkMut.isPending}
              >
                <Unlink className="w-4 h-4 mr-1.5" /> Unlink Account
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Choose the registered app account that belongs to this member. They will then be able to edit their own contact info.
              </p>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">Select a user account...</option>
                {(data?.users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} (@{u.username}){u.status === "pending" ? " — pending" : ""}
                  </option>
                ))}
              </select>
              <Button
                className="w-full"
                disabled={!selectedUserId || linkMut.isPending}
                onClick={() => linkMut.mutate(Number(selectedUserId))}
              >
                <Link2 className="w-4 h-4 mr-1.5" /> Link Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HouseholdsCard() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [error, setError] = useState("");

  const { data } = useQuery({ queryKey: ["households"], queryFn: () => api.getHouseholds() });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["households"] });
    queryClient.invalidateQueries({ queryKey: ["members"] });
  };
  const onError = (err: unknown) => setError(err instanceof ApiError ? err.message : "Something went wrong");

  const createMut = useMutation({
    mutationFn: () => api.createHousehold({ name, address }),
    onSuccess: () => {
      setName("");
      setAddress("");
      setError("");
      invalidate();
    },
    onError,
  });

  const updateMut = useMutation({
    mutationFn: () => api.updateHousehold(editingId!, { name: editName, address: editAddress }),
    onSuccess: () => {
      setEditingId(null);
      setError("");
      invalidate();
    },
    onError,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteHousehold(id),
    onSuccess: () => {
      setError("");
      invalidate();
    },
    onError,
  });

  const households = data?.households ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Users className="w-5 h-5" /> Households
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
            {error}
          </div>
        )}
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) createMut.mutate();
          }}
        >
          <Input placeholder="Household name (e.g. The Smith Family)" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          <Input placeholder="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} className="h-9" />
          <Button type="submit" size="sm" disabled={!name.trim() || createMut.isPending}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </form>
        {households.length === 0 ? (
          <p className="text-sm text-muted-foreground">No households yet. Add one to group family members together.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {households.map((h) => (
              <li key={h.id} className="py-2 flex items-center gap-2">
                {editingId === h.id ? (
                  <form
                    className="flex flex-1 flex-col sm:flex-row gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editName.trim()) updateMut.mutate();
                    }}
                  >
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                    <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Address" className="h-8" />
                    <div className="flex gap-1">
                      <Button type="submit" size="sm" className="h-8" disabled={updateMut.isPending}>Save</Button>
                      <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{h.name}</span>
                      {h.address ? <span className="ml-2 text-xs text-muted-foreground">{h.address}</span> : null}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => {
                        setEditingId(h.id);
                        setEditName(h.name);
                        setEditAddress(h.address ?? "");
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`Delete household "${h.name}"? Members in it will be unassigned.`)) {
                          deleteMut.mutate(h.id);
                        }
                      }}
                      disabled={deleteMut.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminMembers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const [printing, setPrinting] = useState(false);
  const [modal, setModal] = useState<null | { mode: "add" } | { mode: "edit"; member: DirectoryMember }>(null);
  const [linkTarget, setLinkTarget] = useState<DirectoryMember | null>(null);
  const [formError, setFormError] = useState("");

  const debouncedSearch = useDebounce(search);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ["members", debouncedSearch, statusFilter, page],
    queryFn: () =>
      api.getMembers({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  });

  const { data: householdsData } = useQuery({
    queryKey: ["households"],
    queryFn: () => api.getHouseholds(),
  });

  const onError = (err: unknown) =>
    setFormError(err instanceof ApiError ? err.message : "Something went wrong");

  const invalidateMembers = () => queryClient.invalidateQueries({ queryKey: ["members"] });

  const createMut = useMutation({
    mutationFn: (input: MemberInput) => api.createMember(input),
    onSuccess: () => {
      setModal(null);
      setFormError("");
      invalidateMembers();
    },
    onError,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: number; input: MemberInput }) => api.updateMember(id, input),
    onSuccess: () => {
      setModal(null);
      setFormError("");
      invalidateMembers();
    },
    onError,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deleteMember(id),
    onSuccess: invalidateMembers,
  });

  const members = data?.members ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const households = householdsData?.households ?? [];
  const householdName = (id: number | null) =>
    id ? households.find((h) => h.id === id)?.name ?? "—" : "—";

  // Print pulls the complete filtered list (not just the current page) on demand.
  const handlePrint = async () => {
    setPrinting(true);
    try {
      const all = await api.getMembers({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
      });
      openPrintView({
        title: "KBC Members — Leadership Roster",
        subtitle: "Full contact info (includes hidden entries) — leadership use only",
        members: all.members,
        householdName: (id) => (id ? householdName(id) : ""),
        includeNotes: true,
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-primary font-bold">Member Management</h1>
          <p className="text-muted-foreground mt-1">
            Add and edit member records, manage households, and link profiles to app accounts.
          </p>
        </div>
        <Button onClick={() => { setFormError(""); setModal({ mode: "add" }); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Member
        </Button>
      </div>

      <HouseholdsCard />

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4">
          <CardTitle className="text-xl">Members ({total})</CardTitle>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
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
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() =>
                downloadCsv("/api/admin/members/export.csv", {
                  search: search || undefined,
                  status: statusFilter || undefined,
                })
              }
              disabled={isLoading || members.length === 0}
            >
              <Download className="w-4 h-4 mr-1.5" /> Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={handlePrint}
              disabled={isLoading || printing || members.length === 0}
            >
              <Printer className="w-4 h-4 mr-1.5" /> {printing ? "Preparing..." : "Print"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 px-4 font-medium text-muted-foreground">Name</th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">Contact</th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">Household</th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">Account</th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : members.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No members yet. Click "Add Member" to create the first record.</td></tr>
                ) : (
                  members.map((m) => (
                    <tr key={m.id} className="border-b border-border/50 hover:bg-muted/30 align-top">
                      <td className="py-3 px-4">
                        <div className="font-medium">{m.firstName} {m.lastName}</div>
                        {m.joinDate ? (
                          <div className="text-xs text-muted-foreground mt-0.5">Joined {m.joinDate}</div>
                        ) : null}
                        {m.notes ? (
                          <div className="text-xs text-accent-foreground/80 bg-accent/10 rounded px-1.5 py-0.5 mt-1 max-w-[16rem] truncate" title={m.notes}>
                            Note: {m.notes}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        <div>{m.phone ?? "—"}{m.hidePhone ? " (hidden)" : ""}</div>
                        <div className="text-xs">{m.email ?? ""}{m.email && m.hideEmail ? " (hidden)" : ""}</div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{householdName(m.householdId)}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          m.status === "active" ? "bg-primary/10 text-primary" :
                          m.status === "visitor" ? "bg-accent/20 text-accent-foreground" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {MEMBER_STATUS_LABELS[m.status]}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          className={`text-xs flex items-center gap-1 hover:underline ${m.userId ? "text-primary" : "text-muted-foreground"}`}
                          onClick={() => setLinkTarget(m)}
                        >
                          {m.userId ? (<><Link2 className="w-3 h-3" /> Linked</>) : (<><Unlink className="w-3 h-3" /> Not linked</>)}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => { setFormError(""); setModal({ mode: "edit", member: m }); }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm(`Delete member record for ${m.firstName} ${m.lastName}? This cannot be undone.`)) {
                                deleteMut.mutate(m.id);
                              }
                            }}
                            disabled={deleteMut.isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-2 pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}&ndash;{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page + 1} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={page >= pageCount - 1}
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {modal?.mode === "add" && (
        <MemberFormModal
          title="Add Member"
          initial={emptyForm}
          onClose={() => setModal(null)}
          onSave={(input) => createMut.mutate(input)}
          saving={createMut.isPending}
          error={formError}
          households={households}
        />
      )}
      {modal?.mode === "edit" && (
        <MemberFormModal
          title={`Edit — ${modal.member.firstName} ${modal.member.lastName}`}
          initial={{
            firstName: modal.member.firstName,
            lastName: modal.member.lastName,
            email: modal.member.email ?? "",
            phone: modal.member.phone ?? "",
            address: modal.member.address ?? "",
            householdId: modal.member.householdId,
            status: modal.member.status,
            joinDate: modal.member.joinDate ?? "",
            notes: modal.member.notes ?? "",
            hideEmail: modal.member.hideEmail,
            hidePhone: modal.member.hidePhone,
            hideAddress: modal.member.hideAddress,
          }}
          onClose={() => setModal(null)}
          onSave={(input) => updateMut.mutate({ id: modal.member.id, input })}
          saving={updateMut.isPending}
          error={formError}
          households={households}
        />
      )}
      {linkTarget && <LinkModal member={linkTarget} onClose={() => setLinkTarget(null)} />}
    </div>
  );
}
