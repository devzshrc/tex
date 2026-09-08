CREATE TYPE "public"."notification_type" AS ENUM('ASSIGNED', 'MENTIONED', 'COMMENTED', 'VOTED', 'DUE_SOON', 'INVITED');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"meta" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"card_id" uuid,
	"board_id" uuid,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"board_id" uuid,
	"organization_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb,
	"actor_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"claimed_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_run_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "card" DROP CONSTRAINT "card_cover_attachment_id_attachment_id_fk";
--> statement-breakpoint
DROP INDEX "card_list_order_idx";--> statement-breakpoint
DROP INDEX "checklist_card_order_idx";--> statement-breakpoint
DROP INDEX "checklist_item_list_order_idx";--> statement-breakpoint
DROP INDEX "list_board_order_idx";--> statement-breakpoint
ALTER TABLE "card" ALTER COLUMN "order" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist" ALTER COLUMN "order" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_item" ALTER COLUMN "order" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_field_def" ALTER COLUMN "order" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "list" ALTER COLUMN "order" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "rank" text DEFAULT '05000001.5' NOT NULL;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "last_reminder_at" timestamp;--> statement-breakpoint
ALTER TABLE "checklist" ADD COLUMN "rank" text DEFAULT '05000001.5' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_item" ADD COLUMN "rank" text DEFAULT '05000001.5' NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_field_def" ADD COLUMN "rank" text DEFAULT '05000001.5' NOT NULL;--> statement-breakpoint
ALTER TABLE "list" ADD COLUMN "rank" text DEFAULT '05000001.5' NOT NULL;--> statement-breakpoint
ALTER TABLE "list" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_org_created_idx" ON "audit_log" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_user_created_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_user_read_idx" ON "notification" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "outbox" USING btree ("processed_at","next_run_at");--> statement-breakpoint
CREATE INDEX "card_list_rank_idx" ON "card" USING btree ("list_id","rank");--> statement-breakpoint
CREATE INDEX "checklist_card_rank_idx" ON "checklist" USING btree ("card_id","rank");--> statement-breakpoint
CREATE INDEX "checklist_item_rank_idx" ON "checklist_item" USING btree ("checklist_id","rank");--> statement-breakpoint
CREATE INDEX "list_board_rank_idx" ON "list" USING btree ("board_id","rank");