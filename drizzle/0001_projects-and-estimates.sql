CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_items" ADD COLUMN "estimate_minutes" integer;--> statement-breakpoint
ALTER TABLE "action_items" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;