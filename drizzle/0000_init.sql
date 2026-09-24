CREATE TABLE "action_items" (
	"id" text PRIMARY KEY NOT NULL,
	"source_message_id" text,
	"source_run_id" text,
	"title" text NOT NULL,
	"description" text,
	"due_date" date,
	"priority" text NOT NULL,
	"links" jsonb NOT NULL,
	"status" text NOT NULL,
	"scheduled_date" date,
	"created_at" timestamp (3) with time zone NOT NULL,
	"position" integer NOT NULL,
	"completed_at" timestamp (3) with time zone,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "action_items_status_placement" CHECK (("action_items"."status" = 'pool' and "action_items"."scheduled_date" is null and "action_items"."completed_at" is null)
			or ("action_items"."status" = 'scheduled' and "action_items"."scheduled_date" is not null and "action_items"."completed_at" is null)
			or ("action_items"."status" = 'done' and "action_items"."completed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"run_id" text PRIMARY KEY NOT NULL,
	"source_ref" text NOT NULL,
	"source" text NOT NULL,
	"generated_at" timestamp (3) with time zone NOT NULL,
	"ingested_at" timestamp (3) with time zone NOT NULL,
	"item_count" integer NOT NULL,
	"inserted_count" integer NOT NULL,
	"envelope" jsonb NOT NULL,
	CONSTRAINT "ingest_runs_source_ref_unique" UNIQUE("source_ref")
);
--> statement-breakpoint
CREATE INDEX "action_items_container_idx" ON "action_items" USING btree ("scheduled_date","position");