import { count, eq, inArray } from "drizzle-orm";
import { validateNewFormContent } from "./content-policy";
import type { DB } from "./db";
import type { ParsedEventDetails } from "./event-time";
import {
	channelAccessAttempts,
	eventChanges,
	feedbackAnswers,
	feedbackForms,
	feedbackInvitations,
	feedbackQuestions,
	feedbackResponses,
	forms,
	legacyFeedback,
	notificationCampaigns,
	notificationDeliveries,
	rsvps,
} from "./schema";

export type Form = typeof forms.$inferSelect;

export const MAX_FORMS_PER_USER = 3;
export const SLUG_RE = /^[a-z0-9-]+$/;
export const SLACK_CHANNEL_RE = /^[A-Z][A-Z0-9]{6,12}$/;

export const RESERVED_SLUGS = new Set([
	"new",
	"auth",
	"api",
	"admin",
	"login",
	"logout",
	"callback",
	"dashboard",
]);

export interface FormInput {
	title: string;
	slug: string;
	description: string | null;
	website: string | null;
	slackChannelId: string | null;
	feedbackEnabled: boolean;
	eventDetails?: ParsedEventDetails;
}

export interface FormSettings {
	isOpen: boolean;
	isPublic: boolean;
	requiresVerification: boolean;
	feedbackEnabled: boolean;
	description: string | null;
	website: string | null;
	slackChannelId: string | null;
	startAt?: Date | null;
	endAt?: Date | null;
	timezone?: string | null;
	eventFormat?: string | null;
	capacity?: number | null;
	attendeeNotes?: string | null;
	locationDisplay?: string | null;
	locationLatitude?: number | null;
	locationLongitude?: number | null;
	locationProvider?: string | null;
	locationPlaceId?: string | null;
	onlineUrl?: string | null;
}

export type CreateFormResult =
	| { ok: true; slug: string }
	| { ok: false; error: string };

export function getFormBySlug(db: DB, slug: string): Form | undefined {
	return db.select().from(forms).where(eq(forms.slug, slug)).get();
}

export function getFormById(db: DB, id: string): Form | undefined {
	return db.select().from(forms).where(eq(forms.id, id)).get();
}

export function countFormsByCreator(db: DB, creatorId: string): number {
	return (
		db
			.select({ value: count() })
			.from(forms)
			.where(eq(forms.creatorId, creatorId))
			.get()?.value ?? 0
	);
}

export async function createForm(
	db: DB,
	creatorId: string,
	input: FormInput,
): Promise<CreateFormResult> {
	const title = input.title.trim();
	const slug = input.slug.toLowerCase().trim();

	if (!title || !slug)
		return { ok: false, error: "Title and URL are required" };
	if (!SLUG_RE.test(slug)) {
		return {
			ok: false,
			error: "URL can only contain lowercase letters, numbers, and hyphens",
		};
	}
	if (RESERVED_SLUGS.has(slug))
		return { ok: false, error: "That URL is reserved" };
	if (input.slackChannelId && !SLACK_CHANNEL_RE.test(input.slackChannelId)) {
		return { ok: false, error: "Invalid Slack channel ID" };
	}
	const contentError = validateNewFormContent(db, [
		title,
		slug,
		input.description,
		input.website,
		input.eventDetails?.attendeeNotes,
		input.eventDetails?.locationDisplay,
		input.eventDetails?.onlineUrl,
	]);
	if (contentError) return { ok: false, error: contentError };
	if (countFormsByCreator(db, creatorId) >= MAX_FORMS_PER_USER) {
		return {
			ok: false,
			error: `You can create up to ${MAX_FORMS_PER_USER} forms`,
		};
	}
	if (getFormBySlug(db, slug)) {
		return { ok: false, error: "That URL is already taken" };
	}

	try {
		const id = crypto.randomUUID();
		db.transaction((tx) => {
			tx.insert(forms)
				.values({
					id,
					slug,
					title,
					description: input.description,
					website: input.website,
					slackChannelId: input.slackChannelId,
					feedbackEnabled: input.feedbackEnabled,
					creatorId,
					...(input.eventDetails ?? {}),
				})
				.run();
			if (input.eventDetails?.startAt) {
				for (const [kind, offset] of [
					["reminder_24h", 24 * 60 * 60_000],
					["reminder_1h", 60 * 60_000],
				] as const) {
					tx.insert(notificationCampaigns)
						.values({
							id: crypto.randomUUID(),
							formId: id,
							creatorId,
							kind,
							audience: "confirmed",
							template:
								"hi {first_name}! reminder that {event_name} starts {event_date} at {event_time} {timezone}. {event_link}",
							status: "draft",
							isOperational: false,
							scheduledAt: new Date(
								input.eventDetails.startAt.getTime() - offset,
							),
						})
						.run();
				}
			}
		});
	} catch (err) {
		// The pre-check above handles the common case; this catches the race where
		// another request inserted the same slug in between.
		if (String(err).includes("UNIQUE constraint failed: forms.slug")) {
			return { ok: false, error: "That URL is already taken" };
		}
		throw err;
	}

	return { ok: true, slug };
}

const AUDITED_FIELDS = [
	"startAt",
	"endAt",
	"timezone",
	"eventFormat",
	"capacity",
	"attendeeNotes",
	"locationDisplay",
	"locationLatitude",
	"locationLongitude",
	"locationProvider",
	"locationPlaceId",
	"onlineUrl",
] as const;

function auditValue(value: unknown) {
	return value instanceof Date ? value.toISOString() : value;
}

export function updateForm(
	db: DB,
	id: string,
	settings: FormSettings,
	actorId?: string,
): void {
	db.transaction((tx) => {
		const before = tx.select().from(forms).where(eq(forms.id, id)).get();
		if (!before) return;
		tx.update(forms)
			.set({ ...settings, updatedAt: new Date() })
			.where(eq(forms.id, id))
			.run();

		if (!actorId) return;
		const beforeChanged: Record<string, unknown> = {};
		const afterChanged: Record<string, unknown> = {};
		for (const field of AUDITED_FIELDS) {
			if (!(field in settings)) continue;
			const previous = before[field];
			const next = settings[field];
			if (auditValue(previous) === auditValue(next)) continue;
			beforeChanged[field] = auditValue(previous);
			afterChanged[field] = auditValue(next);
		}
		if (Object.keys(afterChanged).length) {
			tx.insert(eventChanges)
				.values({
					id: crypto.randomUUID(),
					formId: id,
					actorId,
					kind: "details_updated",
					beforeJson: JSON.stringify(beforeChanged),
					afterJson: JSON.stringify(afterChanged),
				})
				.run();
		}
	});
}

export function deleteForm(db: DB, id: string): void {
	db.transaction((tx) => {
		const rsvpIds = tx
			.select({ id: rsvps.id })
			.from(rsvps)
			.where(eq(rsvps.formId, id))
			.all()
			.map(({ id }) => id);
		const campaignIds = tx
			.select({ id: notificationCampaigns.id })
			.from(notificationCampaigns)
			.where(eq(notificationCampaigns.formId, id))
			.all()
			.map(({ id }) => id);
		const feedbackFormIds = tx
			.select({ id: feedbackForms.id })
			.from(feedbackForms)
			.where(eq(feedbackForms.formId, id))
			.all()
			.map(({ id }) => id);
		const invitationIds = feedbackFormIds.length
			? tx
					.select({ id: feedbackInvitations.id })
					.from(feedbackInvitations)
					.where(inArray(feedbackInvitations.feedbackFormId, feedbackFormIds))
					.all()
					.map(({ id }) => id)
			: [];
		const responseIds = invitationIds.length
			? tx
					.select({ id: feedbackResponses.id })
					.from(feedbackResponses)
					.where(inArray(feedbackResponses.invitationId, invitationIds))
					.all()
					.map(({ id }) => id)
			: [];

		if (responseIds.length) {
			tx.delete(feedbackAnswers)
				.where(inArray(feedbackAnswers.responseId, responseIds))
				.run();
		}
		if (invitationIds.length) {
			tx.delete(feedbackResponses)
				.where(inArray(feedbackResponses.invitationId, invitationIds))
				.run();
		}
		if (feedbackFormIds.length) {
			tx.delete(feedbackInvitations)
				.where(inArray(feedbackInvitations.feedbackFormId, feedbackFormIds))
				.run();
			tx.delete(feedbackQuestions)
				.where(inArray(feedbackQuestions.feedbackFormId, feedbackFormIds))
				.run();
		}
		tx.delete(feedbackForms).where(eq(feedbackForms.formId, id)).run();
		if (campaignIds.length) {
			tx.delete(notificationDeliveries)
				.where(inArray(notificationDeliveries.campaignId, campaignIds))
				.run();
		}
		tx.delete(notificationCampaigns)
			.where(eq(notificationCampaigns.formId, id))
			.run();
		if (rsvpIds.length) {
			tx.delete(channelAccessAttempts)
				.where(inArray(channelAccessAttempts.rsvpId, rsvpIds))
				.run();
		}
		tx.delete(eventChanges).where(eq(eventChanges.formId, id)).run();
		tx.delete(legacyFeedback).where(eq(legacyFeedback.formId, id)).run();
		tx.delete(rsvps).where(eq(rsvps.formId, id)).run();
		tx.delete(forms).where(eq(forms.id, id)).run();
	});
}
