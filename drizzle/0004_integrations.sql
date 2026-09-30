CREATE TABLE "calendar_events" (
	"connection_id" text NOT NULL,
	"external_id" text NOT NULL,
	"calendar_id" text NOT NULL,
	"calendar_name" text NOT NULL,
	"title" text NOT NULL,
	"start" timestamp (3) with time zone NOT NULL,
	"end" timestamp (3) with time zone NOT NULL,
	"all_day" boolean NOT NULL,
	"busy" boolean NOT NULL,
	"url" text,
	"read_only" boolean NOT NULL,
	"synced_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "calendar_events_connection_id_external_id_pk" PRIMARY KEY("connection_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" text PRIMARY KEY NOT NULL,
	"integration_id" text NOT NULL,
	"account_label" text NOT NULL,
	"status" text NOT NULL,
	"credentials" text NOT NULL,
	"config" jsonb NOT NULL,
	"last_synced_at" timestamp (3) with time zone,
	"last_attempt_at" timestamp (3) with time zone,
	"last_error" text,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"started_at" timestamp (3) with time zone NOT NULL,
	"finished_at" timestamp (3) with time zone NOT NULL,
	"ok" boolean NOT NULL,
	"counts" jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_events_range_idx" ON "calendar_events" USING btree ("start","end");--> statement-breakpoint
CREATE INDEX "sync_runs_connection_idx" ON "sync_runs" USING btree ("connection_id","started_at");