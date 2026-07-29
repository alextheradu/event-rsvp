import { describe, expect, it, vi } from "vitest";
import { users } from "./schema";
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
		db.insert(users)
			.values({
				id: "bot-created",
				hackclubId: "temp",
				slackId: "U1",
				name: "",
				email: "",
			})
			.run();

		const u = await upsertOAuthUser(db, {
			hackclubId: "h1",
			slackId: "U1",
			name: "Ada",
			avatarUrl: null,
			yswsEligible: true,
		});

		expect(u.id).toBe("bot-created");
		const row = db.select().from(users).get();
		expect(row?.hackclubId).toBe("h1");
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
