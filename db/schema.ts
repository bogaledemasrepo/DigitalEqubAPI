import { pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";

// 1. Define the Schema
export const users = pgTable("users", {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", {}).notNull(),
});
