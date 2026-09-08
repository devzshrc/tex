import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't load .env on its own; mirror src/config/env.ts.
dotenv.config();

export default defineConfig({
  schema: "./src/db/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://auth:auth@localhost:5433/authdb",
  },
});
