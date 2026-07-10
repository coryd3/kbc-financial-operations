import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label } from "../components/ui";
import { ROLE_LABELS, ROLES, Role } from "@shared/schema";
import { Search, CheckCircle, XCircle, ShieldOff, ShieldAlert, Link2, UserCheck, ChevronDown, ChevronUp, Home, Phone, Mail, KeyRound, X } from "lucide-react";
import { format } from "date-fns";

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<string>>(new Set());
  const [pwTarget, setPwTarget] = useState<{ id: number; username: string; fullName: string } | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [roleTarget, setRoleTarget] = useState<{ id: number; fullName: string; roles: Role[] } | null>(null);
  const [accessMessage, setAccessMessage] = useState("");

  const toggleSuggestionDetails = (userId: number, memberId: number) => {
    const key = `${userId}:${memberId}`;
    setExpandedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const { data, isLoading } = useQuery({
    queryKey: ["users", search, statusFilter],
    queryFn: () => api.getUsers({ search, status: statusFilter }),
  });

  const { data: suggestionsData } = useQuery({
    queryKey: ["memberLinkSuggestions"],
    queryFn: api.getMemberLinkSuggestions,
  });

  const invalidateAfterApproval = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["pendingCount"] });
    queryClient.invalidateQueries({ queryKey: ["memberLinkSuggestions"] });
    queryClient.invalidateQueries({ queryKey: ["members"] });
  };

  const approveMut = useMutation({
    mutationFn: api.approveUser,
    onSuccess: (result) => {
      setAccessMessage(result.notificationSent
        ? "Account approved and an access email was sent."
        : "Account approved, but no access email was sent. Check the email configuration or contact the user directly.");
      invalidateAfterApproval();
    },
  });

  const [linkError, setLinkError] = useState<string | null>(null);
  const approveAndLinkMut = useMutation({
    mutationFn: async ({ userId, memberId }: { userId: number; memberId: number }) => {
      const approval = await api.approveUser(userId);
      await api.linkMember(memberId, userId);
      return approval;
    },
    onMutate: () => setLinkError(null),
    onSuccess: (result) => {
      setAccessMessage(result.notificationSent
        ? "Account approved, linked, and an access email was sent."
        : "Account approved and linked, but no access email was sent.");
      invalidateAfterApproval();
    },
    onError: (err: Error) => {
      setLinkError(err.message);
      invalidateAfterApproval();
    },
  });

  const rejectMut = useMutation({
    mutationFn: api.rejectUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["pendingCount"] });
    },
  });

  const deactivateMut = useMutation({
    mutationFn: api.deactivateUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const reactivateMut = useMutation({
    mutationFn: api.reactivateUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const roleMut = useMutation({
    mutationFn: ({ id, roles }: { id: number; roles: Role[] }) => api.assignRoles(id, roles),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setRoleTarget(null);
    },
  });

  const setPasswordMut = useMutation({
    mutationFn: (id: number) => api.createPasswordResetCode(id),
    onSuccess: (result) => {
      setPwError("");
      setPwValue(result.resetCode);
      setPwSuccess("One-time reset code created. It expires in 30 minutes.");
    },
    onError: (err: Error) => setPwError(err.message),
  });

  const openPwDialog = (u: { id: number; username: string; fullName: string }) => {
    setPwSuccess("");
    setPwError("");
    setPwValue("");
    setPwTarget(u);
  };

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwTarget) return;
    setPasswordMut.mutate(pwTarget.id);
  };

  const users = data?.users || [];
  const pendingUsers = users.filter((u) => u.status === "pending");
  const otherUsers = users.filter((u) => u.status !== "pending");
  const suggestions = suggestionsData?.suggestions ?? {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif text-primary font-bold">User Management</h1>
        <p className="text-muted-foreground mt-1">Approve registrations and manage access roles.</p>
      </div>

      {pendingUsers.length > 0 && (
        <Card className="border-accent/40 bg-accent/5">
          <CardHeader>
            <CardTitle className="text-xl text-accent flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Pending Approvals ({pendingUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {linkError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                {linkError}
              </div>
            )}
            {pendingUsers.map((user) => {
              const userSuggestions = suggestions[user.id] ?? [];
              const busy = approveMut.isPending || approveAndLinkMut.isPending;
              return (
                <div key={user.id} className="bg-background border border-border p-4 rounded-md shadow-sm">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">{user.fullName}</h3>
                      <div className="text-sm text-muted-foreground flex gap-4 mt-1">
                        <span>@{user.username}</span>
                        {user.email && <span>{user.email}</span>}
                        {user.phone && <span>{user.phone}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Registered: {format(new Date(user.createdAt), "MMM d, yyyy h:mm a")}
                      </div>
                      <div className={`mt-2 inline-flex rounded px-2 py-1 text-xs font-medium ${user.emailVerifiedAt ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-900"}`}>
                        {user.emailVerifiedAt ? "Email verified" : "Waiting for email verification"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => rejectMut.mutate(user.id)}
                        disabled={rejectMut.isPending || busy}
                      >
                        <XCircle className="w-4 h-4 mr-1.5" /> Reject
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-primary hover:bg-primary/90"
                        onClick={() => approveMut.mutate(user.id)}
                        disabled={busy}
                      >
                        <CheckCircle className="w-4 h-4 mr-1.5" /> Approve
                      </Button>
                    </div>
                  </div>
                  {userSuggestions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/60">
                      <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                        <UserCheck className="w-3.5 h-3.5" />
                        Suggested member profile {userSuggestions.length > 1 ? "matches" : "match"}
                      </div>
                      <div className="space-y-2">
                        {userSuggestions.map((s) => {
                          const detailsOpen = expandedSuggestions.has(`${user.id}:${s.id}`);
                          return (
                            <div key={s.id} className={`rounded-md px-3 py-2 ${s.matchType === "close" ? "bg-muted/20 border border-dashed border-border/60" : "bg-muted/40"}`}>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="text-sm">
                                  <span className="font-medium">{s.firstName} {s.lastName}</span>
                                  {s.email && <span className="text-muted-foreground ml-2">{s.email}</span>}
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {s.matchType === "close" ? `(possible match — ${s.matchedOn})` : `(matched on ${s.matchedOn})`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-muted-foreground hover:text-foreground"
                                    onClick={() => toggleSuggestionDetails(user.id, s.id)}
                                    aria-expanded={detailsOpen}
                                  >
                                    {detailsOpen ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                                    Details
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-primary hover:bg-primary/10 hover:text-primary shrink-0"
                                    onClick={() => approveAndLinkMut.mutate({ userId: user.id, memberId: s.id })}
                                    disabled={busy}
                                  >
                                    <Link2 className="w-4 h-4 mr-1.5" /> Approve & Link
                                  </Button>
                                </div>
                              </div>
                              {detailsOpen && (
                                <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1.5">
                                    <Home className="w-3.5 h-3.5 shrink-0" />
                                    <span>Household: <span className="text-foreground">{s.householdName ?? "None"}</span></span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <UserCheck className="w-3.5 h-3.5 shrink-0" />
                                    <span>Status: <span className="text-foreground capitalize">{s.status}</span></span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5 shrink-0" />
                                    <span>Phone: <span className="text-foreground">{s.phone || "Not on file"}</span></span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5 shrink-0" />
                                    <span>Email: <span className="text-foreground">{s.email || "Not on file"}</span></span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4">
          <CardTitle className="text-xl">All Users</CardTitle>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search name, username..." 
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
              <option value="deactivated">Deactivated</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 px-4 font-medium text-muted-foreground">User</th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">Role</th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : otherUsers.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No users found.</td></tr>
                ) : (
                  otherUsers.map((user) => (
                    <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <div className="font-medium">{user.fullName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">@{user.username}</div>
                        {user.status === "active" && user.email && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {user.emailVerifiedAt ? "Email verified" : "Email not verified"}
                            {user.accessNotificationSentAt ? " / approval email sent" : " / approval email not confirmed"}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1">
                          {(user.roles ?? [user.role]).map((role) => (
                            <span key={role} className="rounded bg-muted px-2 py-0.5 text-xs">{ROLE_LABELS[role]}</span>
                          ))}
                          {user.canManage && (
                            <Button variant="ghost" size="sm" className="h-7" onClick={() => setRoleTarget({ id: user.id, fullName: user.fullName, roles: [...(user.roles ?? [user.role])] })}>
                              Edit
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          user.status === 'active' ? 'bg-primary/10 text-primary' : 
                          user.status === 'deactivated' ? 'bg-muted text-muted-foreground' : 
                          'bg-destructive/10 text-destructive'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {!user.canManage ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 opacity-70">
                            <ShieldAlert className="w-3 h-3" /> Managed by Super Admin
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 flex-wrap">
                            {user.status === 'active' ? (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
                                onClick={() => deactivateMut.mutate(user.id)}
                                disabled={deactivateMut.isPending}
                              >
                                <ShieldOff className="w-3.5 h-3.5 mr-1" /> Deactivate
                              </Button>
                            ) : user.status === 'deactivated' ? (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-primary hover:text-primary hover:bg-primary/10 h-8"
                                onClick={() => reactivateMut.mutate(user.id)}
                                disabled={reactivateMut.isPending}
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Reactivate
                              </Button>
                            ) : null}
                            {(me?.roles ?? (me ? [me.role] : [])).includes("super_admin") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-muted-foreground hover:text-foreground"
                                onClick={() => openPwDialog({ id: user.id, username: user.username, fullName: user.fullName })}
                              >
                                <KeyRound className="w-3.5 h-3.5 mr-1" /> Reset Access
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {pwSuccess && (
        <div className="fixed bottom-6 right-6 bg-primary text-primary-foreground text-sm px-4 py-3 rounded-md shadow-lg flex items-center gap-3 z-50">
          <CheckCircle className="w-4 h-4" />
          {pwSuccess}
          <button onClick={() => setPwSuccess("")} className="opacity-80 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {accessMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex max-w-md items-center gap-3 rounded-md bg-primary px-4 py-3 text-sm text-primary-foreground shadow-lg">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {accessMessage}
          <button onClick={() => setAccessMessage("")} className="opacity-80 hover:opacity-100" aria-label="Dismiss access message">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {pwTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Create Reset Code
              </CardTitle>
              <button
                onClick={() => { setPwTarget(null); setPwError(""); setPwValue(""); }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Create a one-time reset code for <span className="font-medium text-foreground">{pwTarget.fullName}</span>{" "}
                (@{pwTarget.username}). Share it privately. It expires in 30 minutes.
              </p>
              <form onSubmit={submitPassword} className="space-y-3">
                <div>
                  <Label htmlFor="new-password">One-time reset code</Label>
                  <Input
                    id="new-password"
                    type="text"
                    readOnly
                    autoComplete="off"
                    value={pwValue}
                    placeholder="Select Create Code"
                  />
                </div>
                {pwError && <p className="text-sm text-destructive">{pwError}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setPwTarget(null); setPwError(""); setPwValue(""); }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={setPasswordMut.isPending}>
                    {setPasswordMut.isPending ? "Creating..." : pwValue ? "Create Another Code" : "Create Code"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {roleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md">
            <CardHeader><CardTitle className="text-lg">Roles for {roleTarget.fullName}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Assign only the responsibilities this person currently holds. Technical administrator roles do not include donor or finance access.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2 rounded border border-border p-2 text-sm">
                    <input
                      type="checkbox"
                      checked={roleTarget.roles.includes(role)}
                      onChange={(event) => setRoleTarget((current) => current ? {
                        ...current,
                        roles: event.target.checked
                          ? [...current.roles, role]
                          : current.roles.filter((candidate) => candidate !== role),
                      } : null)}
                    />
                    {ROLE_LABELS[role]}
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRoleTarget(null)}>Cancel</Button>
                <Button disabled={roleMut.isPending || roleTarget.roles.length === 0} onClick={() => roleMut.mutate({ id: roleTarget.id, roles: roleTarget.roles })}>
                  {roleMut.isPending ? "Saving..." : "Save Roles"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
