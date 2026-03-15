import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  hackclubId: text('hackclub_id').unique().notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  avatarUrl: text('avatar_url'),
  slackId: text('slack_id'),
  isAllowed: integer('is_allowed', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const forms = sqliteTable('forms', {
  id: text('id').primaryKey(),
  slug: text('slug').unique().notNull(),
  title: text('title').notNull(),
  description: text('description'),
  creatorId: text('creator_id').notNull().references(() => users.id),
  isOpen: integer('is_open', { mode: 'boolean' }).notNull().default(true),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
  feedbackEnabled: integer('feedback_enabled', { mode: 'boolean' }).notNull().default(false),
  slackChannelId: text('slack_channel_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const rsvps = sqliteTable('rsvps', {
  id: text('id').primaryKey(),
  formId: text('form_id').notNull().references(() => forms.id),
  userId: text('user_id').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex('rsvp_form_user').on(table.formId, table.userId),
]);

export const feedback = sqliteTable('feedback', {
  id: text('id').primaryKey(),
  formId: text('form_id').notNull().references(() => forms.id),
  userId: text('user_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex('feedback_form_user').on(table.formId, table.userId),
]);
