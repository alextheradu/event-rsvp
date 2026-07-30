import { and, asc, count, eq } from "drizzle-orm";
import { enqueueChannelAccess } from "./channel-access";
import type { DB } from "./db";
import {
	addRsvpToScheduledCampaigns,
	createSystemCampaign,
} from "./notifications";
import { forms, rsvps, users } from "./schema";
import type { SlackPort } from "./slack";

export interface Deps {
	db: DB;
	slack: SlackPort;
	allowIneligible: boolean;
}

export type RsvpStatus = "confirmed" | "waitlisted" | "cancelled";
export type RsvpFailure =
	| "not_found"
	| "closed"
	| "cancelled"
	| "own_form"
	| "ineligible";

export type RsvpResult =
	| {
			ok: true;
			alreadyRsvpd: boolean;
			reactivated: boolean;
			status: Exclude<RsvpStatus, "cancelled">;
	  }
	| { ok: false; reason: RsvpFailure };

export function getRsvp(db: DB, userId: string, formId: string) {
	return db
		.select()
		.from(rsvps)
		.where(and(eq(rsvps.formId, formId), eq(rsvps.userId, userId)))
		.get();
}

export function hasRsvp(db: DB, userId: string, formId: string): boolean {
	const row = getRsvp(db, userId, formId);
	return row?.status === "confirmed" || row?.status === "waitlisted";
}

export function hasConfirmedRsvp(
	db: DB,
	userId: string,
	formId: string,
): boolean {
	return getRsvp(db, userId, formId)?.status === "confirmed";
}

export function countRsvps(db: DB, formId: string): number {
	return countConfirmed(db, formId);
}

export function countConfirmed(db: DB, formId: string): number {
	return (
		db
			.select({ value: count() })
			.from(rsvps)
			.where(and(eq(rsvps.formId, formId), eq(rsvps.status, "confirmed")))
			.get()?.value ?? 0
	);
}

export function countWaitlisted(db: DB, formId: string): number {
	return (
		db
			.select({ value: count() })
			.from(rsvps)
			.where(and(eq(rsvps.formId, formId), eq(rsvps.status, "waitlisted")))
			.get()?.value ?? 0
	);
}

export async function createRsvp(
	deps: Deps,
	userId: string,
	formId: string,
): Promise<RsvpResult> {
	const outcome = deps.db.transaction((tx): RsvpResult => {
		const form = tx.select().from(forms).where(eq(forms.id, formId)).get();
		const user = tx.select().from(users).where(eq(users.id, userId)).get();
		if (!form || !user) return { ok: false, reason: "not_found" };
		if (form.creatorId === userId) return { ok: false, reason: "own_form" };
		if (form.requiresVerification && !deps.allowIneligible && !user.isAllowed) {
			return { ok: false, reason: "ineligible" };
		}
		if (!form.isOpen) return { ok: false, reason: "closed" };
		if (form.cancelledAt) return { ok: false, reason: "cancelled" };

		const existing = tx
			.select()
			.from(rsvps)
			.where(and(eq(rsvps.formId, formId), eq(rsvps.userId, userId)))
			.get();
		if (existing?.status === "confirmed" || existing?.status === "waitlisted") {
			return {
				ok: true,
				alreadyRsvpd: true,
				reactivated: false,
				status: existing.status,
			};
		}
		const confirmed =
			tx
				.select({ value: count() })
				.from(rsvps)
				.where(and(eq(rsvps.formId, formId), eq(rsvps.status, "confirmed")))
				.get()?.value ?? 0;
		const status =
			form.capacity !== null && confirmed >= form.capacity
				? "waitlisted"
				: "confirmed";
		const now = new Date();
		if (existing) {
			tx.update(rsvps)
				.set({
					status,
					cancelledAt: null,
					createdAt: now,
					checkedInAt: null,
					checkedInBy: null,
					channelAccessStatus: "not_requested",
					channelAccessError: null,
				})
				.where(eq(rsvps.id, existing.id))
				.run();
		} else {
			tx.insert(rsvps)
				.values({ id: crypto.randomUUID(), formId, userId, status })
				.run();
		}
		return {
			ok: true,
			alreadyRsvpd: false,
			reactivated: Boolean(existing),
			status,
		};
	});

	if (!outcome.ok || outcome.alreadyRsvpd) return outcome;
	const rsvp = getRsvp(deps.db, userId, formId);
	if (outcome.status === "confirmed" && rsvp) {
		enqueueChannelAccess(deps.db, rsvp.id);
	}
	if (rsvp) {
		createSystemCampaign(
			deps.db,
			formId,
			rsvp.id,
			outcome.status === "confirmed" ? "rsvp_confirmed" : "rsvp_waitlisted",
			outcome.status === "confirmed"
				? "You're RSVP'd for {event_name}!"
				: "You're on the waitlist for {event_name}. We'll let you know if a spot opens.",
		);
		addRsvpToScheduledCampaigns(deps.db, rsvp.id);
	}
	return outcome;
}

export async function cancelRsvp(
	deps: Deps,
	userId: string,
	formId: string,
): Promise<{ ok: boolean; promotedUserId?: string }> {
	const outcome = deps.db.transaction((tx) => {
		const form = tx.select().from(forms).where(eq(forms.id, formId)).get();
		if (!form) return { ok: false, changed: false };
		const current = tx
			.select()
			.from(rsvps)
			.where(and(eq(rsvps.formId, formId), eq(rsvps.userId, userId)))
			.get();
		if (!current || current.status === "cancelled") {
			return { ok: true, changed: false, title: form.title };
		}
		tx.update(rsvps)
			.set({
				status: "cancelled",
				cancelledAt: new Date(),
				checkedInAt: null,
				checkedInBy: null,
				channelAccessStatus: "not_requested",
			})
			.where(eq(rsvps.id, current.id))
			.run();

		let promotedUserId: string | undefined;
		if (current.status === "confirmed") {
			const next = tx
				.select()
				.from(rsvps)
				.where(and(eq(rsvps.formId, formId), eq(rsvps.status, "waitlisted")))
				.orderBy(asc(rsvps.createdAt))
				.get();
			if (next) {
				tx.update(rsvps)
					.set({ status: "confirmed", channelAccessStatus: "not_requested" })
					.where(eq(rsvps.id, next.id))
					.run();
				promotedUserId = next.userId;
			}
		}
		return {
			ok: true,
			changed: true,
			title: form.title,
			promotedUserId,
		};
	});

	if (!outcome.ok || !outcome.changed) return { ok: outcome.ok };
	const cancelledRsvp = getRsvp(deps.db, userId, formId);
	if (cancelledRsvp) {
		createSystemCampaign(
			deps.db,
			formId,
			cancelledRsvp.id,
			"rsvp_cancelled",
			"You're no longer RSVP'd for {event_name}.",
		);
	}
	if (outcome.promotedUserId) {
		const promotedRsvp = getRsvp(deps.db, outcome.promotedUserId, formId);
		if (promotedRsvp) enqueueChannelAccess(deps.db, promotedRsvp.id);
		if (promotedRsvp) {
			createSystemCampaign(
				deps.db,
				formId,
				promotedRsvp.id,
				"waitlist_promoted",
				"A spot opened up—you’re now RSVP'd for {event_name}!",
			);
			addRsvpToScheduledCampaigns(deps.db, promotedRsvp.id);
		}
	}
	return { ok: true, promotedUserId: outcome.promotedUserId };
}

export function fillAvailableCapacity(deps: Deps, formId: string) {
	const promotedIds = deps.db.transaction((tx) => {
		const form = tx.select().from(forms).where(eq(forms.id, formId)).get();
		if (!form || form.capacity === null) return [] as string[];
		const confirmed =
			tx
				.select({ value: count() })
				.from(rsvps)
				.where(and(eq(rsvps.formId, formId), eq(rsvps.status, "confirmed")))
				.get()?.value ?? 0;
		const available = Math.max(0, form.capacity - confirmed);
		const next = tx
			.select()
			.from(rsvps)
			.where(and(eq(rsvps.formId, formId), eq(rsvps.status, "waitlisted")))
			.orderBy(asc(rsvps.createdAt))
			.limit(available)
			.all();
		for (const row of next) {
			tx.update(rsvps)
				.set({ status: "confirmed", channelAccessStatus: "not_requested" })
				.where(eq(rsvps.id, row.id))
				.run();
		}
		return next.map(({ id }) => id);
	});
	for (const rsvpId of promotedIds) {
		enqueueChannelAccess(deps.db, rsvpId);
		createSystemCampaign(
			deps.db,
			formId,
			rsvpId,
			"waitlist_promoted",
			"A spot opened up—you’re now RSVP'd for {event_name}!",
		);
		addRsvpToScheduledCampaigns(deps.db, rsvpId);
	}
	return promotedIds;
}
