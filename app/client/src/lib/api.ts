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
  Committee,
  CommitteeMember,
  CommitteePosition,
  Meeting,
  Decision,
  DecisionStatus,
  BudgetCategory,
  OfferingCount,
  Deposit,
  Transaction,
  MonthlyClose,
  MonthlyCloseItem,
  CategoryType,
  TransactionType,
  GivingFund,
  Donor,
  ContributionBatch,
  Contribution,
  ContributionMethod,
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

export interface MemberLinkSuggestion {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  householdName: string | null;
  matchedOn: string;
  matchType: "exact" | "close";
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

export type Timeliness = "on_time" | "late" | "overdue" | null;

export type HistoryInstance = ChecklistInstance & {
  timeliness: Timeliness;
  progress: { total: number; completed: number };
  steps: InstanceStepDetail[];
};

export interface TemplateHistory {
  template: ChecklistTemplate;
  instances: HistoryInstance[];
}

export interface AppNotification {
  id: number;
  userId: number;
  instanceId: number;
  type: "due_soon" | "overdue";
  title: string;
  body: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface ChecklistSummary {
  openCount: number;
  myOpenSteps: number;
  overdue: InstanceWithProgress[];
  upcoming: InstanceWithProgress[];
}

export type CommitteeSummary = Committee & {
  memberCount: number;
  myPosition: CommitteePosition | null;
  canManage: boolean;
};

export type RosterEntry = {
  id: number;
  userId: number;
  position: CommitteePosition;
  termStart: string | null;
  termEnd: string | null;
  fullName: string;
  username: string;
  email: string | null;
};

export type CommitteeDetail = {
  committee: Committee;
  roster: RosterEntry[];
  meetings: Meeting[];
  decisions: Decision[];
  canManage: boolean;
};

export type DecisionLogEntry = Decision & {
  committeeName: string | null;
  meetingTitle: string | null;
  meetingDate: string | null;
  canManage: boolean;
};

export type DecisionLog = {
  decisions: DecisionLogEntry[];
  committees: { id: number; name: string }[];
  canCreateGeneral: boolean;
};

export type GovernanceOverview = {
  myCommittees: {
    committeeId: number;
    position: CommitteePosition;
    termStart: string | null;
    termEnd: string | null;
    name: string;
    isSensitive: boolean;
  }[];
  upcomingMeetings: { id: number; committeeId: number; committeeName: string; title: string; meetingDate: string }[];
  recentMeetings: { id: number; committeeId: number; committeeName: string; title: string; meetingDate: string }[];
};

export type CommitteeInput = { name: string; description?: string; isSensitive: boolean };
export type CommitteeMemberInput = { userId: number; position: CommitteePosition; termStart?: string; termEnd?: string };
export type MeetingInput = { title: string; meetingDate: string; attendees?: string; agenda?: string; minutes?: string };
export type DecisionInput = {
  committeeId?: number | null;
  meetingId?: number | null;
  decisionDate?: string;
  decision: string;
  owner?: string;
  status: DecisionStatus;
  notes?: string;
};

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
  getMembers: (params?: {
    search?: string;
    status?: string;
    householdId?: number;
    limit?: number;
    offset?: number;
    sort?: "household";
  }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.status) qs.set("status", params.status);
    if (params?.householdId) qs.set("householdId", String(params.householdId));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    if (params?.sort) qs.set("sort", params.sort);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ members: DirectoryMember[]; total: number }>("GET", `/api/members${suffix}`);
  },
  getHouseholds: (params?: { search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ households: Household[] }>("GET", `/api/households${suffix}`);
  },
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
  getMemberLinkSuggestions: () =>
    request<{ suggestions: Record<number, MemberLinkSuggestion[]> }>("GET", "/api/admin/member-link-suggestions"),
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
    request<{ archived: boolean; message: string; template?: ChecklistTemplate }>(
      "DELETE",
      `/api/checklists/templates/${id}`,
    ),
  restoreChecklistTemplate: (id: number) =>
    request<{ template: ChecklistTemplate }>("POST", `/api/checklists/templates/${id}/restore`),
  getChecklistTemplateHistory: (id: number) =>
    request<TemplateHistory>("GET", `/api/checklists/templates/${id}/history`),
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

  // committees & governance
  getCommittees: () =>
    request<{ committees: CommitteeSummary[]; canCreate: boolean }>("GET", "/api/committees"),
  createCommittee: (data: CommitteeInput) =>
    request<{ committee: Committee }>("POST", "/api/committees", data),
  updateCommittee: (id: number, data: Partial<CommitteeInput>) =>
    request<{ committee: Committee }>("PATCH", `/api/committees/${id}`, data),
  deleteCommittee: (id: number) =>
    request<{ message: string }>("DELETE", `/api/committees/${id}`),
  getCommittee: (id: number) => request<CommitteeDetail>("GET", `/api/committees/${id}`),
  getEligibleUsers: (committeeId: number) =>
    request<{ users: { id: number; fullName: string; username: string; role: Role }[] }>(
      "GET",
      `/api/committees/${committeeId}/eligible-users`,
    ),
  addCommitteeMember: (committeeId: number, data: CommitteeMemberInput) =>
    request<{ member: CommitteeMember }>("POST", `/api/committees/${committeeId}/members`, data),
  updateCommitteeMember: (committeeId: number, memberId: number, data: Partial<CommitteeMemberInput>) =>
    request<{ member: CommitteeMember }>("PATCH", `/api/committees/${committeeId}/members/${memberId}`, data),
  removeCommitteeMember: (committeeId: number, memberId: number) =>
    request<{ message: string }>("DELETE", `/api/committees/${committeeId}/members/${memberId}`),
  createMeeting: (committeeId: number, data: MeetingInput) =>
    request<{ meeting: Meeting }>("POST", `/api/committees/${committeeId}/meetings`, data),
  updateMeeting: (committeeId: number, meetingId: number, data: Partial<MeetingInput>) =>
    request<{ meeting: Meeting }>("PATCH", `/api/committees/${committeeId}/meetings/${meetingId}`, data),
  deleteMeeting: (committeeId: number, meetingId: number) =>
    request<{ message: string }>("DELETE", `/api/committees/${committeeId}/meetings/${meetingId}`),
  getDecisions: () => request<DecisionLog>("GET", "/api/decisions"),
  createDecision: (data: DecisionInput) =>
    request<{ decision: Decision }>("POST", "/api/decisions", data),
  updateDecision: (id: number, data: Partial<DecisionInput>) =>
    request<{ decision: Decision }>("PATCH", `/api/decisions/${id}`, data),
  deleteDecision: (id: number) => request<{ message: string }>("DELETE", `/api/decisions/${id}`),
  getGovernanceOverview: () => request<GovernanceOverview>("GET", "/api/governance/overview"),

  // notifications
  getNotifications: () =>
    request<{ notifications: AppNotification[]; unreadCount: number }>("GET", "/api/notifications"),
  markNotificationRead: (id: number) =>
    request<{ notification: AppNotification }>("POST", `/api/notifications/${id}/read`),
  markAllNotificationsRead: () =>
    request<{ message: string }>("POST", "/api/notifications/read-all"),
  updateNotificationPrefs: (data: { notifyDueSoon: boolean; notifyOverdue: boolean }) =>
    request<{ user: SafeUser }>("PATCH", "/api/notifications/prefs", data),

  // finance: categories
  getCategories: () => request<{ categories: BudgetCategory[] }>("GET", "/api/finance/categories"),
  createCategory: (data: { name: string; type: CategoryType; isActive?: boolean; sortOrder?: number }) =>
    request<{ category: BudgetCategory }>("POST", "/api/finance/categories", data),
  updateCategory: (id: number, data: Partial<{ name: string; type: CategoryType; isActive: boolean; sortOrder: number }>) =>
    request<{ category: BudgetCategory }>("PATCH", `/api/finance/categories/${id}`, data),

  // finance: offering counts
  getCounts: (unlinkedOnly = false) =>
    request<{ counts: OfferingCountRow[] }>("GET", `/api/finance/counts${unlinkedOnly ? "?unlinked=1" : ""}`),
  createCount: (data: OfferingCountInput) =>
    request<{ count: OfferingCount }>("POST", "/api/finance/counts", data),
  updateCount: (id: number, data: OfferingCountInput) =>
    request<{ count: OfferingCount }>("PATCH", `/api/finance/counts/${id}`, data),
  verifyCount: (id: number) =>
    request<{ count: OfferingCount }>("POST", `/api/finance/counts/${id}/verify`),

  // finance: deposits
  getDeposits: () => request<{ deposits: DepositRow[] }>("GET", "/api/finance/deposits"),
  createDeposit: (data: { depositDate: string; amountCents: number; bankRef?: string; notes?: string; countIds: number[] }) =>
    request<{ deposit: Deposit }>("POST", "/api/finance/deposits", data),
  reconcileDeposit: (id: number) =>
    request<{ deposit: Deposit }>("POST", `/api/finance/deposits/${id}/reconcile`),

  // finance: transactions
  getTransactions: (params?: { type?: string; categoryId?: number; search?: string; month?: string }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set("type", params.type);
    if (params?.categoryId) qs.set("categoryId", String(params.categoryId));
    if (params?.search) qs.set("search", params.search);
    if (params?.month) qs.set("month", params.month);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ transactions: TransactionRow[] }>("GET", `/api/finance/transactions${suffix}`);
  },
  createTransaction: (data: TransactionInput) =>
    request<{ transaction: Transaction }>("POST", "/api/finance/transactions", data),
  updateTransaction: (id: number, data: TransactionInput) =>
    request<{ transaction: Transaction }>("PATCH", `/api/finance/transactions/${id}`, data),
  deleteTransaction: (id: number) =>
    request<{ message: string }>("DELETE", `/api/finance/transactions/${id}`),

  // finance: monthly close
  getCloses: () => request<{ closes: MonthlyCloseRow[] }>("GET", "/api/finance/closes"),
  createClose: (data: { year: number; month: number }) =>
    request<{ close: MonthlyCloseRow }>("POST", "/api/finance/closes", data),
  toggleCloseItem: (closeId: number, itemId: number, isDone: boolean) =>
    request<{ item: MonthlyCloseItem }>("PATCH", `/api/finance/closes/${closeId}/items/${itemId}`, { isDone }),
  signoffClose: (id: number, notes?: string) =>
    request<{ close: MonthlyClose }>("POST", `/api/finance/closes/${id}/signoff`, { notes }),
  reopenClose: (id: number) =>
    request<{ close: MonthlyClose }>("POST", `/api/finance/closes/${id}/reopen`),

  // finance: reports
  getFinanceSummary: (year?: number) =>
    request<FinanceSummary>("GET", `/api/finance/reports/summary${year ? `?year=${year}` : ""}`),

  // giving: funds
  getGivingFunds: () => request<{ funds: GivingFund[] }>("GET", "/api/giving/funds"),
  createGivingFund: (data: { name: string; description?: string; isActive?: boolean; sortOrder?: number }) =>
    request<{ fund: GivingFund }>("POST", "/api/giving/funds", data),
  updateGivingFund: (id: number, data: Partial<{ name: string; description: string; isActive: boolean; sortOrder: number }>) =>
    request<{ fund: GivingFund }>("PATCH", `/api/giving/funds/${id}`, data),

  // giving: donors
  getDonors: (params?: { search?: string; activeOnly?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.activeOnly) qs.set("active", "1");
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ donors: DonorRow[] }>("GET", `/api/giving/donors${suffix}`);
  },
  getDonor: (id: number) => request<DonorDetail>("GET", `/api/giving/donors/${id}`),
  createDonor: (data: DonorInput) => request<{ donor: Donor }>("POST", "/api/giving/donors", data),
  updateDonor: (id: number, data: Partial<DonorInput>) =>
    request<{ donor: Donor }>("PATCH", `/api/giving/donors/${id}`, data),
  deleteDonor: (id: number) => request<{ message: string }>("DELETE", `/api/giving/donors/${id}`),
  mergeDonor: (id: number, intoDonorId: number) =>
    request<{ message: string }>("POST", `/api/giving/donors/${id}/merge`, { intoDonorId }),
  getDonorStatement: (id: number, start: string, end: string) =>
    request<DonorStatement>("GET", `/api/giving/donors/${id}/statement?start=${start}&end=${end}`),

  // giving: batches & contributions
  getGivingBatches: () => request<{ batches: GivingBatchRow[] }>("GET", "/api/giving/batches"),
  getGivingBatch: (id: number) => request<GivingBatchDetail>("GET", `/api/giving/batches/${id}`),
  createGivingBatch: (data: GivingBatchInput) =>
    request<{ batch: ContributionBatch }>("POST", "/api/giving/batches", data),
  updateGivingBatch: (id: number, data: Partial<GivingBatchInput>) =>
    request<{ batch: ContributionBatch }>("PATCH", `/api/giving/batches/${id}`, data),
  deleteGivingBatch: (id: number) => request<{ message: string }>("DELETE", `/api/giving/batches/${id}`),
  closeGivingBatch: (id: number, allowMismatch = false) =>
    request<{ batch: ContributionBatch }>("POST", `/api/giving/batches/${id}/close`, { allowMismatch }),
  reopenGivingBatch: (id: number) =>
    request<{ batch: ContributionBatch }>("POST", `/api/giving/batches/${id}/reopen`),
  createContribution: (batchId: number, data: ContributionInput) =>
    request<{ contribution: Contribution }>("POST", `/api/giving/batches/${batchId}/contributions`, data),
  updateContribution: (id: number, data: ContributionInput) =>
    request<{ contribution: Contribution }>("PATCH", `/api/giving/contributions/${id}`, data),
  deleteContribution: (id: number) =>
    request<{ message: string }>("DELETE", `/api/giving/contributions/${id}`),

  // giving: fund summary (aggregates only)
  getFundSummary: (params?: { year?: number; start?: string; end?: string }) => {
    const qs = new URLSearchParams();
    if (params?.year) qs.set("year", String(params.year));
    if (params?.start) qs.set("start", params.start);
    if (params?.end) qs.set("end", params.end);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<FundSummary>("GET", `/api/giving/reports/funds${suffix}`);
  },
};

export interface OfferingCountInput {
  countDate: string;
  serviceNote?: string;
  cashCents: number;
  coinCents: number;
  checksCents: number;
  checkCount: number;
  otherCents: number;
  notes?: string;
  counter1: string;
  counter2: string;
}

export type OfferingCountRow = OfferingCount & {
  totalCents: number;
  enteredByName: string | null;
  verifiedByName: string | null;
};

export type DepositRow = Deposit & {
  counts: { id: number; countDate: string; totalCents: number }[];
};

export interface TransactionInput {
  txnDate: string;
  type: TransactionType;
  categoryId: number;
  amountCents: number;
  payee: string;
  memo?: string;
}

export type TransactionRow = Transaction & {
  categoryName: string;
  enteredByName: string | null;
};

export type MonthlyCloseRow = MonthlyClose & {
  signedOffByName?: string | null;
  items: MonthlyCloseItem[];
};

export interface FinanceSummary {
  year: number;
  priorYear: number;
  monthly: { month: number; type: string; totalCents: number }[];
  byCategory: { categoryId: number; categoryName: string; type: string; totalCents: number }[];
  ytd: { incomeCents: number; expenseCents: number };
  prior: { incomeCents: number; expenseCents: number };
}

// ---------- Giving types ----------

export interface DonorInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  envelopeNumber?: string;
  memberId?: number | null;
  notes?: string;
  isActive?: boolean;
}

export type DonorRow = Donor & {
  memberName: string | null;
  totalCents: number;
  contributionCount: number;
  lastContributionDate: string | null;
};

export type ContributionRow = Contribution & {
  fundName: string;
  batchDate: string;
  batchStatus: string;
};

export interface DonorDetail {
  donor: Donor & { memberName: string | null };
  contributions: ContributionRow[];
  byYear: { year: number; totalCents: number; count: number }[];
}

export interface DonorStatement {
  donor: Donor;
  start: string;
  end: string;
  contributions: (Contribution & { fundName: string })[];
  fundTotals: { fundName: string; totalCents: number }[];
  totalCents: number;
}

export interface GivingBatchInput {
  batchDate: string;
  description?: string;
  offeringCountId?: number | null;
  notes?: string;
}

export type GivingBatchRow = ContributionBatch & {
  enteredByName: string | null;
  totalCents: number;
  contributionCount: number;
  countTotalCents: number | null;
  countDate: string | null;
};

export interface ContributionInput {
  donorId: number;
  fundId: number;
  contributionDate?: string;
  amountCents: number;
  method: ContributionMethod;
  checkNumber?: string;
  note?: string;
}

export type BatchContributionRow = Contribution & {
  donorName: string;
  fundName: string;
};

export interface GivingBatchDetail {
  batch: GivingBatchRow;
  contributions: BatchContributionRow[];
}

export interface FundSummary {
  start: string;
  end: string;
  byFund: {
    fundId: number;
    fundName: string;
    totalCents: number;
    contributionCount: number;
    donorCount: number;
  }[];
  monthly: { month: string; fundId: number; totalCents: number }[];
  totalCents: number;
}
