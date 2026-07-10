DROP INDEX "documentation_feedback_user_page_revision_idx";--> statement-breakpoint
ALTER TABLE "documentation_feedback" ADD COLUMN "section_id" varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "documentation_feedback" ADD COLUMN "section_title" varchar(300);--> statement-breakpoint
CREATE UNIQUE INDEX "documentation_feedback_user_page_revision_section_idx" ON "documentation_feedback" USING btree ("user_id","page_slug","documentation_revision","section_id");