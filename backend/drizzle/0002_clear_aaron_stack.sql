ALTER TABLE "commentary" ADD COLUMN "minutes" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "provider_match_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "matches_provider_provider_match_id_uq" ON "matches" USING btree ("provider","provider_match_id");--> statement-breakpoint
ALTER TABLE "commentary" DROP COLUMN "minute";