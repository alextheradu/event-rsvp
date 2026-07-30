import { describe, expect, it, vi } from "vitest";
import { createCampaign, processNextNotification } from "./notifications";
import {
	forms,
	notificationCampaigns,
	notificationDeliveries,
	rsvps,
	users,
} from "./schema";
import { createTestDb } from "./test-db";

describe("durable notifications", () => {
	it("freezes copy and records delivery success", async () => {
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
					name: "Ada Lovelace",
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
				title: "Build Night",
				creatorId: "host",
			})
			.run();
		db.insert(rsvps)
			.values({ id: "rsvp", formId: "form", userId: "guest" })
			.run();
		createCampaign(db, {
			formId: "form",
			creatorId: "host",
			kind: "announcement",
			audience: "confirmed",
			template: "hi {first_name}! {event_name}",
			isOperational: false,
			scheduledAt: new Date(),
		});
		const dm = vi.fn(async () => true);
		await processNextNotification(
			db,
			{
				dm,
				inviteToChannel: vi.fn(async () => true),
				getProfile: vi.fn(async () => null),
			},
			"test",
		);
		expect(dm).toHaveBeenCalledWith("UGUEST", "hi Ada! Build Night");
		expect(db.select().from(notificationDeliveries).get()?.status).toBe("sent");
		expect(db.select().from(notificationCampaigns).get()?.status).toBe("sent");
	});
});
