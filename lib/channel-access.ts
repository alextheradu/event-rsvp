import { and, asc, eq, gt, lte, or } from "drizzle-orm";
import type { DB } from "./db";
import { channelAccessAttempts, forms, rsvps, users } from "./schema";
import type { SlackPort, SlackResult } from "./slack";
import type { VerificationPort } from "./verification";

export function enqueueChannelAccess(
	db: DB,
	rsvpId: string,
	kind: "grant" | "recheck" = "grant",
	nextAttemptAt = new Date(),
) {
	const row = db
		.select({
			rsvp: rsvps,
			form: forms,
			user: users,
		})
		.from(rsvps)
		.innerJoin(forms, eq(rsvps.formId, forms.id))
		.innerJoin(users, eq(rsvps.userId, users.id))
		.where(eq(rsvps.id, rsvpId))
		.get();
	if (row?.rsvp.status !== "confirmed") return null;
	if (!row.form.slackChannelId || !row.user.slackId) {
		db.update(rsvps)
			.set({
				channelAccessStatus: "not_requested",
				channelAccessUpdatedAt: new Date(),
			})
			.where(eq(rsvps.id, rsvpId))
			.run();
		return null;
	}
	const existing = db
		.select()
		.from(channelAccessAttempts)
		.where(
			and(
				eq(channelAccessAttempts.rsvpId, rsvpId),
				eq(channelAccessAttempts.kind, kind),
				or(
					eq(channelAccessAttempts.status, "queued"),
					eq(channelAccessAttempts.status, "leased"),
					eq(channelAccessAttempts.status, "retrying"),
				),
			),
		)
		.get();
	if (existing) return existing.id;
	const id = crypto.randomUUID();
	db.insert(channelAccessAttempts)
		.values({ id, rsvpId, kind, nextAttemptAt })
		.run();
	db.update(rsvps)
		.set({
			channelAccessStatus: "queued",
			channelAccessUpdatedAt: new Date(),
			channelAccessError: null,
		})
		.where(eq(rsvps.id, rsvpId))
		.run();
	return id;
}

function invite(
	slack: SlackPort,
	channelId: string,
	slackId: string,
): Promise<SlackResult> {
	if (slack.inviteToChannelDetailed) {
		return slack.inviteToChannelDetailed(channelId, slackId);
	}
	return slack
		.inviteToChannel(channelId, slackId)
		.then((ok) =>
			ok
				? { ok: true, value: undefined }
				: { ok: false, error: "slack_error", retryable: true },
		);
}

export async function processNextChannelAccess(
	db: DB,
	slack: SlackPort,
	verification: VerificationPort,
	workerId: string,
	now = new Date(),
) {
	const attempt = db.transaction((tx) => {
		const stale = new Date(now.getTime() - 5 * 60_000);
		const due = tx
			.select()
			.from(channelAccessAttempts)
			.where(
				and(
					lte(channelAccessAttempts.nextAttemptAt, now),
					or(
						eq(channelAccessAttempts.status, "queued"),
						eq(channelAccessAttempts.status, "retrying"),
						and(
							eq(channelAccessAttempts.status, "leased"),
							lte(channelAccessAttempts.leasedAt, stale),
						),
					),
				),
			)
			.orderBy(asc(channelAccessAttempts.nextAttemptAt))
			.get();
		if (!due) return null;
		tx.update(channelAccessAttempts)
			.set({
				status: "leased",
				leaseOwner: workerId,
				leasedAt: now,
				attempts: due.attempts + 1,
			})
			.where(eq(channelAccessAttempts.id, due.id))
			.run();
		return { ...due, attempts: due.attempts + 1 };
	});
	if (!attempt) return false;

	const row = db
		.select({ rsvp: rsvps, form: forms, user: users })
		.from(rsvps)
		.innerJoin(forms, eq(rsvps.formId, forms.id))
		.innerJoin(users, eq(rsvps.userId, users.id))
		.where(eq(rsvps.id, attempt.rsvpId))
		.get();
	if (
		row?.rsvp.status !== "confirmed" ||
		!row.form.slackChannelId ||
		!row.user.slackId
	) {
		db.update(channelAccessAttempts)
			.set({ status: "skipped", completedAt: new Date() })
			.where(eq(channelAccessAttempts.id, attempt.id))
			.run();
		return true;
	}

	const verified = await verification.checkSlackId(row.user.slackId);
	db.update(rsvps)
		.set({
			verificationStatus: verified.status,
			verificationCheckedAt: verified.checkedAt,
		})
		.where(eq(rsvps.id, row.rsvp.id))
		.run();
	if (verified.status !== "verified_eligible") {
		const retryable = verified.status === "unavailable";
		db.update(channelAccessAttempts)
			.set({
				status: retryable ? "retrying" : "blocked",
				nextAttemptAt: new Date(Date.now() + 5 * 60_000),
				verificationStatus: verified.status,
				verificationCheckedAt: verified.checkedAt,
				completedAt: retryable ? null : new Date(),
				leaseOwner: null,
				leasedAt: null,
			})
			.where(eq(channelAccessAttempts.id, attempt.id))
			.run();
		db.update(rsvps)
			.set({
				channelAccessStatus:
					attempt.kind === "recheck"
						? "needs_review"
						: retryable
							? "verification_unavailable"
							: "verification_needed",
				channelAccessUpdatedAt: new Date(),
				channelAccessError: verified.status,
			})
			.where(eq(rsvps.id, row.rsvp.id))
			.run();
		return true;
	}

	const result = await invite(slack, row.form.slackChannelId, row.user.slackId);
	if (result.ok) {
		db.update(channelAccessAttempts)
			.set({
				status: "completed",
				verificationStatus: verified.status,
				verificationCheckedAt: verified.checkedAt,
				completedAt: new Date(),
				leaseOwner: null,
				leasedAt: null,
			})
			.where(eq(channelAccessAttempts.id, attempt.id))
			.run();
		db.update(rsvps)
			.set({
				channelAccessStatus: attempt.kind === "recheck" ? "invited" : "invited",
				channelAccessUpdatedAt: new Date(),
				channelAccessError: null,
			})
			.where(eq(rsvps.id, row.rsvp.id))
			.run();
		return true;
	}

	const terminal = !result.retryable || attempt.attempts >= 6;
	db.update(channelAccessAttempts)
		.set({
			status: terminal ? "failed" : "retrying",
			nextAttemptAt: new Date(
				Date.now() + (result.retryAfterSeconds ?? 300) * 1000,
			),
			slackError: result.error,
			completedAt: terminal ? new Date() : null,
			leaseOwner: null,
			leasedAt: null,
		})
		.where(eq(channelAccessAttempts.id, attempt.id))
		.run();
	db.update(rsvps)
		.set({
			channelAccessStatus: terminal ? "failed" : "queued",
			channelAccessUpdatedAt: new Date(),
			channelAccessError: result.error,
		})
		.where(eq(rsvps.id, row.rsvp.id))
		.run();
	return true;
}

export function enqueueDueChannelRechecks(db: DB, now = new Date()) {
	const cutoff = new Date(now.getTime() + 24 * 60 * 60_000);
	const candidates = db
		.select({ rsvpId: rsvps.id })
		.from(rsvps)
		.innerJoin(forms, eq(rsvps.formId, forms.id))
		.where(
			and(
				eq(rsvps.status, "confirmed"),
				eq(rsvps.channelAccessStatus, "invited"),
				gt(forms.startAt, now),
				lte(forms.startAt, cutoff),
			),
		)
		.all();
	let queued = 0;
	for (const { rsvpId } of candidates) {
		const prior = db
			.select()
			.from(channelAccessAttempts)
			.where(
				and(
					eq(channelAccessAttempts.rsvpId, rsvpId),
					eq(channelAccessAttempts.kind, "recheck"),
				),
			)
			.get();
		if (!prior && enqueueChannelAccess(db, rsvpId, "recheck")) queued += 1;
	}
	return queued;
}
