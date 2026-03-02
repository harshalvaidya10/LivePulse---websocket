ALTER TABLE "commentary" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "commentary" ADD COLUMN "provider_event_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "commentary_provider_event_key_uq" ON "commentary" USING btree ("provider","provider_event_key");