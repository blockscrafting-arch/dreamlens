/**
 * Drizzle ORM Schema
 * Type-safe database schema definitions
 */

import { pgTable, uuid, varchar, text, timestamp, integer, decimal, date, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
// Note: Check constraints and partial unique indexes are handled in migrations
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: varchar('clerk_id', { length: 255 }),
  deviceId: varchar('device_id', { length: 255 }),
  email: varchar('email', { length: 255 }),
  telegramId: varchar('telegram_id', { length: 255 }),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  username: varchar('username', { length: 255 }),
  photoUrl: text('photo_url'),
  languageCode: varchar('language_code', { length: 10 }),
  vkId: varchar('vk_id', { length: 255 }),
  yandexId: varchar('yandex_id', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  clerkIdIdx: index('idx_users_clerk_id').on(table.clerkId),
  deviceIdIdx: index('idx_users_device_id').on(table.deviceId),
  telegramIdIdx: index('idx_users_telegram_id').on(table.telegramId),
  vkIdIdx: index('idx_users_vk_id').on(table.vkId),
  yandexIdIdx: index('idx_users_yandex_id').on(table.yandexId),
  clerkIdUnique: uniqueIndex('users_clerk_id_unique').on(table.clerkId),
  deviceIdUnique: uniqueIndex('users_device_id_unique').on(table.deviceId),
  telegramIdUnique: uniqueIndex('users_telegram_id_unique').on(table.telegramId),
  vkIdUnique: uniqueIndex('users_vk_id_unique').on(table.vkId),
  yandexIdUnique: uniqueIndex('users_yandex_id_unique').on(table.yandexId),
}));

// Subscriptions table
// Note: Check constraints and partial unique indexes are handled in migrations
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  plan: varchar('plan', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  yookassaSubscriptionId: varchar('yookassa_subscription_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_subscriptions_user_id').on(table.userId),
  statusIdx: index('idx_subscriptions_status').on(table.status),
}));

// Generations table
export const generations = pgTable('generations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  imageUrl: text('image_url').notNull(),
  promptUsed: text('prompt_used'),
  trend: varchar('trend', { length: 50 }),
  quality: varchar('quality', { length: 10 }),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_generations_user_id').on(table.userId),
  createdAtIdx: index('idx_generations_created_at').on(table.createdAt),
  statusIdx: index('idx_generations_status').on(table.status),
}));

// Usage logs table
// Note: Check constraints are handled in migrations
export const usageLogs = pgTable('usage_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }), // IPv6 can be up to 45 chars
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_usage_logs_user_id').on(table.userId),
  createdAtIdx: index('idx_usage_logs_created_at').on(table.createdAt),
  actionIdx: index('idx_usage_logs_action').on(table.action),
  ipAddressIdx: index('idx_usage_logs_ip_address').on(table.ipAddress),
}));

// Payments table
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  yookassaPaymentId: varchar('yookassa_payment_id', { length: 255 }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('RUB').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  tokenPackage: varchar('token_package', { length: 50 }),
  tokensAmount: integer('tokens_amount'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_payments_user_id').on(table.userId),
  yookassaIdIdx: index('idx_payments_yookassa_id').on(table.yookassaPaymentId),
  statusIdx: index('idx_payments_status').on(table.status),
  yookassaIdUnique: uniqueIndex('payments_yookassa_payment_id_unique').on(table.yookassaPaymentId),
}));

// User tokens table
export const userTokens = pgTable('user_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  balance: integer('balance').default(0).notNull(),
  lastBonusDate: date('last_bonus_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_user_tokens_user_id').on(table.userId),
  userIdUnique: uniqueIndex('user_tokens_user_id_unique').on(table.userId),
}));

// Token transactions table
// Note: Check constraints and partial indexes are handled in migrations
export const tokenTransactions = pgTable('token_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  amount: integer('amount').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_token_transactions_user_id').on(table.userId),
  createdAtIdx: index('idx_token_transactions_created_at').on(table.createdAt),
  typeIdx: index('idx_token_transactions_type').on(table.type),
}));

// Relations (optional, for easier querying)
export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  generations: many(generations),
  usageLogs: many(usageLogs),
  payments: many(payments),
  tokens: many(userTokens),
  tokenTransactions: many(tokenTransactions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const generationsRelations = relations(generations, ({ one }) => ({
  user: one(users, {
    fields: [generations.userId],
    references: [users.id],
  }),
}));

export const usageLogsRelations = relations(usageLogs, ({ one }) => ({
  user: one(users, {
    fields: [usageLogs.userId],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
}));

export const userTokensRelations = relations(userTokens, ({ one }) => ({
  user: one(users, {
    fields: [userTokens.userId],
    references: [users.id],
  }),
}));

export const tokenTransactionsRelations = relations(tokenTransactions, ({ one }) => ({
  user: one(users, {
    fields: [tokenTransactions.userId],
    references: [users.id],
  }),
}));

