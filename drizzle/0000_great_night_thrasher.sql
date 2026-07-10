CREATE TYPE "public"."launch_status" AS ENUM('go', 'tbd', 'hold', 'in_flight', 'success', 'failure');--> statement-breakpoint
CREATE TYPE "public"."net_precision" AS ENUM('second', 'hour', 'day', 'month', 'quarter', 'year');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('ll2', 'spacex', 'nasa');--> statement-breakpoint
CREATE TABLE "agencies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"abbrev" text,
	"type" text,
	"country_code" text,
	"logo_url" text,
	"description" text,
	"external_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "launches" (
	"id" text PRIMARY KEY NOT NULL,
	"source" "source" NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"agency_id" text,
	"provider_name" text NOT NULL,
	"rocket" text NOT NULL,
	"net" timestamp with time zone,
	"net_precision" "net_precision" DEFAULT 'second' NOT NULL,
	"window_start" timestamp with time zone,
	"window_end" timestamp with time zone,
	"status" "launch_status" NOT NULL,
	"is_upcoming" boolean DEFAULT true NOT NULL,
	"pad_name" text,
	"pad_location" text,
	"pad_latitude" text,
	"pad_longitude" text,
	"image_url" text,
	"webcast_url" text,
	"mission_description" text,
	"orbit" text,
	"enrichment" jsonb,
	"search_text" text,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"source" "source" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"cursor" text,
	"records_upserted" integer DEFAULT 0 NOT NULL,
	"ok" boolean DEFAULT false NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
	"user_id" text NOT NULL,
	"launch_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_user_id_launch_id_pk" PRIMARY KEY("user_id","launch_id")
);
--> statement-breakpoint
ALTER TABLE "launches" ADD CONSTRAINT "launches_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agencies_external_id_idx" ON "agencies" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "launches_source_external_idx" ON "launches" USING btree ("source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "launches_slug_idx" ON "launches" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "launches_upcoming_net_idx" ON "launches" USING btree ("is_upcoming","net");--> statement-breakpoint
CREATE INDEX "launches_net_desc_idx" ON "launches" USING btree ("net" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "launches_agency_net_idx" ON "launches" USING btree ("agency_id","net");--> statement-breakpoint
CREATE INDEX "launches_status_idx" ON "launches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "launches_search_idx" ON "launches" USING gin (to_tsvector('english', coalesce("search_text", '')));--> statement-breakpoint
CREATE INDEX "sync_runs_kind_started_idx" ON "sync_runs" USING btree ("kind","started_at");--> statement-breakpoint
CREATE INDEX "watchlist_user_idx" ON "watchlist" USING btree ("user_id");