import {
  pgTable,
  text,
  uuid,
  varchar,
  integer,
  timestamp,
  boolean,
  decimal,
} from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", {}).notNull(),
});

export const equbGroups = pgTable("equb_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Contribution per round
  frequency: text("frequency").notNull(), // 'daily', 'weekly', 'monthly'
  maxMembers: integer("max_members").notNull(),
  adminId: uuid("admin_id").references(() => users.id).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const equbMembers = pgTable("equb_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  groupId: uuid("group_id").references(() => equbGroups.id).notNull(),
  // New Status Field
  status: text("status").$type<"pending" | "approved" | "rejected">().default("pending"),
  hasWon: boolean("has_won").default(false),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const equbWinners = pgTable("equb_winners", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .references(() => equbGroups.id)
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  roundNumber: integer("round_number").notNull(),
  drawDate: timestamp("draw_date").defaultNow(),
});

export const equbPayments = pgTable("equb_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").references(() => equbMembers.id).notNull(),
  groupId: uuid("group_id").references(() => equbGroups.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  roundNumber: integer("round_number").notNull(),
  status: text("status").$type<"pending" | "completed" | "failed">().default("pending"),
  txReference: varchar("tx_reference", { length: 255 }).unique(), // From Payment Gateway
  paidAt: timestamp("paid_at"),
});

export const equbPayouts = pgTable("equb_payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").references(() => equbGroups.id),
  winnerId: uuid("winner_id").references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  status: text("status").default("pending"), // pending, success, failed
  transferRef: text("transfer_ref").unique(),
  createdAt: timestamp("created_at").defaultNow(),
});