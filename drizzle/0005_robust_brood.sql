CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_prefix" text NOT NULL,
	"key_salt" text NOT NULL,
	"key_hash" text NOT NULL,
	"label" text NOT NULL,
	"access_level_id" uuid NOT NULL,
	"allowed_collection_ids" jsonb,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_prefix_unique" UNIQUE("key_prefix")
);
--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "api_permissions" jsonb;--> statement-breakpoint
UPDATE "collections" SET "api_permissions" = '{"read":true,"create":true,"update":true,"delete":true}'::jsonb WHERE "api_permissions" IS NULL;--> statement-breakpoint
ALTER TABLE "collections" ALTER COLUMN "api_permissions" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ALTER COLUMN "api_permissions" SET DEFAULT '{"read":true,"create":true,"update":true,"delete":true}'::jsonb;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_access_level_id_access_levels_id_fk" FOREIGN KEY ("access_level_id") REFERENCES "public"."access_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_access_level_id_idx" ON "api_keys" USING btree ("access_level_id");