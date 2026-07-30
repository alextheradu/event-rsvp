import { describe, expect, it, vi } from "vitest";
import {
	enqueueChannelAccess,
	processNextChannelAccess,
} from "./channel-access";
import { channelAccessAttempts, forms, rsvps, users } from "./schema";
import { createTestDb } from "./test-db";

function setup() {
	const db = createTestDb();
	db.insert(users)
		.values([
			{
				id: "host",
				hackclubId: "host",
				name: "Host",
				email: "",
				isAllowed: true,
			},
			{
				id: "guest",
				hackclubId: "guest",
				name: "Guest",
				email: "",
				slackId: "UGUEST",
				isAllowed: true,
			},
		])
		.run();
	db.insert(forms)
		.values({
			id: "form",
			slug: "event",
			title: "Event",
			creatorId: "host",
			slackChannelId: "C1234567",
		})
		.run();
	db.insert(rsvps)
		.values({ id: "rsvp", formId: "form", userId: "guest" })
		.run();
	return db;
}

describe("channel access", () => {
	it("invites only after a fresh eligible result", async () => {
		const db = setup();
		const invite = vi.fn(async () => true);
		enqueueChannelAccess(db, "rsvp");
		await processNextChannelAccess(
			db,
			{
				dm: vi.fn(async () => true),
				inviteToChannel: invite,
				getProfile: vi.fn(async () => null),
			},
			{
				checkSlackId: vi.fn(async () => ({
					status: "verified_eligible" as const,
					checkedAt: new Date(),
				})),
			},
			"test",
		);
		expect(invite).toHaveBeenCalledWith("C1234567", "UGUEST");
		expect(db.select().from(rsvps).get()?.channelAccessStatus).toBe("invited");
		expect(db.select().from(channelAccessAttempts).get()?.status).toBe(
			"completed",
		);
	});

	it("keeps the RSVP and withholds access when verification is pending", async () => {
		const db = setup();
		const invite = vi.fn(async () => true);
		enqueueChannelAccess(db, "rsvp");
		await processNextChannelAccess(
			db,
			{
				dm: vi.fn(async () => true),
				inviteToChannel: invite,
				getProfile: vi.fn(async () => null),
			},
			{
				checkSlackId: vi.fn(async () => ({
					status: "pending" as const,
					checkedAt: new Date(),
				})),
			},
			"test",
		);
		expect(invite).not.toHaveBeenCalled();
		expect(db.select().from(rsvps).get()?.status).toBe("confirmed");
		expect(db.select().from(rsvps).get()?.channelAccessStatus).toBe(
			"verification_needed",
		);
	});
});
