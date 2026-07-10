import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "../components/ui";
import { ROLE_LABELS, ROLES, Role } from "@shared/schema";
import { Search, CheckCircle, XCircle, ShieldOff, ShieldAlert } from "lucide-react";
import { format } from "date-fns";

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["users", search, statusFilter],
    queryFn: () => api.getUsers({ search, status: statusFilter }),
  });

  const approveMut = useMutation({
    mutationFn: api.approveUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["pendingCount"] });
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
    mutationFn: ({ id, role }: { id: number; role: Role }) => api.assignRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const users = data?.users || [];
  const pendingUsers = users.filter((u) => u.status === "pending");
  const otherUsers = users.filter((u) => u.status !== "pending");

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
            {pendingUsers.map((user) => (
              <div key={user.id} className="bg-background border border-border p-4 rounded-md flex flex-col md:flex-row justify-between gap-4 shadow-sm">
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
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => rejectMut.mutate(user.id)}
                    disabled={rejectMut.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-1.5" /> Reject
                  </Button>
                  <Button 
                    size="sm" 
                    className="bg-primary hover:bg-primary/90"
                    onClick={() => approveMut.mutate(user.id)}
                    disabled={approveMut.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" /> Approve
                  </Button>
                </div>
              </div>
            ))}
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
                      </td>
                      <td className="py-3 px-4">
                        <select
                          className="text-sm bg-transparent border border-transparent hover:border-input rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                          value={user.role}
                          disabled={!user.canManage || roleMut.isPending}
                          onChange={(e) => roleMut.mutate({ id: user.id, role: e.target.value as Role })}
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
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
                        ) : user.status === 'active' ? (
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
