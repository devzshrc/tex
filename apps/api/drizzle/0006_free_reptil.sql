CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
CREATE INDEX "board_title_trgm_idx" ON "board" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "card_title_trgm_idx" ON "card" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "card_description_trgm_idx" ON "card" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "user_name_trgm_idx" ON "user" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "user_email_trgm_idx" ON "user" USING gin ("email" gin_trgm_ops);