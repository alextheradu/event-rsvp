import { and, eq } from "drizzle-orm";
import type { DB } from "./db";
import {
	channelAccessAttempts,
	eventChanges,
	feedback,
	feedbackAnswers,
	feedbackInvitations,
	feedbackResponses,
	forms,
	notificationCampaigns,
	notificationDeliveries,
	rsvps,
	users,
} from "./schema";
import type { SessionUser } from "./session";
import type { SlackPort } from "./slack";
import { createHackClubVerification } from "./verification";

export type EligibilityCheck = (slackId: string) => Promise<boolean>;

export const checkHackClubEligibility: EligibilityCheck = async (slackId) => {
	const result = await createHackClubVerification().checkSlackId(slackId);
	return result.status === "verified_eligible";
};

export interface OAuthIdentity {
	hackclubId: string;
	slackId: string | null;
	name: string;
	avatarUrl: string | null;
	yswsEligible: boolean;
}

/**
 * Fold `loser` into `winner` and delete `loser`.
 *
 * Reachable when the Slack worker created a placeholder row for someone who already
 * had an OAuth row (or vice versa) — two rows, one human. Without this, promoting the
 * placeholder's `hackclub_id` to the real value violates the unique index and throws
 * at login, which the user experiences as "I can't sign in any more".
 *
 * Order matters: collision-prone child rows are dropped before the survivors are
 * repointed, because `rsvps` and `feedback` each carry a unique index on
 * (form_id, user_id) and the same human may have rows under both identities.
 */
function mergeUsers(db: DB, winnerId: string, loserId: string): void {
	const loserRsvps = db
		.select({ id: rsvps.id, formId: rsvps.formId })
		.from(rsvps)
		.where(eq(rsvps.userId, loserId))
		.all();

	for (const loserRsvp of loserRsvps) {
		const clash = db
			.select()
			.from(rsvps)
			.where(
				and(eq(rsvps.formId, loserRsvp.formId), eq(rsvps.userId, winnerId)),
			)
			.get();
		if (clash) {
			db.delete(channelAccessAttempts)
				.where(eq(channelAccessAttempts.rsvpId, loserRsvp.id))
				.run();
			const deliveries = db
				.select()
				.from(notificationDeliveries)
				.where(eq(notificationDeliveries.rsvpId, loserRsvp.id))
				.all();
			for (const delivery of deliveries) {
				const duplicate = db
					.select()
					.from(notificationDeliveries)
					.where(
						and(
							eq(notificationDeliveries.campaignId, delivery.campaignId),
							eq(notificationDeliveries.rsvpId, clash.id),
						),
					)
					.get();
				if (duplicate) {
					db.delete(notificationDeliveries)
						.where(eq(notificationDeliveries.id, delivery.id))
						.run();
				} else {
					db.update(notificationDeliveries)
						.set({ rsvpId: clash.id, userId: winnerId })
						.where(eq(notificationDeliveries.id, delivery.id))
						.run();
				}
			}
			const invitations = db
				.select()
				.from(feedbackInvitations)
				.where(eq(feedbackInvitations.rsvpId, loserRsvp.id))
				.all();
			for (const invitation of invitations) {
				const duplicate = db
					.select()
					.from(feedbackInvitations)
					.where(
						and(
							eq(feedbackInvitations.feedbackFormId, invitation.feedbackFormId),
							eq(feedbackInvitations.rsvpId, clash.id),
						),
					)
					.get();
				if (duplicate) {
					const response = db
						.select()
						.from(feedbackResponses)
						.where(eq(feedbackResponses.invitationId, invitation.id))
						.get();
					if (response) {
						db.delete(feedbackAnswers)
							.where(eq(feedbackAnswers.responseId, response.id))
							.run();
						db.delete(feedbackResponses)
							.where(eq(feedbackResponses.id, response.id))
							.run();
					}
					db.delete(feedbackInvitations)
						.where(eq(feedbackInvitations.id, invitation.id))
						.run();
				} else {
					db.update(feedbackInvitations)
						.set({ rsvpId: clash.id })
						.where(eq(feedbackInvitations.id, invitation.id))
						.run();
				}
			}
			db.delete(rsvps).where(eq(rsvps.id, loserRsvp.id)).run();
		}
	}

	const loserFeedback = db
		.select({ formId: feedback.formId })
		.from(feedback)
		.where(eq(feedback.userId, loserId))
		.all()
		.map((r) => r.formId);

	for (const formId of loserFeedback) {
		const clash = db
			.select()
			.from(feedback)
			.where(and(eq(feedback.formId, formId), eq(feedback.userId, winnerId)))
			.get();
		if (clash) {
			db.delete(feedback)
				.where(and(eq(feedback.formId, formId), eq(feedback.userId, loserId)))
				.run();
		}
	}

	db.update(rsvps)
		.set({ userId: winnerId })
		.where(eq(rsvps.userId, loserId))
		.run();
	db.update(rsvps)
		.set({ checkedInBy: winnerId })
		.where(eq(rsvps.checkedInBy, loserId))
		.run();
	db.update(feedback)
		.set({ userId: winnerId })
		.where(eq(feedback.userId, loserId))
		.run();
	db.update(forms)
		.set({ creatorId: winnerId })
		.where(eq(forms.creatorId, loserId))
		.run();
	db.update(eventChanges)
		.set({ actorId: winnerId })
		.where(eq(eventChanges.actorId, loserId))
		.run();
	db.update(notificationCampaigns)
		.set({ creatorId: winnerId })
		.where(eq(notificationCampaigns.creatorId, loserId))
		.run();
	db.update(notificationDeliveries)
		.set({ userId: winnerId })
		.where(eq(notificationDeliveries.userId, loserId))
		.run();

	db.delete(users).where(eq(users.id, loserId)).run();
}

export async function upsertOAuthUser(
	db: DB,
	identity: OAuthIdentity,
): Promise<SessionUser> {
	return db.transaction(() => upsertOAuthUserInner(db, identity));
}

function upsertOAuthUserInner(db: DB, identity: OAuthIdentity): SessionUser {
	const bySlack = identity.slackId
		? db.select().from(users).where(eq(users.slackId, identity.slackId)).get()
		: undefined;

	const byHackclub = db
		.select()
		.from(users)
		.where(eq(users.hackclubId, identity.hackclubId))
		.get();

	// Two rows, one human. Keep the row the Slack worker has been writing to (it may
	// already own RSVPs made from Slack) and fold the other into it, freeing the
	// hackclub_id before we promote it.
	if (bySlack && byHackclub && bySlack.id !== byHackclub.id) {
		// Preserve a block applied to either row: if either says blocked, stay blocked.
		const stayBlocked = !bySlack.isAllowed || !byHackclub.isAllowed;
		mergeUsers(db, bySlack.id, byHackclub.id);
		if (stayBlocked) {
			db.update(users)
				.set({ isAllowed: false })
				.where(eq(users.id, bySlack.id))
				.run();
		}
	}

	const existing =
		bySlack ??
		db
			.select()
			.from(users)
			.where(eq(users.hackclubId, identity.hackclubId))
			.get();

	if (existing) {
		// Re-read: a merge above may have changed isAllowed.
		const current =
			db.select().from(users).where(eq(users.id, existing.id)).get() ??
			existing;
		db.update(users)
			.set({
				name: identity.name,
				avatarUrl: identity.avatarUrl,
				slackId: identity.slackId,
				hackclubId: identity.hackclubId,
			})
			.where(eq(users.id, existing.id))
			.run();

		return {
			id: current.id,
			name: identity.name,
			email: current.email,
			avatarUrl: identity.avatarUrl,
			isAllowed: current.isAllowed,
			slackId: identity.slackId,
		};
	}

	const id = crypto.randomUUID();
	db.insert(users)
		.values({
			id,
			hackclubId: identity.hackclubId,
			name: identity.name,
			email: "",
			avatarUrl: identity.avatarUrl,
			slackId: identity.slackId,
			isAllowed: identity.yswsEligible,
		})
		.run();

	return {
		id,
		name: identity.name,
		email: "",
		avatarUrl: identity.avatarUrl,
		isAllowed: identity.yswsEligible,
		slackId: identity.slackId,
	};
}

export async function resolveSlackUser(
	db: DB,
	slack: SlackPort,
	slackId: string,
	checkEligibility: EligibilityCheck = checkHackClubEligibility,
): Promise<{ id: string; isAllowed: boolean } | null> {
	const existing = db
		.select()
		.from(users)
		.where(eq(users.slackId, slackId))
		.get();
	if (existing) return { id: existing.id, isAllowed: existing.isAllowed };

	if (!(await checkEligibility(slackId))) return null;

	const profile = await slack.getProfile(slackId);
	const id = crypto.randomUUID();

	db.insert(users)
		.values({
			id,
			hackclubId: `slack_${slackId}`,
			name: profile?.displayName ?? slackId,
			email: "",
			avatarUrl: profile?.avatarUrl ?? null,
			slackId,
			isAllowed: true,
		})
		.run();

	return { id, isAllowed: true };
}
