ALTER TABLE "audit_log" ADD COLUMN "outbox_id" uuid;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "outbox_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_outbox_id_unique" UNIQUE("outbox_id");--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_outbox_id_unique" UNIQUE("outbox_id");