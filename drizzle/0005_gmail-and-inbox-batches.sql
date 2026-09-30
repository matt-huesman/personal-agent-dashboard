CREATE TABLE "email_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"message_count" integer NOT NULL,
	"drive_file_id" text,
	"published_at" timestamp (3) with time zone,
	"consumed_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"connection_id" text NOT NULL,
	"external_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"account" text NOT NULL,
	"from" text NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"received_at" timestamp (3) with time zone NOT NULL,
	"labels" jsonb NOT NULL,
	"snippet" text NOT NULL,
	"body" text NOT NULL,
	"url" text NOT NULL,
	"batch_id" text,
	"synced_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "email_messages_connection_id_external_id_pk" PRIMARY KEY("connection_id","external_id")
);
--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "cursor" jsonb;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_batch_id_email_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."email_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_messages_batch_idx" ON "email_messages" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "email_messages_received_idx" ON "email_messages" USING btree ("received_at");