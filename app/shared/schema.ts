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
} from "drizzle-orm/pg-core";
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
  phone: varchar("phone", { length: 40 }),
  role: varchar("role", { length: 32 }).$type<Role>().notNull().default("member"),
  status: varchar("status", { length: 20 }).$type<UserStatus>().notNull().default("pending"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
  lastLoginAt: timestamp("last_login_at"),
});

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
    index("members_last_name_idx").on(table.lastName),
    index("members_household_idx").on(table.householdId),
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

export type User = typeof users.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type PageView = typeof pageViews.$inferSelect;
export type Household = typeof households.$inferSelect;
export type Member = typeof members.$inferSelect;
export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;
export type ChecklistTemplateStep = typeof checklistTemplateSteps.$inferSelect;
export type ChecklistInstance = typeof checklistInstances.$inferSelect;
export type ChecklistInstanceStep = typeof checklistInstanceSteps.$inferSelect;

export type SafeUser = Omit<User, "passwordHash">;

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username may only contain letters, numbers, dots, dashes, and underscores"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  fullName: z.string().min(2, "Please enter your full name").max(120),
  email: z.string().email("Please enter a valid email").max(255).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
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
