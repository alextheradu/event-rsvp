import { and, asc, eq, gt, inArray, lte, or } from "drizzle-orm";
import type { DB } from "./db";
import { getPublicOrigin } from "./public-origin";
import {
	feedbackInvitations,
	forms,
	notificationCampaigns,
	notificationDeliveries,
	rsvps,
	users,
} from "./schema";
import type { SlackPort, SlackResult } from "./slack";
import {
	eventTemplateValues,
	renderTemplate,
	validateTemplate,
} from "./templates";

export type NotificationAudience =
	| "confirmed"
	| "waitlisted"
	| "checked_in"
	| "single";

export interface CampaignInput {
	formId: string;
	creatorId: string;
	kind: string;
	audience: NotificationAudience;
	template: string;
	isOperational: boolean;
	scheduledAt: Date;
	rsvpIds?: string[];
	feedbackLinks?: ReadonlyMap<string, string>;
}

export function createCampaign(db: DB, input: CampaignInput) {
	validateTemplate(input.template, {
		feedback: input.kind === "feedback_request",
	});
	return db.transaction((tx) => {
		const form = tx
			.select()
			.from(forms)
			.where(eq(forms.id, input.formId))
			.get();
		const host = form
			? tx.select().from(users).where(eq(users.id, form.creatorId)).get()
			: null;
		if (!form || !host) throw new Error("Event not found");

		const conditions = [eq(rsvps.formId, input.formId)];
		if (input.audience === "confirmed")
			conditions.push(eq(rsvps.status, "confirmed"));
		if (input.audience === "waitlisted")
			conditions.push(eq(rsvps.status, "waitlisted"));
		if (input.audience === "checked_in")
			conditions.push(eq(rsvps.status, "confirmed"));
		if (input.rsvpIds?.length)
			conditions.push(inArray(rsvps.id, input.rsvpIds));

		let recipients = tx
			.select({ rsvp: rsvps, user: users })
			.from(rsvps)
			.innerJoin(users, eq(rsvps.userId, users.id))
			.where(and(...conditions))
			.all();
		if (input.audience === "checked_in") {
			recipients = recipients.filter(({ rsvp }) => rsvp.checkedInAt !== null);
		}
		if (!input.isOperational) {
			recipients = recipients.filter(({ rsvp }) => rsvp.notificationsEnabled);
		}
		const campaignId = crypto.randomUUID();
		tx.insert(notificationCampaigns)
			.values({
				id: campaignId,
				formId: input.formId,
				creatorId: input.creatorId,
				kind: input.kind,
				audience: input.audience,
				template: input.template,
				isOperational: input.isOperational,
				status: "scheduled",
				scheduledAt: input.scheduledAt,
			})
			.run();
		for (const { rsvp, user } of recipients) {
			const feedbackLink = input.feedbackLinks?.get(rsvp.id);
			const text = renderTemplate(
				input.template,
				eventTemplateValues(
					form,
					host.name,
					user.name,
					`${getPublicOrigin()}/${form.slug}`,
					feedbackLink,
				),
				{ feedback: input.kind === "feedback_request" },
			);
			tx.insert(notificationDeliveries)
				.values({
					id: crypto.randomUUID(),
					campaignId,
					rsvpId: rsvp.id,
					userId: user.id,
					slackIdSnapshot: user.slackId,
					renderedText: text,
					status: user.slackId ? "queued" : "skipped",
					nextAttemptAt: input.scheduledAt,
					completedAt: user.slackId ? null : new Date(),
					slackError: user.slackId ? null : "no_slack_identity",
				})
				.run();
		}
		if (recipients.length === 0) {
			tx.update(notificationCampaigns)
				.set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
				.where(eq(notificationCampaigns.id, campaignId))
				.run();
		}
		return { campaignId, recipientCount: recipients.length };
	});
}

export function createSystemCampaign(
	db: DB,
	formId: string,
	rsvpId: string,
	kind: string,
	template: string,
) {
	const form = db.select().from(forms).where(eq(forms.id, formId)).get();
	if (!form) return null;
	return createCampaign(db, {
		formId,
		creatorId: form.creatorId,
		kind,
		audience: "single",
		template,
		isOperational: true,
		scheduledAt: new Date(),
		rsvpIds: [rsvpId],
	});
}

export function addRsvpToScheduledCampaigns(db: DB, rsvpId: string) {
	const row = db
		.select({ rsvp: rsvps, user: users, form: forms })
		.from(rsvps)
		.innerJoin(users, eq(rsvps.userId, users.id))
		.innerJoin(forms, eq(rsvps.formId, forms.id))
		.where(eq(rsvps.id, rsvpId))
		.get();
	if (!row || row.rsvp.status === "cancelled") return 0;
	const host = db
		.select()
		.from(users)
		.where(eq(users.id, row.form.creatorId))
		.get();
	if (!host) return 0;
	const campaigns = db
		.select()
		.from(notificationCampaigns)
		.where(
			and(
				eq(notificationCampaigns.formId, row.form.id),
				eq(notificationCampaigns.status, "scheduled"),
				gt(notificationCampaigns.scheduledAt, new Date()),
			),
		)
		.all()
		.filter(
			(campaign) =>
				(campaign.audience === row.rsvp.status ||
					(campaign.audience === "checked_in" &&
						Boolean(row.rsvp.checkedInAt))) &&
				(campaign.isOperational || row.rsvp.notificationsEnabled),
		);
	let created = 0;
	for (const campaign of campaigns) {
		const existing = db
			.select()
			.from(notificationDeliveries)
			.where(
				and(
					eq(notificationDeliveries.campaignId, campaign.id),
					eq(notificationDeliveries.rsvpId, rsvpId),
				),
			)
			.get();
		if (existing) continue;
		const text = renderTemplate(
			campaign.template,
			eventTemplateValues(
				row.form,
				host.name,
				row.user.name,
				`${getPublicOrigin()}/${row.form.slug}`,
			),
		);
		db.insert(notificationDeliveries)
			.values({
				id: crypto.randomUUID(),
				campaignId: campaign.id,
				rsvpId,
				userId: row.user.id,
				slackIdSnapshot: row.user.slackId,
				renderedText: text,
				status: row.user.slackId ? "queued" : "skipped",
				nextAttemptAt: campaign.scheduledAt as Date,
				completedAt: row.user.slackId ? null : new Date(),
				slackError: row.user.slackId ? null : "no_slack_identity",
			})
			.run();
		created += 1;
	}
	return created;
}

const BACKOFF = [60, 300, 1800, 7200, 43200];

async function send(
	slack: SlackPort,
	slackId: string,
	text: string,
): Promise<SlackResult> {
	if (slack.dmDetailed) {
		const result = await slack.dmDetailed(slackId, text);
		return result.ok ? { ok: true, value: undefined } : result;
	}
	return slack
		.dm(slackId, text)
		.then((ok) =>
			ok
				? { ok: true, value: undefined }
				: { ok: false, error: "slack_error", retryable: true },
		);
}

export async function processNextNotification(
	db: DB,
	slack: SlackPort,
	workerId: string,
	now = new Date(),
) {
	const delivery = db.transaction((tx) => {
		const stale = new Date(now.getTime() - 5 * 60_000);
		const due = tx
			.select()
			.from(notificationDeliveries)
			.where(
				and(
					lte(notificationDeliveries.nextAttemptAt, now),
					or(
						eq(notificationDeliveries.status, "queued"),
						eq(notificationDeliveries.status, "retrying"),
						and(
							eq(notificationDeliveries.status, "leased"),
							lte(notificationDeliveries.leasedAt, stale),
						),
					),
				),
			)
			.orderBy(asc(notificationDeliveries.nextAttemptAt))
			.get();
		if (!due) return null;
		tx.update(notificationDeliveries)
			.set({
				status: "leased",
				leaseOwner: workerId,
				leasedAt: now,
				attempts: due.attempts + 1,
			})
			.where(eq(notificationDeliveries.id, due.id))
			.run();
		return { ...due, attempts: due.attempts + 1 };
	});
	if (!delivery) return false;
	if (!delivery.slackIdSnapshot) {
		db.update(notificationDeliveries)
			.set({
				status: "skipped",
				slackError: "no_slack_identity",
				completedAt: new Date(),
			})
			.where(eq(notificationDeliveries.id, delivery.id))
			.run();
		return true;
	}
	const campaign = db
		.select()
		.from(notificationCampaigns)
		.where(eq(notificationCampaigns.id, delivery.campaignId))
		.get();
	if (!campaign || campaign.status === "cancelled") {
		db.update(notificationDeliveries)
			.set({ status: "skipped", completedAt: new Date() })
			.where(eq(notificationDeliveries.id, delivery.id))
			.run();
		return true;
	}

	const result = await send(
		slack,
		delivery.slackIdSnapshot,
		delivery.renderedText,
	);
	if (result.ok) {
		db.update(notificationDeliveries)
			.set({
				status: "sent",
				sentAt: new Date(),
				completedAt: new Date(),
				leaseOwner: null,
				leasedAt: null,
			})
			.where(eq(notificationDeliveries.id, delivery.id))
			.run();
		const remaining = db
			.select()
			.from(notificationDeliveries)
			.where(
				and(
					eq(notificationDeliveries.campaignId, campaign.id),
					or(
						eq(notificationDeliveries.status, "queued"),
						eq(notificationDeliveries.status, "retrying"),
						eq(notificationDeliveries.status, "leased"),
					),
				),
			)
			.get();
		if (!remaining) {
			db.update(notificationCampaigns)
				.set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
				.where(eq(notificationCampaigns.id, campaign.id))
				.run();
		}
		if (campaign.kind === "feedback_request") {
			db.update(feedbackInvitations)
				.set({ sentAt: new Date() })
				.where(eq(feedbackInvitations.rsvpId, delivery.rsvpId))
				.run();
		}
		return true;
	}

	const terminal = !result.retryable || delivery.attempts > BACKOFF.length;
	const retrySeconds =
		result.retryAfterSeconds ??
		BACKOFF[Math.min(delivery.attempts - 1, BACKOFF.length - 1)];
	db.update(notificationDeliveries)
		.set({
			status: terminal ? "failed" : "retrying",
			nextAttemptAt: new Date(Date.now() + retrySeconds * 1000),
			slackError: result.error,
			completedAt: terminal ? new Date() : null,
			leaseOwner: null,
			leasedAt: null,
		})
		.where(eq(notificationDeliveries.id, delivery.id))
		.run();
	return true;
}
