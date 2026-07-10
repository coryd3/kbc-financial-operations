CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"actor_user_id" integer,
	"entity_type" varchar(80),
	"entity_id" varchar(120),
	"details" json DEFAULT '{}'::json NOT NULL,
	"ip_address" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "budget_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"type" varchar(10) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checklist_instance_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"instance_id" integer NOT NULL,
	"position" integer NOT NULL,
	"title" varchar(300) NOT NULL,
	"assigned_role" varchar(32),
	"completed_at" timestamp,
	"completed_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checklist_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer,
	"name" varchar(200) NOT NULL,
	"period_key" varchar(20),
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"due_date" timestamp,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"due_soon_email_at" timestamp,
	"overdue_email_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checklist_template_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"position" integer NOT NULL,
	"title" varchar(300) NOT NULL,
	"assigned_role" varchar(32)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checklist_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"recurrence" varchar(20) DEFAULT 'on_demand' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "committee_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"committee_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"position" varchar(20) DEFAULT 'member' NOT NULL,
	"term_start" varchar(10),
	"term_end" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "committees" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "committees_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contribution_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_date" date NOT NULL,
	"description" varchar(200),
	"offering_count_id" integer,
	"status" varchar(10) DEFAULT 'open' NOT NULL,
	"kind" varchar(20) DEFAULT 'regular' NOT NULL,
	"adjustment_reason" text,
	"external_ledger_reference" varchar(200),
	"mismatch_override_reason" text,
	"notes" text,
	"entered_by" integer,
	"closed_by" integer,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"donor_id" integer NOT NULL,
	"fund_id" integer NOT NULL,
	"contribution_date" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" varchar(10) NOT NULL,
	"check_number" varchar(20),
	"note" varchar(300),
	"adjusts_contribution_id" integer,
	"entered_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"committee_id" integer,
	"meeting_id" integer,
	"decision_date" varchar(10),
	"decision" text NOT NULL,
	"owner" varchar(200),
	"status" varchar(20) DEFAULT 'proposed' NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deposits" (
	"id" serial PRIMARY KEY NOT NULL,
	"deposit_date" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"bank_ref" varchar(120),
	"notes" text,
	"status" varchar(20) DEFAULT 'recorded' NOT NULL,
	"recorded_by" integer,
	"reconciled_by" integer,
	"reconciled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documentation_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_slug" varchar(300) NOT NULL,
	"documentation_revision" varchar(80) NOT NULL,
	"user_id" integer NOT NULL,
	"helpful" boolean NOT NULL,
	"category" varchar(20) NOT NULL,
	"comment" text,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp,
	"resolved_at" timestamp,
	"reviewer_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "donors" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" varchar(80) NOT NULL,
	"last_name" varchar(80) NOT NULL,
	"email" varchar(255),
	"phone" varchar(40),
	"address" varchar(300),
	"envelope_number" varchar(20),
	"member_id" integer,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "donors_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "giving_funds" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "giving_funds_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "households" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"address" varchar(300),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "login_throttle" (
	"scope" varchar(16) NOT NULL,
	"key" varchar(255) NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"first_failure_at" timestamp DEFAULT now() NOT NULL,
	"locked_until" timestamp,
	CONSTRAINT "login_throttle_scope_key_pk" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"committee_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"meeting_date" varchar(10) NOT NULL,
	"attendees" text,
	"agenda" text,
	"minutes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" varchar(80) NOT NULL,
	"last_name" varchar(80) NOT NULL,
	"email" varchar(255),
	"phone" varchar(40),
	"address" varchar(300),
	"household_id" integer,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"join_date" date,
	"notes" text,
	"hide_email" boolean DEFAULT false NOT NULL,
	"hide_phone" boolean DEFAULT false NOT NULL,
	"hide_address" boolean DEFAULT false NOT NULL,
	"user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "members_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mfa_recovery_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monthly_close_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"close_id" integer NOT NULL,
	"label" varchar(200) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_done" boolean DEFAULT false NOT NULL,
	"completed_by" integer,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monthly_closes" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"notes" text,
	"external_ledger_reference" varchar(200),
	"signed_off_by" integer,
	"signed_off_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"instance_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"title" varchar(300) NOT NULL,
	"body" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offering_counts" (
	"id" serial PRIMARY KEY NOT NULL,
	"count_date" date NOT NULL,
	"service_note" varchar(120),
	"cash_cents" integer DEFAULT 0 NOT NULL,
	"coin_cents" integer DEFAULT 0 NOT NULL,
	"checks_cents" integer DEFAULT 0 NOT NULL,
	"check_count" integer DEFAULT 0 NOT NULL,
	"other_cents" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"counter1" varchar(120) NOT NULL,
	"counter2" varchar(120) NOT NULL,
	"status" varchar(20) DEFAULT 'submitted' NOT NULL,
	"entered_by" integer,
	"verified_by" integer,
	"verified_at" timestamp,
	"deposit_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "page_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" varchar(500) NOT NULL,
	"visitor_id" varchar(40) NOT NULL,
	"role" varchar(32),
	"user_id" integer,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"txn_date" date NOT NULL,
	"type" varchar(10) NOT NULL,
	"category_id" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"payee" varchar(200) NOT NULL,
	"memo" text,
	"entered_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"user_id" integer NOT NULL,
	"role" varchar(32) NOT NULL,
	"assigned_by" integer,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"email" varchar(255),
	"phone" varchar(40),
	"role" varchar(32) DEFAULT 'member' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret_encrypted" text,
	"notify_due_soon" boolean DEFAULT true NOT NULL,
	"notify_overdue" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"last_login_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
INSERT INTO "user_roles" ("user_id", "role")
SELECT "id", "role" FROM "users"
ON CONFLICT ("user_id", "role") DO NOTHING;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklist_instance_steps" ADD CONSTRAINT "checklist_instance_steps_instance_id_checklist_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."checklist_instances"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklist_instance_steps" ADD CONSTRAINT "checklist_instance_steps_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklist_instances" ADD CONSTRAINT "checklist_instances_template_id_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklist_instances" ADD CONSTRAINT "checklist_instances_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklist_template_steps" ADD CONSTRAINT "checklist_template_steps_template_id_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contribution_batches" ADD CONSTRAINT "contribution_batches_offering_count_id_offering_counts_id_fk" FOREIGN KEY ("offering_count_id") REFERENCES "public"."offering_counts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contribution_batches" ADD CONSTRAINT "contribution_batches_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contribution_batches" ADD CONSTRAINT "contribution_batches_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contributions" ADD CONSTRAINT "contributions_batch_id_contribution_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."contribution_batches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contributions" ADD CONSTRAINT "contributions_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contributions" ADD CONSTRAINT "contributions_fund_id_giving_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."giving_funds"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contributions" ADD CONSTRAINT "contributions_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decisions" ADD CONSTRAINT "decisions_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decisions" ADD CONSTRAINT "decisions_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decisions" ADD CONSTRAINT "decisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deposits" ADD CONSTRAINT "deposits_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deposits" ADD CONSTRAINT "deposits_reconciled_by_users_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documentation_feedback" ADD CONSTRAINT "documentation_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documentation_feedback" ADD CONSTRAINT "documentation_feedback_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "donors" ADD CONSTRAINT "donors_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meetings" ADD CONSTRAINT "meetings_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "members" ADD CONSTRAINT "members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monthly_close_items" ADD CONSTRAINT "monthly_close_items_close_id_monthly_closes_id_fk" FOREIGN KEY ("close_id") REFERENCES "public"."monthly_closes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monthly_close_items" ADD CONSTRAINT "monthly_close_items_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monthly_closes" ADD CONSTRAINT "monthly_closes_signed_off_by_users_id_fk" FOREIGN KEY ("signed_off_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_instance_id_checklist_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."checklist_instances"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offering_counts" ADD CONSTRAINT "offering_counts_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offering_counts" ADD CONSTRAINT "offering_counts_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offering_counts" ADD CONSTRAINT "offering_counts_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_created_at_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_instance_steps_instance_idx" ON "checklist_instance_steps" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_instances_status_idx" ON "checklist_instances" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_instances_template_idx" ON "checklist_instances" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "checklist_instances_template_period_idx" ON "checklist_instances" USING btree ("template_id","period_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_template_steps_template_idx" ON "checklist_template_steps" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "committee_members_committee_idx" ON "committee_members" USING btree ("committee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contribution_batches_date_idx" ON "contribution_batches" USING btree ("batch_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contributions_batch_idx" ON "contributions" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contributions_donor_idx" ON "contributions" USING btree ("donor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contributions_date_idx" ON "contributions" USING btree ("contribution_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decisions_committee_idx" ON "decisions" USING btree ("committee_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "documentation_feedback_user_page_revision_idx" ON "documentation_feedback" USING btree ("user_id","page_slug","documentation_revision");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documentation_feedback_status_idx" ON "documentation_feedback" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "donors_last_name_idx" ON "donors" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_committee_idx" ON "meetings" USING btree ("committee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "members_last_first_idx" ON "members" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "members_household_idx" ON "members" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "members_first_name_trgm_idx" ON "members" USING gin ("first_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "members_last_name_trgm_idx" ON "members" USING gin ("last_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "members_full_name_trgm_idx" ON "members" USING gin (("first_name" || ' ' || "last_name") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mfa_recovery_codes_user_idx" ON "mfa_recovery_codes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "monthly_closes_year_month_idx" ON "monthly_closes" USING btree ("year","month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_user_instance_type_idx" ON "notifications" USING btree ("user_id","instance_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_views_viewed_at_idx" ON "page_views" USING btree ("viewed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_views_path_idx" ON "page_views" USING btree ("path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_codes_user_idx" ON "password_reset_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" USING btree ("expire");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_date_idx" ON "transactions" USING btree ("txn_date");
