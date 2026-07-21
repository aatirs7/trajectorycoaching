CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spent_on" date NOT NULL,
	"description" text NOT NULL,
	"vendor" text,
	"amount_cents" integer NOT NULL,
	"category" text NOT NULL,
	"paid_by" text NOT NULL,
	"reimbursed_at" timestamp with time zone,
	"notes" text,
	"receipt_url" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_nonzero" CHECK ("expenses"."amount_cents" <> 0)
);
--> statement-breakpoint
CREATE INDEX "expenses_spent_on_idx" ON "expenses" USING btree ("spent_on");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category");