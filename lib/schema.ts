import { sql } from "drizzle-orm";
import {
	index,
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
	integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date());
const updatedAt = () =>
	integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`0`)
		.$defaultFn(() => new Date());

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	hackclubId: text("hackclub_id").unique().notNull(),
	name: text("name").notNull(),
	email: text("email").notNull(),
	avatarUrl: text("avatar_url"),
	slackId: text("slack_id"),
	isAllowed: integer("is_allowed", { mode: "boolean" })
		.notNull()
		.default(false),
	createdAt: createdAt(),
});

export const forms = sqliteTable(
	"forms",
	{
		id: text("id").primaryKey(),
		slug: text("slug").unique().notNull(),
		title: text("title").notNull(),
		description: text("description"),
		creatorId: text("creator_id")
			.notNull()
			.references(() => users.id),
		isOpen: integer("is_open", { mode: "boolean" }).notNull().default(true),
		isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
		requiresVerification: integer("requires_verification", { mode: "boolean" })
			.notNull()
			.default(true),
		feedbackEnabled: integer("feedback_enabled", { mode: "boolean" })
			.notNull()
			.default(false),
		slackChannelId: text("slack_channel_id"),
		website: text("website"),
		startAt: integer("start_at", { mode: "timestamp" }),
		endAt: integer("end_at", { mode: "timestamp" }),
		timezone: text("timezone"),
		eventFormat: text("event_format"),
		capacity: integer("capacity"),
		attendeeNotes: text("attendee_notes"),
		locationDisplay: text("location_display"),
		locationLatitude: real("location_latitude"),
		locationLongitude: real("location_longitude"),
		locationProvider: text("location_provider"),
		locationPlaceId: text("location_place_id"),
		onlineUrl: text("online_url"),
		cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [index("forms_start_at_idx").on(table.startAt)],
);

export const rsvps = sqliteTable(
	"rsvps",
	{
		id: text("id").primaryKey(),
		formId: text("form_id")
			.notNull()
			.references(() => forms.id),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		status: text("status").notNull().default("confirmed"),
		cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
		checkedInAt: integer("checked_in_at", { mode: "timestamp" }),
		checkedInBy: text("checked_in_by").references(() => users.id),
		notificationsEnabled: integer("notifications_enabled", { mode: "boolean" })
			.notNull()
			.default(true),
		verificationStatus: text("verification_status"),
		verificationCheckedAt: integer("verification_checked_at", {
			mode: "timestamp",
		}),
		channelAccessStatus: text("channel_access_status")
			.notNull()
			.default("not_requested"),
		channelAccessUpdatedAt: integer("channel_access_updated_at", {
			mode: "timestamp",
		}),
		channelAccessError: text("channel_access_error"),
		createdAt: createdAt(),
	},
	(table) => [
		uniqueIndex("rsvp_form_user").on(table.formId, table.userId),
		index("rsvp_form_status_created_idx").on(
			table.formId,
			table.status,
			table.createdAt,
		),
	],
);

export const eventChanges = sqliteTable(
	"event_changes",
	{
		id: text("id").primaryKey(),
		formId: text("form_id")
			.notNull()
			.references(() => forms.id),
		actorId: text("actor_id")
			.notNull()
			.references(() => users.id),
		kind: text("kind").notNull(),
		beforeJson: text("before_json").notNull(),
		afterJson: text("after_json").notNull(),
		createdAt: createdAt(),
	},
	(table) => [
		index("event_changes_form_idx").on(table.formId, table.createdAt),
	],
);

export const channelAccessAttempts = sqliteTable(
	"channel_access_attempts",
	{
		id: text("id").primaryKey(),
		rsvpId: text("rsvp_id")
			.notNull()
			.references(() => rsvps.id),
		kind: text("kind").notNull(),
		status: text("status").notNull().default("queued"),
		attempts: integer("attempts").notNull().default(0),
		nextAttemptAt: integer("next_attempt_at", { mode: "timestamp" }).notNull(),
		leaseOwner: text("lease_owner"),
		leasedAt: integer("leased_at", { mode: "timestamp" }),
		verificationStatus: text("verification_status"),
		verificationCheckedAt: integer("verification_checked_at", {
			mode: "timestamp",
		}),
		slackError: text("slack_error"),
		completedAt: integer("completed_at", { mode: "timestamp" }),
		createdAt: createdAt(),
	},
	(table) => [
		index("channel_access_due_idx").on(table.status, table.nextAttemptAt),
		uniqueIndex("channel_access_active_idx")
			.on(table.rsvpId, table.kind)
			.where(sql`${table.status} in ('queued', 'leased', 'retrying')`),
	],
);

export const notificationCampaigns = sqliteTable(
	"notification_campaigns",
	{
		id: text("id").primaryKey(),
		formId: text("form_id")
			.notNull()
			.references(() => forms.id),
		kind: text("kind").notNull(),
		audience: text("audience").notNull(),
		template: text("template").notNull(),
		isOperational: integer("is_operational", { mode: "boolean" })
			.notNull()
			.default(false),
		status: text("status").notNull().default("draft"),
		scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
		creatorId: text("creator_id")
			.notNull()
			.references(() => users.id),
		sentAt: integer("sent_at", { mode: "timestamp" }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		index("notification_campaign_form_idx").on(table.formId, table.createdAt),
	],
);

export const notificationDeliveries = sqliteTable(
	"notification_deliveries",
	{
		id: text("id").primaryKey(),
		campaignId: text("campaign_id")
			.notNull()
			.references(() => notificationCampaigns.id),
		rsvpId: text("rsvp_id")
			.notNull()
			.references(() => rsvps.id),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		slackIdSnapshot: text("slack_id_snapshot"),
		renderedText: text("rendered_text").notNull(),
		status: text("status").notNull().default("queued"),
		attempts: integer("attempts").notNull().default(0),
		nextAttemptAt: integer("next_attempt_at", { mode: "timestamp" }).notNull(),
		leaseOwner: text("lease_owner"),
		leasedAt: integer("leased_at", { mode: "timestamp" }),
		slackError: text("slack_error"),
		sentAt: integer("sent_at", { mode: "timestamp" }),
		completedAt: integer("completed_at", { mode: "timestamp" }),
		createdAt: createdAt(),
	},
	(table) => [
		uniqueIndex("notification_delivery_campaign_rsvp").on(
			table.campaignId,
			table.rsvpId,
		),
		index("notification_delivery_due_idx").on(
			table.status,
			table.nextAttemptAt,
		),
	],
);

export const legacyFeedback = sqliteTable(
	"feedback",
	{
		id: text("id").primaryKey(),
		formId: text("form_id")
			.notNull()
			.references(() => forms.id),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		content: text("content").notNull(),
		createdAt: createdAt(),
	},
	(table) => [uniqueIndex("feedback_form_user").on(table.formId, table.userId)],
);

/** @deprecated Use legacyFeedback while the Phase 1 reader is being removed. */
export const feedback = legacyFeedback;

export const feedbackForms = sqliteTable(
	"feedback_forms",
	{
		id: text("id").primaryKey(),
		formId: text("form_id")
			.notNull()
			.references(() => forms.id),
		title: text("title").notNull(),
		dmTemplate: text("dm_template").notNull(),
		status: text("status").notNull().default("draft"),
		closedAt: integer("closed_at", { mode: "timestamp" }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [uniqueIndex("feedback_forms_form_unique").on(table.formId)],
);

export const feedbackQuestions = sqliteTable(
	"feedback_questions",
	{
		id: text("id").primaryKey(),
		feedbackFormId: text("feedback_form_id")
			.notNull()
			.references(() => feedbackForms.id),
		kind: text("kind").notNull(),
		prompt: text("prompt").notNull(),
		required: integer("required", { mode: "boolean" }).notNull().default(false),
		position: integer("position").notNull(),
		optionsJson: text("options_json"),
		createdAt: createdAt(),
	},
	(table) => [
		uniqueIndex("feedback_question_position").on(
			table.feedbackFormId,
			table.position,
		),
	],
);

export const feedbackInvitations = sqliteTable(
	"feedback_invitations",
	{
		id: text("id").primaryKey(),
		feedbackFormId: text("feedback_form_id")
			.notNull()
			.references(() => feedbackForms.id),
		rsvpId: text("rsvp_id")
			.notNull()
			.references(() => rsvps.id),
		sentAt: integer("sent_at", { mode: "timestamp" }),
		openedAt: integer("opened_at", { mode: "timestamp" }),
		createdAt: createdAt(),
	},
	(table) => [
		uniqueIndex("feedback_invitation_form_rsvp").on(
			table.feedbackFormId,
			table.rsvpId,
		),
	],
);

export const feedbackResponses = sqliteTable("feedback_responses", {
	id: text("id").primaryKey(),
	invitationId: text("invitation_id")
		.notNull()
		.unique()
		.references(() => feedbackInvitations.id),
	submittedAt: integer("submitted_at", { mode: "timestamp" }).notNull(),
	updatedAt: updatedAt(),
});

export const feedbackAnswers = sqliteTable(
	"feedback_answers",
	{
		id: text("id").primaryKey(),
		responseId: text("response_id")
			.notNull()
			.references(() => feedbackResponses.id),
		questionId: text("question_id")
			.notNull()
			.references(() => feedbackQuestions.id),
		valueJson: text("value_json").notNull(),
	},
	(table) => [
		uniqueIndex("feedback_answer_response_question").on(
			table.responseId,
			table.questionId,
		),
	],
);
