ALTER TABLE "collections" ADD COLUMN "table_suffix" text;--> statement-breakpoint
UPDATE "collections" SET "table_suffix" = "slug" WHERE "table_suffix" IS NULL;--> statement-breakpoint
ALTER TABLE "collections" ALTER COLUMN "table_suffix" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_table_suffix_unique" UNIQUE("table_suffix");
