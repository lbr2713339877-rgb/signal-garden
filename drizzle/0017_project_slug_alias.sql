CREATE TABLE "project_slug_alias" (
  "slug" text PRIMARY KEY NOT NULL,
  "project_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "project_slug_alias" ADD CONSTRAINT "project_slug_alias_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
