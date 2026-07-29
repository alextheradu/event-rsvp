import { and, count, eq } from "drizzle-orm";
import type { DB } from "./db";
import { getFormById } from "./forms";
import { feedback, rsvps, users } from "./schema";
import type { SlackPort } from "./slack";

export interface Deps {
	db: DB;
	slack: SlackPort;
	allowIneligible: boolean;
}

export type RsvpFailure = "not_found" | "closed" | "own_form" | "ineligible";

export type RsvpResult =
	| { ok: true; alreadyRsvpd: boolean }
	| { ok: false; reason: RsvpFailure };

export function hasRsvp(db: DB, userId: string, formId: string): boolean {
	return (
		db
			.select()
			.from(rsvps)
			.where(and(eq(rsvps.formId, formId), eq(rsvps.userId, userId)))
			.get() !== undefined
	);
}

export function countRsvps(db: DB, formId: string): number {
	return (
		db
			.select({ value: count() })
			.from(rsvps)
			.where(eq(rsvps.formId, formId))
			.get()?.value ?? 0
	);
}

export async function createRsvp(
	deps: Deps,
	userId: string,
	formId: string,
): Promise<RsvpResult> {
	const { db, slack, allowIneligible } = deps;

	const form = getFormById(db, formId);
	if (!form) return { ok: false, reason: "not_found" };

	const user = db.select().from(users).where(eq(users.id, userId)).get();
	if (!user) return { ok: false, reason: "not_found" };

	if (form.creatorId === userId) return { ok: false, reason: "own_form" };
	if (!allowIneligible && !user.isAllowed) {
		return { ok: false, reason: "ineligible" };
	}
	if (!form.isOpen) return { ok: false, reason: "closed" };

	if (hasRsvp(db, userId, formId)) return { ok: true, alreadyRsvpd: true };

	try {
		db.insert(rsvps).values({ id: crypto.randomUUID(), formId, userId }).run();
	} catch {
		return { ok: true, alreadyRsvpd: true };
	}

	const slackId = user.slackId;
	if (slackId) {
		await notify(() => slack.dm(slackId, `You're RSVPed for ${form.title}!`));
		if (form.slackChannelId) {
			const channelId = form.slackChannelId;
			await notify(() => slack.inviteToChannel(channelId, slackId));
		}
	}

	return { ok: true, alreadyRsvpd: false };
}

export async function cancelRsvp(
	deps: Deps,
	userId: string,
	formId: string,
): Promise<{ ok: boolean }> {
	const { db, slack } = deps;

	const form = getFormById(db, formId);
	if (!form) return { ok: false };

	db.delete(feedback)
		.where(and(eq(feedback.formId, formId), eq(feedback.userId, userId)))
		.run();
	db.delete(rsvps)
		.where(and(eq(rsvps.formId, formId), eq(rsvps.userId, userId)))
		.run();

	const user = db.select().from(users).where(eq(users.id, userId)).get();
	const slackId = user?.slackId;
	if (slackId) {
		await notify(() =>
			slack.dm(slackId, `You're no longer RSVPed for ${form.title}.`),
		);
	}

	return { ok: true };
}

async function notify(fn: () => Promise<boolean>) {
	try {
		await fn();
	} catch (err) {
		console.error("slack notification failed:", err);
	}
}
