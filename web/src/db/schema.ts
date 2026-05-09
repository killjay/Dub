import { pgTable, serial, text, timestamp, integer, boolean, varchar, uuid, jsonb, index } from "drizzle-orm/pg-core";

export const waitlist = pgTable(
  "waitlist",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    channelUrl: text("channel_url").notNull(),
    referrer: text("referrer"),
    utm: jsonb("utm").$type<Record<string, string>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    createdAtIdx: index("waitlist_created_at_idx").on(t.createdAt),
  })
);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  // Nullable: Google-only users have no password.
  passwordHash: varchar("password_hash", { length: 120 }),
  // Nullable: email/password users have no googleId until they link.
  googleId: varchar("google_id", { length: 64 }).unique(),
  plan: varchar("plan", { length: 32 }).default("free").notNull(),
  minutesUsedThisMonth: integer("minutes_used_this_month").default(0).notNull(),
  minutesQuota: integer("minutes_quota").default(2).notNull(),
  razorpayCustomerId: varchar("razorpay_customer_id", { length: 64 }),
  razorpaySubscriptionId: varchar("razorpay_subscription_id", { length: 64 }),
  whatsappNumber: varchar("whatsapp_number", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id).notNull(),
    sourceR2Key: text("source_r2_key").notNull(),
    sourceLanguage: varchar("source_language", { length: 8 }).default("hi").notNull(),
    targetLanguages: jsonb("target_languages").$type<string[]>().notNull(),
    voicePreset: varchar("voice_preset", { length: 32 }).default("warm-female").notNull(),
    durationSeconds: integer("duration_seconds"),
    status: varchar("status", { length: 16 }).default("queued").notNull(),
    errorMessage: text("error_message"),
    bullJobId: varchar("bull_job_id", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    userIdx: index("jobs_user_idx").on(t.userId),
    statusIdx: index("jobs_status_idx").on(t.status),
  })
);

export const jobOutputs = pgTable("job_outputs", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
  language: varchar("language", { length: 8 }).notNull(),
  videoR2Key: text("video_r2_key").notNull(),
  audioR2Key: text("audio_r2_key").notNull(),
  watermarked: boolean("watermarked").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
