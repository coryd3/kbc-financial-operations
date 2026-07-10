import {
  pgTable,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  index,
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

export type User = typeof users.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type PageView = typeof pageViews.$inferSelect;

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
