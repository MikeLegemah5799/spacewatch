CREATE TABLE "launch_agencies" (
	"launch_id" text NOT NULL,
	"agency_id" text NOT NULL,
	CONSTRAINT "launch_agencies_launch_id_agency_id_pk" PRIMARY KEY("launch_id","agency_id")
);
--> statement-breakpoint
ALTER TABLE "launch_agencies" ADD CONSTRAINT "launch_agencies_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launch_agencies" ADD CONSTRAINT "launch_agencies_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "launch_agencies_agency_idx" ON "launch_agencies" USING btree ("agency_id");