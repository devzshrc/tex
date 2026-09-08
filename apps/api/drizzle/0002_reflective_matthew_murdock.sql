CREATE TABLE "card_label" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "label" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"color" text NOT NULL,
	"board_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "due_at" timestamp;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "due_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "card_label" ADD CONSTRAINT "card_label_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_label" ADD CONSTRAINT "card_label_label_id_label_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."label"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label" ADD CONSTRAINT "label_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "card_label_unique" ON "card_label" USING btree ("card_id","label_id");--> statement-breakpoint
CREATE INDEX "card_label_card_idx" ON "card_label" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "label_board_idx" ON "label" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "card_due_idx" ON "card" USING btree ("due_at");