CREATE TABLE "planner_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
