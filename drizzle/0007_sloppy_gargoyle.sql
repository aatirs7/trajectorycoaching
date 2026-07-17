CREATE TABLE "coach_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"field" text NOT NULL,
	"field_other" text,
	"role_company" text NOT NULL,
	"years_experience" text NOT NULL,
	"linkedin_url" text NOT NULL,
	"sessions_per_month" text NOT NULL,
	"availability" jsonb NOT NULL,
	"start_timing" text NOT NULL,
	"start_other" text,
	"rate_30" text NOT NULL,
	"rate_45" text,
	"rate_60" text,
	"open_to_suggested" boolean NOT NULL,
	"coaching_types" jsonb NOT NULL,
	"coaching_other" text,
	"ideal_student" text,
	"employer_concerns" text NOT NULL,
	"employer_concern_note" text,
	"employer_visibility" text NOT NULL,
	"why_interested" text NOT NULL,
	"prior_experience" text NOT NULL,
	"questions" text,
	"anything_else" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text
);
--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN "display_employer_generally" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN "general_title" text;--> statement-breakpoint
CREATE INDEX "coach_applications_status_created_idx" ON "coach_applications" USING btree ("status","created_at");