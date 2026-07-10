import type {
  SafeUser,
  Announcement,
  Role,
  Household,
  MemberStatus,
  ChecklistTemplate,
  ChecklistTemplateStep,
  ChecklistInstance,
  ChecklistTemplateInput,
} from "@shared/schema";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export type ManagedUser = SafeUser & { canManage: boolean };

export interface AnalyticsSummary {
  days: number;
  totals: { totalViews: number; uniqueVisitors: number };
  dailyViews: { day: string; views: number; visitors: number }[];
  topPages: { path: string; views: number }[];
  byRole: { role: string | null; views: number }[];
}

export interface DirectoryMember {
  id: number;
  firstName: string;
  lastName: string;
  householdId: number | null;
  status: MemberStatus;
  joinDate: string | null;
  userId: number | null;
  hideEmail: boolean;
  hidePhone: boolean;
  hideAddress: boolean;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MemberInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  householdId?: number | null;
  status: MemberStatus;
  joinDate?: string;
  notes?: string;
  hideEmail: boolean;
  hidePhone: boolean;
  hideAddress: boolean;
}

export interface LinkableUser {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  status: string;
}

export type TemplateWithSteps = ChecklistTemplate & { steps: ChecklistTemplateStep[] };

export type InstanceWithProgress = ChecklistInstance & {
  progress: { total: number; completed: number };
};

export interface InstanceStepDetail {
  id: number;
  instanceId: number;
  position: number;
  title: string;
  assignedRole: Role | null;
  completedAt: string | null;
  completedBy: number | null;
  completedByName: string | null;
}

export type InstanceDetail = ChecklistInstance & { steps: InstanceStepDetail[] };

export interface MyTask {
  stepId: number;
  title: string;
  position: number;
  assignedRole: Role | null;
  instanceId: number;
  instanceName: string;
  dueDate: string | null;
}

export interface ChecklistSummary {
  openCount: number;
  myOpenSteps: number;
  overdue: InstanceWithProgress[];
  upcoming: InstanceWithProgress[];
}

export const api = {
  // auth
  register: (data: { username: string; password: string; fullName: string; email?: string; phone?: string }) =>
    request<{ message: string; user: SafeUser }>("POST", "/api/auth/register", data),
  login: (data: { username: string; password: string }) =>
    request<{ user: SafeUser }>("POST", "/api/auth/login", data),
  logout: () => request<{ message: string }>("POST", "/api/auth/logout"),
  me: () => request<{ user: SafeUser }>("GET", "/api/auth/me"),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<{ message: string }>("POST", "/api/auth/change-password", data),

  // announcements
  getAnnouncements: () => request<{ announcements: Announcement[] }>("GET", "/api/announcements"),
  createAnnouncement: (data: { title: string; body: string; isPublic: boolean }) =>
    request<{ announcement: Announcement }>("POST", "/api/admin/announcements", data),
  updateAnnouncement: (id: number, data: Partial<{ title: string; body: string; isPublic: boolean }>) =>
    request<{ announcement: Announcement }>("PATCH", `/api/admin/announcements/${id}`, data),
  deleteAnnouncement: (id: number) =>
    request<{ message: string }>("DELETE", `/api/admin/announcements/${id}`),

  // admin user management
  getUsers: (params?: { search?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ users: ManagedUser[] }>("GET", `/api/admin/users${suffix}`);
  },
  getPendingCount: () => request<{ pendingCount: number }>("GET", "/api/admin/pending-count"),
  approveUser: (id: number) => request<{ user: SafeUser }>("POST", `/api/admin/users/${id}/approve`),
  rejectUser: (id: number) => request<{ user: SafeUser }>("POST", `/api/admin/users/${id}/reject`),
  deactivateUser: (id: number) => request<{ user: SafeUser }>("POST", `/api/admin/users/${id}/deactivate`),
  reactivateUser: (id: number) => request<{ user: SafeUser }>("POST", `/api/admin/users/${id}/reactivate`),
  assignRole: (id: number, role: Role) =>
    request<{ user: SafeUser }>("PATCH", `/api/admin/users/${id}/role`, { role }),

  // membership directory
  getMembers: (params?: { search?: string; status?: string; householdId?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.status) qs.set("status", params.status);
    if (params?.householdId) qs.set("householdId", String(params.householdId));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ members: DirectoryMember[] }>("GET", `/api/members${suffix}`);
  },
  getHouseholds: () => request<{ households: Household[] }>("GET", "/api/households"),
  getMyMemberProfile: () => request<{ member: DirectoryMember }>("GET", "/api/members/me"),
  updateMyMemberProfile: (data: {
    email?: string;
    phone?: string;
    address?: string;
    hideEmail?: boolean;
    hidePhone?: boolean;
    hideAddress?: boolean;
  }) => request<{ member: DirectoryMember }>("PATCH", "/api/members/me", data),

  // leadership member management
  createMember: (data: MemberInput) =>
    request<{ member: DirectoryMember }>("POST", "/api/admin/members", data),
  updateMember: (id: number, data: Partial<MemberInput>) =>
    request<{ member: DirectoryMember }>("PATCH", `/api/admin/members/${id}`, data),
  deleteMember: (id: number) =>
    request<{ message: string }>("DELETE", `/api/admin/members/${id}`),
  linkMember: (id: number, userId: number | null) =>
    request<{ member: DirectoryMember }>("POST", `/api/admin/members/${id}/link`, { userId }),
  getLinkableUsers: () => request<{ users: LinkableUser[] }>("GET", "/api/admin/linkable-users"),
  createHousehold: (data: { name: string; address?: string }) =>
    request<{ household: Household }>("POST", "/api/admin/households", data),
  updateHousehold: (id: number, data: Partial<{ name: string; address?: string }>) =>
    request<{ household: Household }>("PATCH", `/api/admin/households/${id}`, data),
  deleteHousehold: (id: number) =>
    request<{ message: string }>("DELETE", `/api/admin/households/${id}`),

  // analytics
  track: (path: string) => request<{ ok: boolean }>("POST", "/api/track", { path }),
  getAnalyticsSummary: (days = 30) =>
    request<AnalyticsSummary>("GET", `/api/admin/analytics/summary?days=${days}`),

  // checklists
  getChecklistTemplates: () =>
    request<{ templates: TemplateWithSteps[] }>("GET", "/api/checklists/templates"),
  createChecklistTemplate: (data: ChecklistTemplateInput) =>
    request<{ template: ChecklistTemplate }>("POST", "/api/checklists/templates", data),
  updateChecklistTemplate: (id: number, data: ChecklistTemplateInput) =>
    request<{ template: ChecklistTemplate }>("PATCH", `/api/checklists/templates/${id}`, data),
  deleteChecklistTemplate: (id: number) =>
    request<{ message: string }>("DELETE", `/api/checklists/templates/${id}`),
  startChecklist: (templateId: number) =>
    request<{ instance: ChecklistInstance }>("POST", `/api/checklists/templates/${templateId}/start`),
  getChecklistInstances: (status?: "open" | "completed") =>
    request<{ instances: InstanceWithProgress[] }>(
      "GET",
      `/api/checklists/instances${status ? `?status=${status}` : ""}`,
    ),
  getChecklistInstance: (id: number) =>
    request<{ instance: InstanceDetail }>("GET", `/api/checklists/instances/${id}`),
  deleteChecklistInstance: (id: number) =>
    request<{ message: string }>("DELETE", `/api/checklists/instances/${id}`),
  completeStep: (stepId: number) =>
    request<{ instance: InstanceDetail }>("POST", `/api/checklists/steps/${stepId}/complete`),
  uncompleteStep: (stepId: number) =>
    request<{ instance: InstanceDetail }>("POST", `/api/checklists/steps/${stepId}/uncomplete`),
  getMyTasks: () => request<{ tasks: MyTask[] }>("GET", "/api/checklists/my-tasks"),
  getChecklistSummary: () => request<ChecklistSummary>("GET", "/api/checklists/summary"),
};
