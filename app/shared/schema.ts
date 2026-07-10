import {
  pgTable,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  index,
  date,
  uniqueIndex,
  json,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod";

export const ROLES = [
  "super_admin",
  "admin",
  "treasurer",
  "bookkeeper",
  "finance_committee",
  "personnel_committee",
  "deacon",
  "counting_team",
  "member",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  treasurer: "Treasurer",
  bookkeeper: "Bookkeeper",
  finance_committee: "Finance Committee",
  personnel_committee: "Personnel Committee",
  deacon: "Deacon / Leadership",
  counting_team: "Counting Team",
  member: "Member",
};

export const USER_STATUSES = ["pending", "active", "rejected", "deactivated"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

// Roles allowed to see leadership-only member details (notes, full contact info)
// and manage member records.
export const LEADERSHIP_ROLES: Role[] = ["super_admin", "admin", "deacon"];

export const MEMBER_STATUSES = ["active", "inactive", "visitor"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  visitor: "Visitor",
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: varchar("full_name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }),
  emailVerifiedAt: timestamp("email_verified_at"),
  accessNotificationSentAt: timestamp("access_notification_sent_at"),
  phone: varchar("phone", { length: 40 }),
  role: varchar("role", { length: 32 }).$type<Role>().notNull().default("member"),
  status: varchar("status", { length: 20 }).$type<UserStatus>().notNull().default("pending"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  sessionVersion: integer("session_version").notNull().default(1),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaSecretEncrypted: text("mfa_secret_encrypted"),
  notifyDueSoon: boolean("notify_due_soon").notNull().default(true),
  notifyOverdue: boolean("notify_overdue").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
  lastLoginAt: timestamp("last_login_at"),
});

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    usedAt: timestamp("used_at"),
  },
  (table) => [index("email_verification_tokens_user_idx").on(table.userId)],
);

// The legacy users.role column remains during migration. New authorization
// checks use this join table so one person can serve in more than one role.
export const userRoles = pgTable(
  "user_roles",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).$type<Role>().notNull(),
    assignedBy: integer("assigned_by").references(() => users.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.role] })],
);

export const mfaRecoveryCodes = pgTable(
  "mfa_recovery_codes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("mfa_recovery_codes_user_idx").on(table.userId)],
);

export const passwordResetCodes = pgTable(
  "password_reset_codes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    usedAt: timestamp("used_at"),
  },
  (table) => [index("password_reset_codes_user_idx").on(table.userId)],
);

// Failed-login counters shared by every server instance so lockouts survive
// restarts and apply across autoscale replicas. One row per (scope, key) where
// scope is "username" or "ip".
export const loginThrottle = pgTable(
  "login_throttle",
  {
    scope: varchar("scope", { length: 16 }).notNull(),
    key: varchar("key", { length: 255 }).notNull(),
    failureCount: integer("failure_count").notNull().default(0),
    firstFailureAt: timestamp("first_failure_at").notNull().defaultNow(),
    lockedUntil: timestamp("locked_until"),
  },
  (table) => [primaryKey({ columns: [table.scope, table.key] })],
);

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pageViews = pgTable(
  "page_views",
  {
    id: serial("id").primaryKey(),
    path: varchar("path", { length: 500 }).notNull(),
    visitorId: varchar("visitor_id", { length: 40 }).notNull(),
    role: varchar("role", { length: 32 }),
    userId: integer("user_id"),
    viewedAt: timestamp("viewed_at").notNull().defaultNow(),
  },
  (table) => [
    index("page_views_viewed_at_idx").on(table.viewedAt),
    index("page_views_path_idx").on(table.path),
  ],
);

export const AUDIT_EVENT_TYPES = [
  "auth.login",
  "auth.password_changed",
  "auth.password_reset_created",
  "auth.password_reset_used",
  "auth.email_verification_sent",
  "auth.email_verified",
  "auth.access_notification_sent",
  "auth.mfa_enabled",
  "auth.mfa_disabled",
  "user.roles_changed",
  "user.status_changed",
  "committee.sensitivity_changed",
  "finance.count_verified",
  "finance.deposit_reconciled",
  "finance.batch_closed",
  "finance.adjustment_created",
  "finance.export_created",
  "docs.feedback_created",
  "docs.feedback_reviewed",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export const auditEvents = pgTable(
  "audit_events",
  {
    id: serial("id").primaryKey(),
    eventType: varchar("event_type", { length: 80 }).$type<AuditEventType>().notNull(),
    actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    entityType: varchar("entity_type", { length: 80 }),
    entityId: varchar("entity_id", { length: 120 }),
    details: json("details").$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_created_at_idx").on(table.createdAt),
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const FEEDBACK_CATEGORIES = ["unclear", "inaccurate", "outdated", "suggestion", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export const FEEDBACK_STATUSES = ["new", "reviewed", "accepted", "planned", "resolved", "declined"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const documentationFeedback = pgTable(
  "documentation_feedback",
  {
    id: serial("id").primaryKey(),
    pageSlug: varchar("page_slug", { length: 300 }).notNull(),
    documentationRevision: varchar("documentation_revision", { length: 80 }).notNull(),
    sectionId: varchar("section_id", { length: 200 }).notNull().default(""),
    sectionTitle: varchar("section_title", { length: 300 }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    helpful: boolean("helpful").notNull(),
    category: varchar("category", { length: 20 }).$type<FeedbackCategory>().notNull(),
    comment: text("comment"),
    status: varchar("status", { length: 20 }).$type<FeedbackStatus>().notNull().default("new"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at"),
    resolvedAt: timestamp("resolved_at"),
    reviewerId: integer("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("documentation_feedback_user_page_revision_section_idx").on(
      table.userId,
      table.pageSlug,
      table.documentationRevision,
      table.sectionId,
    ),
    index("documentation_feedback_status_idx").on(table.status, table.createdAt),
  ],
);

export const households = pgTable("households", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  address: varchar("address", { length: 300 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const members = pgTable(
  "members",
  {
    id: serial("id").primaryKey(),
    firstName: varchar("first_name", { length: 80 }).notNull(),
    lastName: varchar("last_name", { length: 80 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 40 }),
    address: varchar("address", { length: 300 }),
    householdId: integer("household_id").references(() => households.id, { onDelete: "set null" }),
    status: varchar("status", { length: 20 }).$type<MemberStatus>().notNull().default("active"),
    joinDate: date("join_date"),
    notes: text("notes"),
    hideEmail: boolean("hide_email").notNull().default(false),
    hidePhone: boolean("hide_phone").notNull().default(false),
    hideAddress: boolean("hide_address").notNull().default(false),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }).unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("members_last_first_idx").on(table.lastName, table.firstName),
    index("members_household_idx").on(table.householdId),
    // Trigram GIN indexes so the directory's ILIKE '%term%' name search stays
    // fast at thousands of rows. Requires the pg_trgm extension (created in
    // the live DB via SQL and in the test DB by vitest.globalSetup.ts).
    // Expressions must match buildMemberFilters in app/server/memberRoutes.ts.
    index("members_first_name_trgm_idx").using("gin", sql`${table.firstName} gin_trgm_ops`),
    index("members_last_name_trgm_idx").using("gin", sql`${table.lastName} gin_trgm_ops`),
    index("members_full_name_trgm_idx").using(
      "gin",
      sql`(${table.firstName} || ' ' || ${table.lastName}) gin_trgm_ops`,
    ),
  ],
);

export const RECURRENCES = ["weekly", "monthly", "on_demand"] as const;
export type Recurrence = (typeof RECURRENCES)[number];

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  on_demand: "On Demand",
};

export const INSTANCE_STATUSES = ["open", "completed"] as const;
export type InstanceStatus = (typeof INSTANCE_STATUSES)[number];

export const checklistTemplates = pgTable("checklist_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  recurrence: varchar("recurrence", { length: 20 }).$type<Recurrence>().notNull().default("on_demand"),
  isActive: boolean("is_active").notNull().default(true),
  archivedAt: timestamp("archived_at"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const checklistTemplateSteps = pgTable(
  "checklist_template_steps",
  {
    id: serial("id").primaryKey(),
    templateId: integer("template_id")
      .notNull()
      .references(() => checklistTemplates.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    assignedRole: varchar("assigned_role", { length: 32 }).$type<Role>(),
  },
  (table) => [index("checklist_template_steps_template_idx").on(table.templateId)],
);

export const checklistInstances = pgTable(
  "checklist_instances",
  {
    id: serial("id").primaryKey(),
    templateId: integer("template_id").references(() => checklistTemplates.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 200 }).notNull(),
    periodKey: varchar("period_key", { length: 20 }),
    status: varchar("status", { length: 20 }).$type<InstanceStatus>().notNull().default("open"),
    dueDate: timestamp("due_date"),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    dueSoonEmailAt: timestamp("due_soon_email_at"),
    overdueEmailAt: timestamp("overdue_email_at"),
  },
  (table) => [
    index("checklist_instances_status_idx").on(table.status),
    index("checklist_instances_template_idx").on(table.templateId),
    uniqueIndex("checklist_instances_template_period_idx").on(table.templateId, table.periodKey),
  ],
);

export const checklistInstanceSteps = pgTable(
  "checklist_instance_steps",
  {
    id: serial("id").primaryKey(),
    instanceId: integer("instance_id")
      .notNull()
      .references(() => checklistInstances.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    assignedRole: varchar("assigned_role", { length: 32 }).$type<Role>(),
    completedAt: timestamp("completed_at"),
    completedBy: integer("completed_by").references(() => users.id),
  },
  (table) => [index("checklist_instance_steps_instance_idx").on(table.instanceId)],
);


export const COMMITTEE_POSITIONS = ["chair", "vice_chair", "secretary", "member"] as const;
export type CommitteePosition = (typeof COMMITTEE_POSITIONS)[number];

export const COMMITTEE_POSITION_LABELS: Record<CommitteePosition, string> = {
  chair: "Chair",
  vice_chair: "Vice Chair",
  secretary: "Secretary",
  member: "Member",
};

export const DECISION_STATUSES = [
  "proposed",
  "approved",
  "rejected",
  "complete",
  "needs_review",
  "superseded",
] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  proposed: "Proposed",
  approved: "Approved",
  rejected: "Rejected",
  complete: "Complete",
  needs_review: "Needs Review",
  superseded: "Superseded",
};

export const committees = pgTable("committees", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  description: text("description"),
  isSensitive: boolean("is_sensitive").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const committeeMembers = pgTable(
  "committee_members",
  {
    id: serial("id").primaryKey(),
    committeeId: integer("committee_id")
      .notNull()
      .references(() => committees.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    position: varchar("position", { length: 20 }).$type<CommitteePosition>().notNull().default("member"),
    termStart: varchar("term_start", { length: 10 }),
    termEnd: varchar("term_end", { length: 10 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("committee_members_committee_idx").on(table.committeeId)],
);

export const meetings = pgTable(
  "meetings",
  {
    id: serial("id").primaryKey(),
    committeeId: integer("committee_id")
      .notNull()
      .references(() => committees.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    meetingDate: varchar("meeting_date", { length: 10 }).notNull(),
    attendees: text("attendees"),
    agenda: text("agenda"),
    minutes: text("minutes"),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("meetings_committee_idx").on(table.committeeId)],
);

export const decisions = pgTable(
  "decisions",
  {
    id: serial("id").primaryKey(),
    committeeId: integer("committee_id").references(() => committees.id, { onDelete: "set null" }),
    meetingId: integer("meeting_id").references(() => meetings.id, { onDelete: "set null" }),
    decisionDate: varchar("decision_date", { length: 10 }),
    decision: text("decision").notNull(),
    owner: varchar("owner", { length: 200 }),
    status: varchar("status", { length: 20 }).$type<DecisionStatus>().notNull().default("proposed"),
    notes: text("notes"),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("decisions_committee_idx").on(table.committeeId)],
);
export const NOTIFICATION_TYPES = ["due_soon", "overdue"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    instanceId: integer("instance_id")
      .notNull()
      .references(() => checklistInstances.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).$type<NotificationType>().notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    body: text("body"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    readAt: timestamp("read_at"),
  },
  (table) => [
    index("notifications_user_idx").on(table.userId),
    // One reminder per user + checklist + type; prevents duplicate reminders
    // on every generation pass.
    uniqueIndex("notifications_user_instance_type_idx").on(
      table.userId,
      table.instanceId,
      table.type,
    ),
  ],
);

// ---------- Finance & bookkeeping ----------

export const CATEGORY_TYPES = ["income", "expense"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const budgetCategories = pgTable("budget_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  type: varchar("type", { length: 10 }).$type<CategoryType>().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const COUNT_STATUSES = ["submitted", "verified"] as const;
export type CountStatus = (typeof COUNT_STATUSES)[number];

export const DEPOSIT_STATUSES = ["recorded", "reconciled"] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

export const deposits = pgTable("deposits", {
  id: serial("id").primaryKey(),
  depositDate: date("deposit_date").notNull(),
  amountCents: integer("amount_cents").notNull(),
  bankRef: varchar("bank_ref", { length: 120 }),
  notes: text("notes"),
  status: varchar("status", { length: 20 }).$type<DepositStatus>().notNull().default("recorded"),
  recordedBy: integer("recorded_by").references(() => users.id),
  reconciledBy: integer("reconciled_by").references(() => users.id),
  reconciledAt: timestamp("reconciled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const offeringCounts = pgTable("offering_counts", {
  id: serial("id").primaryKey(),
  countDate: date("count_date").notNull(),
  serviceNote: varchar("service_note", { length: 120 }),
  cashCents: integer("cash_cents").notNull().default(0),
  coinCents: integer("coin_cents").notNull().default(0),
  checksCents: integer("checks_cents").notNull().default(0),
  checkCount: integer("check_count").notNull().default(0),
  otherCents: integer("other_cents").notNull().default(0),
  notes: text("notes"),
  counter1: varchar("counter1", { length: 120 }).notNull(),
  counter2: varchar("counter2", { length: 120 }).notNull(),
  status: varchar("status", { length: 20 }).$type<CountStatus>().notNull().default("submitted"),
  enteredBy: integer("entered_by").references(() => users.id),
  verifiedBy: integer("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  depositId: integer("deposit_id").references(() => deposits.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const TRANSACTION_TYPES = ["income", "expense"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    txnDate: date("txn_date").notNull(),
    type: varchar("type", { length: 10 }).$type<TransactionType>().notNull(),
    categoryId: integer("category_id")
      .references(() => budgetCategories.id)
      .notNull(),
    amountCents: integer("amount_cents").notNull(),
    payee: varchar("payee", { length: 200 }).notNull(),
    memo: text("memo"),
    enteredBy: integer("entered_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("transactions_date_idx").on(table.txnDate)],
);

export const CLOSE_STATUSES = ["open", "in_review", "closed"] as const;
export type CloseStatus = (typeof CLOSE_STATUSES)[number];

export const monthlyCloses = pgTable(
  "monthly_closes",
  {
    id: serial("id").primaryKey(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    status: varchar("status", { length: 20 }).$type<CloseStatus>().notNull().default("open"),
    notes: text("notes"),
    externalLedgerReference: varchar("external_ledger_reference", { length: 200 }),
    signedOffBy: integer("signed_off_by").references(() => users.id),
    signedOffAt: timestamp("signed_off_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("monthly_closes_year_month_idx").on(table.year, table.month)],
);

export const monthlyCloseItems = pgTable("monthly_close_items", {
  id: serial("id").primaryKey(),
  closeId: integer("close_id")
    .references(() => monthlyCloses.id)
    .notNull(),
  label: varchar("label", { length: 200 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isDone: boolean("is_done").notNull().default(false),
  completedBy: integer("completed_by").references(() => users.id),
  completedAt: timestamp("completed_at"),
});

// ---------- Contributions & giving records ----------

export const CONTRIBUTION_METHODS = ["cash", "check", "other"] as const;
export type ContributionMethod = (typeof CONTRIBUTION_METHODS)[number];

export const CONTRIBUTION_METHOD_LABELS: Record<ContributionMethod, string> = {
  cash: "Cash",
  check: "Check",
  other: "Other",
};

export const BATCH_STATUSES = ["open", "closed"] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];
export const BATCH_KINDS = ["regular", "adjustment"] as const;
export type BatchKind = (typeof BATCH_KINDS)[number];

export const givingFunds = pgTable("giving_funds", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const donors = pgTable(
  "donors",
  {
    id: serial("id").primaryKey(),
    firstName: varchar("first_name", { length: 80 }).notNull(),
    lastName: varchar("last_name", { length: 80 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 40 }),
    address: varchar("address", { length: 300 }),
    envelopeNumber: varchar("envelope_number", { length: 20 }),
    memberId: integer("member_id")
      .references(() => members.id, { onDelete: "set null" })
      .unique(),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("donors_last_name_idx").on(table.lastName)],
);

export const contributionBatches = pgTable(
  "contribution_batches",
  {
    id: serial("id").primaryKey(),
    batchDate: date("batch_date").notNull(),
    description: varchar("description", { length: 200 }),
    offeringCountId: integer("offering_count_id").references(() => offeringCounts.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 10 }).$type<BatchStatus>().notNull().default("open"),
    kind: varchar("kind", { length: 20 }).$type<BatchKind>().notNull().default("regular"),
    adjustmentReason: text("adjustment_reason"),
    externalLedgerReference: varchar("external_ledger_reference", { length: 200 }),
    mismatchOverrideReason: text("mismatch_override_reason"),
    notes: text("notes"),
    enteredBy: integer("entered_by").references(() => users.id),
    closedBy: integer("closed_by").references(() => users.id),
    closedAt: timestamp("closed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("contribution_batches_date_idx").on(table.batchDate)],
);

export const contributions = pgTable(
  "contributions",
  {
    id: serial("id").primaryKey(),
    batchId: integer("batch_id")
      .notNull()
      .references(() => contributionBatches.id, { onDelete: "cascade" }),
    donorId: integer("donor_id")
      .notNull()
      .references(() => donors.id),
    fundId: integer("fund_id")
      .notNull()
      .references(() => givingFunds.id),
    contributionDate: date("contribution_date").notNull(),
    amountCents: integer("amount_cents").notNull(),
    method: varchar("method", { length: 10 }).$type<ContributionMethod>().notNull(),
    checkNumber: varchar("check_number", { length: 20 }),
    note: varchar("note", { length: 300 }),
    adjustsContributionId: integer("adjusts_contribution_id"),
    enteredBy: integer("entered_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("contributions_batch_idx").on(table.batchId),
    index("contributions_donor_idx").on(table.donorId),
    index("contributions_date_idx").on(table.contributionDate),
  ],
);

export const DEFAULT_GIVING_FUNDS = [
  { name: "General Fund", description: "Undesignated tithes and offerings", sortOrder: 0 },
  { name: "Missions", description: "Designated gifts to missions", sortOrder: 1 },
  { name: "Building Fund", description: "Designated gifts for building projects and maintenance", sortOrder: 2 },
  { name: "Benevolence", description: "Designated gifts for benevolence ministry", sortOrder: 3 },
] as const;

// Individual donor giving data is confidential: only these roles may see
// donor records, giving history, batch entry detail, and statements.
export const GIVING_ROLES: Role[] = ["treasurer", "bookkeeper"];
// Aggregate fund totals (no individual donor detail) additionally visible to
// the Finance Committee.
export const FUND_REPORT_ROLES: Role[] = [...GIVING_ROLES, "finance_committee"];

export const MONTHLY_CLOSE_TEMPLATE = [
  "Complete bank reconciliations",
  "Review uncleared transactions",
  "Verify restricted fund balances",
  "Review budget variances",
  "Prepare monthly reports",
  "Submit report packet for treasurer and finance committee review",
] as const;

// Role groups for finance access (enforced server-side, reflected in UI).
// Least-privilege matrix: Counting Team = counts only; Bookkeeper edits ledger/deposits;
// Treasurer signs off closes; Finance Committee = reports only; Admins manage categories.
export const FINANCE_VIEW_ROLES: Role[] = [
  "treasurer",
  "bookkeeper",
];
export const COUNT_ENTRY_ROLES: Role[] = [
  "treasurer",
  "bookkeeper",
  "counting_team",
];
export const COUNT_VIEW_ROLES: Role[] = [...FINANCE_VIEW_ROLES, "counting_team"];
export const DEPOSIT_MANAGE_ROLES: Role[] = ["treasurer", "bookkeeper"];
export const LEDGER_EDIT_ROLES: Role[] = ["treasurer", "bookkeeper"];
export const CLOSE_MANAGE_ROLES: Role[] = ["treasurer", "bookkeeper"];
export const CLOSE_SIGNOFF_ROLES: Role[] = ["treasurer"];
export const REPORT_VIEW_ROLES: Role[] = [...FINANCE_VIEW_ROLES, "finance_committee"];
export const CATEGORY_MANAGE_ROLES: Role[] = ["treasurer"];
// Any role that can access some part of the Finance section (nav visibility / index redirect)
export const FINANCE_NAV_ROLES: Role[] = [...COUNT_VIEW_ROLES, "finance_committee"];

export type User = typeof users.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type AuthenticatedUser = User & { roles: Role[] };
export type Announcement = typeof announcements.$inferSelect;
export type PageView = typeof pageViews.$inferSelect;
export type Household = typeof households.$inferSelect;
export type Member = typeof members.$inferSelect;
export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;
export type ChecklistTemplateStep = typeof checklistTemplateSteps.$inferSelect;
export type ChecklistInstance = typeof checklistInstances.$inferSelect;
export type ChecklistInstanceStep = typeof checklistInstanceSteps.$inferSelect;
export type Committee = typeof committees.$inferSelect;
export type CommitteeMember = typeof committeeMembers.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type Decision = typeof decisions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type BudgetCategory = typeof budgetCategories.$inferSelect;
export type OfferingCount = typeof offeringCounts.$inferSelect;
export type Deposit = typeof deposits.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type MonthlyClose = typeof monthlyCloses.$inferSelect;
export type MonthlyCloseItem = typeof monthlyCloseItems.$inferSelect;
export type GivingFund = typeof givingFunds.$inferSelect;
export type Donor = typeof donors.$inferSelect;
export type ContributionBatch = typeof contributionBatches.$inferSelect;
export type Contribution = typeof contributions.$inferSelect;
export type DocumentationFeedback = typeof documentationFeedback.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;

export type SafeUser = Omit<User, "passwordHash" | "mfaSecretEncrypted"> & { roles: Role[] };

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username may only contain letters, numbers, dots, dashes, and underscores"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  fullName: z.string().min(2, "Please enter your full name").max(120),
  email: z.string().trim().email("Please enter a valid email").max(255),
  phone: z.string().max(40).optional().or(z.literal("")),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const setPasswordSchema = z.object({
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
});

export const announcementSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  body: z.string().min(1, "Body is required"),
  isPublic: z.boolean().default(true),
});

export const assignRoleSchema = z.object({
  role: z.enum(ROLES),
});

export const assignRolesSchema = z.object({
  roles: z.array(z.enum(ROLES)).min(1).max(ROLES.length),
});

export const passwordResetSchema = z.object({
  username: z.string().min(1).max(64),
  resetCode: z.string().min(8).max(128),
  newPassword: z.string().min(8).max(128),
});

export const documentationFeedbackSchema = z
  .object({
    pageSlug: z.string().min(1).max(300),
    documentationRevision: z.string().min(1).max(80),
    sectionId: z.string().max(200).default(""),
    sectionTitle: z.string().trim().max(300).optional().or(z.literal("")),
    helpful: z.boolean(),
    category: z.enum(FEEDBACK_CATEGORIES),
    comment: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .superRefine((feedback, context) => {
    if (feedback.sectionId && !feedback.comment?.trim()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["comment"], message: "A section comment is required" });
    }
  });

export const documentationFeedbackReviewSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES),
});

const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const memberSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  email: z.string().trim().email("Please enter a valid email").max(255).optional().or(z.literal("")),
  phone: optionalTrimmed(40),
  address: optionalTrimmed(300),
  householdId: z.number().int().positive().nullable().optional(),
  status: z.enum(MEMBER_STATUSES).default("active"),
  joinDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Join date must be YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
  hideEmail: z.boolean().default(false),
  hidePhone: z.boolean().default(false),
  hideAddress: z.boolean().default(false),
});

export const selfMemberUpdateSchema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255).optional().or(z.literal("")),
  phone: optionalTrimmed(40),
  address: optionalTrimmed(300),
  hideEmail: z.boolean().optional(),
  hidePhone: z.boolean().optional(),
  hideAddress: z.boolean().optional(),
});

export const householdSchema = z.object({
  name: z.string().trim().min(1, "Household name is required").max(120),
  address: optionalTrimmed(300),
});

export const linkMemberSchema = z.object({
  userId: z.number().int().positive().nullable(),
});

// Roles allowed to create/edit checklist templates and manage instances.
export const CHECKLIST_MANAGER_ROLES: Role[] = [
  "super_admin",
  "admin",
  "treasurer",
  "finance_committee",
  "deacon",
];

export const checklistTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  recurrence: z.enum(RECURRENCES),
  isActive: z.boolean().default(true),
  steps: z
    .array(
      z.object({
        title: z.string().min(1, "Step title is required").max(300),
        assignedRole: z.enum(ROLES).nullable().optional(),
      }),
    )
    .min(1, "Add at least one step")
    .max(100),
});

export type ChecklistTemplateInput = z.infer<typeof checklistTemplateSchema>;

export const notificationPrefsSchema = z.object({
  notifyDueSoon: z.boolean(),
  notifyOverdue: z.boolean(),
});

export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>;

// Session table managed by connect-pg-simple (defined here so drizzle-kit push
// does not try to drop it).
export const session = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Please use YYYY-MM-DD format");

export const committeeSchema = z.object({
  name: z.string().min(2, "Committee name is required").max(120),
  description: z.string().max(5000).optional().or(z.literal("")),
  isSensitive: z.boolean().default(false),
});

export const committeeMemberSchema = z.object({
  userId: z.number().int().positive(),
  position: z.enum(COMMITTEE_POSITIONS).default("member"),
  termStart: dateString.optional().or(z.literal("")),
  termEnd: dateString.optional().or(z.literal("")),
});

export const meetingSchema = z.object({
  title: z.string().min(1, "Meeting title is required").max(200),
  meetingDate: dateString,
  attendees: z.string().max(2000).optional().or(z.literal("")),
  agenda: z.string().max(20000).optional().or(z.literal("")),
  minutes: z.string().max(50000).optional().or(z.literal("")),
});

export const decisionSchema = z.object({
  committeeId: z.number().int().positive().nullable().optional(),
  meetingId: z.number().int().positive().nullable().optional(),
  decisionDate: dateString.optional().or(z.literal("")),
  decision: z.string().min(1, "Decision text is required").max(10000),
  owner: z.string().max(200).optional().or(z.literal("")),
  status: z.enum(DECISION_STATUSES).default("proposed"),
  notes: z.string().max(10000).optional().or(z.literal("")),
});

// ---------- Finance schemas ----------

const cents = z.number().int("Amount must be a whole number of cents").min(0).max(1_000_000_000);

export const budgetCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  type: z.enum(CATEGORY_TYPES),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});

export const offeringCountSchema = z
  .object({
    countDate: dateString,
    serviceNote: z.string().max(120).optional().or(z.literal("")),
    cashCents: cents.default(0),
    coinCents: cents.default(0),
    checksCents: cents.default(0),
    checkCount: z.number().int().min(0).max(10000).default(0),
    otherCents: cents.default(0),
    notes: z.string().max(2000).optional().or(z.literal("")),
    counter1: z.string().min(1, "First counter name is required").max(120),
    counter2: z.string().min(1, "Second counter name is required").max(120),
  })
  .refine((d) => d.cashCents + d.coinCents + d.checksCents + d.otherCents > 0, {
    message: "The count total must be greater than zero",
  })
  .refine((d) => d.counter1.trim().toLowerCase() !== d.counter2.trim().toLowerCase(), {
    message: "Two different counters are required",
  });

export const depositSchema = z.object({
  depositDate: dateString,
  amountCents: cents.refine((v) => v > 0, "Deposit amount must be greater than zero"),
  bankRef: z.string().max(120).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  countIds: z.array(z.number().int().positive()).default([]),
});

export const transactionSchema = z.object({
  txnDate: dateString,
  type: z.enum(TRANSACTION_TYPES),
  categoryId: z.number().int().positive("Please choose a category"),
  amountCents: cents.refine((v) => v > 0, "Amount must be greater than zero"),
  payee: z.string().min(1, "Payee / source is required").max(200),
  memo: z.string().max(2000).optional().or(z.literal("")),
});

export const monthlyCloseCreateSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});


export const closeSignoffSchema = z.object({
  notes: z.string().max(2000).optional().or(z.literal("")),
  externalLedgerReference: z.string().trim().min(1).max(200),
  acknowledgeOpenBatches: z.boolean().optional(),
});

// ---------- Contributions & giving schemas ----------

export const givingFundSchema = z.object({
  name: z.string().trim().min(1, "Fund name is required").max(120),
  description: z.string().max(2000).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});

export const donorSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  email: z.string().trim().email("Please enter a valid email").max(255).optional().or(z.literal("")),
  phone: optionalTrimmed(40),
  address: optionalTrimmed(300),
  envelopeNumber: optionalTrimmed(20),
  memberId: z.number().int().positive().nullable().optional(),
  notes: z.string().max(5000).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export const contributionBatchSchema = z.object({
  batchDate: dateString,
  description: z.string().max(200).optional().or(z.literal("")),
  offeringCountId: z.number().int().positive().nullable().optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export const contributionSchema = z
  .object({
    donorId: z.number().int().positive("Please choose a donor"),
    fundId: z.number().int().positive("Please choose a fund"),
    contributionDate: dateString.optional().or(z.literal("")),
    amountCents: cents.refine((v) => v > 0, "Amount must be greater than zero"),
    method: z.enum(CONTRIBUTION_METHODS),
    checkNumber: optionalTrimmed(20),
    note: z.string().max(300).optional().or(z.literal("")),
  })
  .refine((d) => d.method !== "check" || (d.checkNumber ?? "").trim() !== "", {
    message: "A check number is required for check contributions",
  });

export const donorMergeSchema = z.object({
  intoDonorId: z.number().int().positive(),
});

export const batchCloseSchema = z.object({
  allowMismatch: z.boolean().default(false),
  mismatchOverrideReason: z.string().trim().max(2000).optional().or(z.literal("")),
  externalLedgerReference: z.string().trim().min(1).max(200),
});

export const contributionAdjustmentSchema = z.object({
  replacementFundId: z.number().int().positive().optional(),
  replacementAmountCents: cents.refine((v) => v > 0, "Amount must be greater than zero").optional(),
  replacementDate: dateString.optional(),
  reason: z.string().trim().min(10, "Please explain the correction").max(2000),
  externalLedgerReference: z.string().trim().min(1).max(200),
});
