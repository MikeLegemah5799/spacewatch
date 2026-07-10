ALTER TABLE "launches" ADD COLUMN "spacex_api_id" text;--> statement-breakpoint
CREATE INDEX "launches_spacex_api_id_idx" ON "launches" USING btree ("spacex_api_id");