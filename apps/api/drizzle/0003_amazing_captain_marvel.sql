CREATE TYPE "public"."custom_field_type" AS ENUM('TEXT', 'NUMBER', 'DATE', 'SELECT');--> statement-breakpoint
CREATE TABLE "attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"card_id" uuid NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attachment_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "card_vote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"order" double precision NOT NULL,
	"card_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"complete" boolean DEFAULT false NOT NULL,
	"order" double precision NOT NULL,
	"checklist_id" uuid NOT NULL,
	"assignee_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_field_def" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "custom_field_type" NOT NULL,
	"options" jsonb,
	"order" double precision NOT NULL,
	"board_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_field_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"value_text" text,
	"value_number" double precision,
	"value_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "cover_color" text;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "cover_attachment_id" uuid;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "story_points" integer;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "is_template" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_vote" ADD CONSTRAINT "card_vote_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_vote" ADD CONSTRAINT "card_vote_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist" ADD CONSTRAINT "checklist_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_checklist_id_checklist_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_assignee_user_id_user_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_def" ADD CONSTRAINT "custom_field_def_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_value" ADD CONSTRAINT "custom_field_value_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_value" ADD CONSTRAINT "custom_field_value_field_id_custom_field_def_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."custom_field_def"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachment_card_idx" ON "attachment" USING btree ("card_id");--> statement-breakpoint
CREATE UNIQUE INDEX "card_vote_unique" ON "card_vote" USING btree ("card_id","user_id");--> statement-breakpoint
CREATE INDEX "checklist_card_order_idx" ON "checklist" USING btree ("card_id","order");--> statement-breakpoint
CREATE INDEX "checklist_item_list_order_idx" ON "checklist_item" USING btree ("checklist_id","order");--> statement-breakpoint
CREATE INDEX "custom_field_def_board_idx" ON "custom_field_def" USING btree ("board_id");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_value_unique" ON "custom_field_value" USING btree ("card_id","field_id");--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_cover_attachment_id_attachment_id_fk" FOREIGN KEY ("cover_attachment_id") REFERENCES "public"."attachment"("id") ON DELETE set null ON UPDATE no action;