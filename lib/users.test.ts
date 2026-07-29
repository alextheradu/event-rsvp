import { describe, expect, it, vi } from "vitest";
import { forms, rsvps, users } from "./schema";
import { createTestDb } from "./test-db";
import { resolveSlackUser, upsertOAuthUser } from "./users";

const noSlack = {
	dm: vi.fn(async () => true),
	inviteToChannel: vi.fn(async () => true),
	getProfile: vi.fn(async () => ({ displayName: "Ada", avatarUrl: "a.png" })),
};

describe("upsertOAuthUser", () => {
	it("creates a new user with eligibility from OAuth", async () => {
		const db = createTestDb();
		const u = await upsertOAuthUser(db, {
			hackclubId: "h1",
			slackId: "U1",
			name: "Ada",
			avatarUrl: null,
			yswsEligible: true,
		});
		expect(u.isAllowed).toBe(true);
		expect(db.select().from(users).all()).toHaveLength(1);
	});

	it("preserves isAllowed on an existing user even if OAuth now says eligible", async () => {
		const db = createTestDb();
		db.insert(users)
			.values({
				id: "u1",
				hackclubId: "h1",
				slackId: "U1",
				name: "Ada",
				email: "",
				isAllowed: false,
			})
			.run();

		const u = await upsertOAuthUser(db, {
			hackclubId: "h1",
			slackId: "U1",
			name: "Ada Lovelace",
			avatarUrl: null,
			yswsEligible: true,
		});

		expect(u.id).toBe("u1");
		expect(u.isAllowed).toBe(false);
		expect(u.name).toBe("Ada Lovelace");
		expect(db.select().from(users).all()).toHaveLength(1);
	});

	it("matches by slackId before hackclubId", async () => {
		const db = createTestDb();
		// TWO candidate rows. A hackclubId-first implementation would return
		// "oauth-created"; only a slackId-first one returns "bot-created".
		// With a single seeded row this assertion passes under either order and
		// proves nothing.
		db.insert(users)
			.values([
				{
					id: "bot-created",
					hackclubId: "slack_U1",
					slackId: "U1",
					name: "",
					email: "",
				},
				{
					id: "oauth-created",
					hackclubId: "h1",
					slackId: null,
					name: "Ada",
					email: "",
				},
			])
			.run();

		const u = await upsertOAuthUser(db, {
			hackclubId: "h1",
			slackId: "U1",
			name: "Ada",
			avatarUrl: null,
			yswsEligible: true,
		});

		expect(u.id).toBe("bot-created");
	});

	it("merges a bot-created row and an OAuth row for the same human", async () => {
		const db = createTestDb();
		db.insert(users)
			.values([
				{
					id: "bot-created",
					hackclubId: "slack_U1",
					slackId: "U1",
					name: "",
					email: "",
				},
				{
					id: "oauth-created",
					hackclubId: "h1",
					slackId: null,
					name: "Ada",
					email: "",
				},
			])
			.run();
		db.insert(forms)
			.values({
				id: "f1",
				slug: "meetup",
				title: "Meetup",
				creatorId: "oauth-created",
			})
			.run();
		db.insert(rsvps)
			.values({ id: "r1", formId: "f1", userId: "bot-created" })
			.run();

		const u = await upsertOAuthUser(db, {
			hackclubId: "h1",
			slackId: "U1",
			name: "Ada",
			avatarUrl: null,
			yswsEligible: true,
		});

		// One row survives, carrying the real hackclubId and the Slack id.
		const rows = db.select().from(users).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].id).toBe("bot-created");
		expect(rows[0].hackclubId).toBe("h1");
		expect(rows[0].slackId).toBe("U1");
		expect(u.id).toBe("bot-created");

		// Nothing owned by the deleted row is orphaned.
		expect(db.select().from(forms).get()?.creatorId).toBe("bot-created");
		expect(db.select().from(rsvps).get()?.userId).toBe("bot-created");
	});

	it("keeps a block applied to either row when merging", async () => {
		const db = createTestDb();
		db.insert(users)
			.values([
				{
					id: "bot-created",
					hackclubId: "slack_U1",
					slackId: "U1",
					name: "",
					email: "",
					isAllowed: true,
				},
				{
					id: "oauth-created",
					hackclubId: "h1",
					slackId: null,
					name: "Ada",
					email: "",
					isAllowed: false,
				},
			])
			.run();

		const u = await upsertOAuthUser(db, {
			hackclubId: "h1",
			slackId: "U1",
			name: "Ada",
			avatarUrl: null,
			yswsEligible: true,
		});

		expect(u.isAllowed).toBe(false);
		expect(db.select().from(users).get()?.isAllowed).toBe(false);
	});

	it("drops a duplicate RSVP rather than violating the unique index on merge", async () => {
		const db = createTestDb();
		db.insert(users)
			.values([
				{
					id: "bot-created",
					hackclubId: "slack_U1",
					slackId: "U1",
					name: "",
					email: "",
				},
				{
					id: "oauth-created",
					hackclubId: "h1",
					slackId: null,
					name: "Ada",
					email: "",
				},
				{
					id: "host",
					hackclubId: "h9",
					slackId: null,
					name: "Host",
					email: "",
				},
			])
			.run();
		db.insert(forms)
			.values({ id: "f1", slug: "meetup", title: "Meetup", creatorId: "host" })
			.run();
		// Same human RSVP'd the same form under both identities.
		db.insert(rsvps)
			.values([
				{ id: "r1", formId: "f1", userId: "bot-created" },
				{ id: "r2", formId: "f1", userId: "oauth-created" },
			])
			.run();

		await upsertOAuthUser(db, {
			hackclubId: "h1",
			slackId: "U1",
			name: "Ada",
			avatarUrl: null,
			yswsEligible: true,
		});

		const remaining = db.select().from(rsvps).all();
		expect(remaining).toHaveLength(1);
		expect(remaining[0].userId).toBe("bot-created");
	});
});

describe("resolveSlackUser", () => {
	it("returns an existing user without calling the eligibility check", async () => {
		const db = createTestDb();
		db.insert(users)
			.values({
				id: "u1",
				hackclubId: "h1",
				slackId: "U1",
				name: "Ada",
				email: "",
				isAllowed: true,
			})
			.run();
		const check = vi.fn(async () => true);

		const result = await resolveSlackUser(db, noSlack, "U1", check);

		expect(result).toEqual({ id: "u1", isAllowed: true });
		expect(check).not.toHaveBeenCalled();
	});

	it("returns null for an unknown, ineligible Slack user", async () => {
		const db = createTestDb();
		const result = await resolveSlackUser(db, noSlack, "U9", async () => false);
		expect(result).toBeNull();
		expect(db.select().from(users).all()).toHaveLength(0);
	});

	it("creates an allowed user for an unknown but eligible Slack user", async () => {
		const db = createTestDb();
		const result = await resolveSlackUser(db, noSlack, "U9", async () => true);
		expect(result?.isAllowed).toBe(true);
		const row = db.select().from(users).get();
		expect(row?.slackId).toBe("U9");
		expect(row?.name).toBe("Ada");
	});
});
