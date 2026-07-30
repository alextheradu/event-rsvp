import { describe, expect, it, vi } from "vitest";
import type { Deps } from "./rsvp";
import { cancelRsvp, countRsvps, createRsvp, getRsvp, hasRsvp } from "./rsvp";
import {
	channelAccessAttempts,
	feedback,
	forms,
	notificationCampaigns,
	notificationDeliveries,
	users,
} from "./schema";
import { createTestDb } from "./test-db";

function setup(opts: { allowIneligible?: boolean } = {}) {
	const db = createTestDb();
	const slack = {
		dm: vi.fn(async () => true),
		inviteToChannel: vi.fn(async () => true),
		getProfile: vi.fn(async () => null),
	};
	const deps: Deps = {
		db,
		slack,
		allowIneligible: opts.allowIneligible ?? false,
	};

	db.insert(users)
		.values([
			{
				id: "host",
				hackclubId: "h",
				name: "Host",
				email: "",
				slackId: "UHOST",
				isAllowed: true,
			},
			{
				id: "guest",
				hackclubId: "g",
				name: "Guest",
				email: "",
				slackId: "UGUEST",
				isAllowed: true,
			},
			{
				id: "blocked",
				hackclubId: "b",
				name: "Blocked",
				email: "",
				slackId: "UBLOCK",
				isAllowed: false,
			},
			{
				id: "noslack",
				hackclubId: "n",
				name: "NoSlack",
				email: "",
				slackId: null,
				isAllowed: true,
			},
		])
		.run();

	db.insert(forms)
		.values({ id: "f1", slug: "meetup", title: "Meetup", creatorId: "host" })
		.run();

	return { db, slack, deps };
}

describe("createRsvp", () => {
	it("saves an rsvp for an eligible guest", async () => {
		const { deps, db } = setup();
		const result = await createRsvp(deps, "guest", "f1");
		expect(result).toEqual({
			ok: true,
			alreadyRsvpd: false,
			reactivated: false,
			status: "confirmed",
		});
		expect(countRsvps(db, "f1")).toBe(1);
	});

	it("rejects the form creator", async () => {
		const { deps, db } = setup();
		const result = await createRsvp(deps, "host", "f1");
		expect(result).toEqual({ ok: false, reason: "own_form" });
		expect(countRsvps(db, "f1")).toBe(0);
	});

	it("rejects a user blocked in the database even though the session said allowed", async () => {
		const { deps, db } = setup();
		const result = await createRsvp(deps, "blocked", "f1");
		expect(result).toEqual({ ok: false, reason: "ineligible" });
		expect(countRsvps(db, "f1")).toBe(0);
	});

	it("allows an unverified user when the event does not require verification", async () => {
		const { deps, db } = setup();
		db.update(forms).set({ requiresVerification: false }).run();

		const result = await createRsvp(deps, "blocked", "f1");

		expect(result).toMatchObject({
			ok: true,
			alreadyRsvpd: false,
			status: "confirmed",
		});
		expect(countRsvps(db, "f1")).toBe(1);
	});

	it("allows an ineligible user when allowIneligible is set (dev mode)", async () => {
		const { deps } = setup({ allowIneligible: true });
		const result = await createRsvp(deps, "blocked", "f1");
		expect(result).toEqual({
			ok: true,
			alreadyRsvpd: false,
			reactivated: false,
			status: "confirmed",
		});
	});

	it("rejects a closed form", async () => {
		const { deps, db } = setup();
		db.update(forms).set({ isOpen: false }).run();
		const result = await createRsvp(deps, "guest", "f1");
		expect(result).toEqual({ ok: false, reason: "closed" });
	});

	it("rejects an unknown form", async () => {
		const { deps } = setup();
		expect(await createRsvp(deps, "guest", "nope")).toEqual({
			ok: false,
			reason: "not_found",
		});
	});

	it("is idempotent for a duplicate rsvp", async () => {
		const { deps, db } = setup();
		await createRsvp(deps, "guest", "f1");
		const second = await createRsvp(deps, "guest", "f1");
		expect(second).toEqual({
			ok: true,
			alreadyRsvpd: true,
			reactivated: false,
			status: "confirmed",
		});
		expect(countRsvps(db, "f1")).toBe(1);
	});

	it("durably queues a DM on success", async () => {
		const { deps, slack, db } = setup();
		await createRsvp(deps, "guest", "f1");
		expect(db.select().from(notificationDeliveries).all()).toHaveLength(1);
		expect(db.select().from(notificationDeliveries).get()?.renderedText).toBe(
			"You're RSVP'd for Meetup!",
		);
		expect(slack.dm).not.toHaveBeenCalled();
		expect(slack.inviteToChannel).not.toHaveBeenCalled();
	});

	it("queues verification-gated channel access when configured", async () => {
		const { deps, slack, db } = setup();
		db.update(forms).set({ slackChannelId: "C1234567" }).run();
		await createRsvp(deps, "guest", "f1");
		expect(db.select().from(channelAccessAttempts).all()).toHaveLength(1);
		expect(slack.inviteToChannel).not.toHaveBeenCalled();
	});

	it("skips Slack entirely for a user with no slackId", async () => {
		const { deps, slack } = setup();
		await createRsvp(deps, "noslack", "f1");
		expect(slack.dm).not.toHaveBeenCalled();
	});

	it("does not perform Slack network I/O in the request path", async () => {
		const { deps, slack, db } = setup();
		slack.dm.mockRejectedValueOnce(new Error("slack down"));
		const result = await createRsvp(deps, "guest", "f1");
		expect(result).toEqual({
			ok: true,
			alreadyRsvpd: false,
			reactivated: false,
			status: "confirmed",
		});
		expect(countRsvps(db, "f1")).toBe(1);
	});

	it("does not DM again on a duplicate rsvp", async () => {
		const { deps, slack } = setup();
		await createRsvp(deps, "guest", "f1");
		slack.dm.mockClear();
		await createRsvp(deps, "guest", "f1");
		expect(slack.dm).not.toHaveBeenCalled();
	});

	it("waitlists at capacity and promotes FIFO when a spot opens", async () => {
		const { deps, db } = setup();
		db.insert(users)
			.values({
				id: "guest2",
				hackclubId: "g2",
				name: "Second Guest",
				email: "",
				slackId: "UGUEST2",
				isAllowed: true,
			})
			.run();
		db.update(forms).set({ capacity: 1 }).run();
		expect(await createRsvp(deps, "guest", "f1")).toMatchObject({
			status: "confirmed",
		});
		expect(await createRsvp(deps, "guest2", "f1")).toMatchObject({
			status: "waitlisted",
		});

		const cancelled = await cancelRsvp(deps, "guest", "f1");

		expect(cancelled.promotedUserId).toBe("guest2");
		expect(getRsvp(db, "guest2", "f1")?.status).toBe("confirmed");
	});

	it("reactivates a cancelled row instead of creating a duplicate", async () => {
		const { deps, db } = setup();
		await createRsvp(deps, "guest", "f1");
		await cancelRsvp(deps, "guest", "f1");
		const result = await createRsvp(deps, "guest", "f1");
		expect(result).toMatchObject({
			ok: true,
			reactivated: true,
			status: "confirmed",
		});
		expect(db.select().from(notificationCampaigns).all()).toHaveLength(3);
	});
});

describe("cancelRsvp", () => {
	it("cancels the RSVP, preserves legacy feedback, and queues a DM", async () => {
		const { deps, db, slack } = setup();
		await createRsvp(deps, "guest", "f1");
		db.insert(feedback)
			.values({ id: "fb1", formId: "f1", userId: "guest", content: "hi" })
			.run();
		slack.dm.mockClear();

		const result = await cancelRsvp(deps, "guest", "f1");

		expect(result).toEqual({ ok: true });
		expect(hasRsvp(db, "guest", "f1")).toBe(false);
		expect(db.select().from(feedback).all()).toHaveLength(1);
		expect(db.select().from(notificationCampaigns).all()).toHaveLength(2);
		expect(slack.dm).not.toHaveBeenCalled();
	});

	it("is a no-op for an unknown form", async () => {
		const { deps } = setup();
		expect(await cancelRsvp(deps, "guest", "nope")).toEqual({ ok: false });
	});

	it("does not DM when there was no RSVP to cancel", async () => {
		const { deps, slack } = setup();
		const result = await cancelRsvp(deps, "guest", "f1");
		expect(result).toEqual({ ok: true });
		expect(slack.dm).not.toHaveBeenCalled();
	});

	it("does not queue cancellation twice when cancel is clicked twice", async () => {
		const { deps, db } = setup();
		await createRsvp(deps, "guest", "f1");
		await cancelRsvp(deps, "guest", "f1");
		expect(db.select().from(notificationCampaigns).all()).toHaveLength(2);
		await cancelRsvp(deps, "guest", "f1");
		expect(db.select().from(notificationCampaigns).all()).toHaveLength(2);
	});
});
