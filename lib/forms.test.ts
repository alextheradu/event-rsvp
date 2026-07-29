import { describe, expect, it } from "vitest";
import { createForm, deleteForm, getFormBySlug } from "./forms";
import { feedback, forms, rsvps, users } from "./schema";
import { createTestDb } from "./test-db";

function seedUser(db: ReturnType<typeof createTestDb>, id = "u1") {
	db.insert(users)
		.values({
			id,
			hackclubId: `h-${id}`,
			name: "Ada",
			email: "",
			isAllowed: true,
		})
		.run();
	return id;
}

const base = {
	title: "Meetup",
	description: null,
	website: null,
	slackChannelId: null,
	feedbackEnabled: false,
};

describe("createForm", () => {
	it("creates a form and returns its slug", async () => {
		const db = createTestDb();
		const uid = seedUser(db);
		const result = await createForm(db, uid, { ...base, slug: "meetup" });
		expect(result).toEqual({ ok: true, slug: "meetup" });
		expect(getFormBySlug(db, "meetup")?.title).toBe("Meetup");
	});

	it("rejects a reserved slug", async () => {
		const db = createTestDb();
		const uid = seedUser(db);
		const result = await createForm(db, uid, { ...base, slug: "admin" });
		expect(result).toEqual({ ok: false, error: "That URL is reserved" });
	});

	it("rejects a slug with invalid characters", async () => {
		const db = createTestDb();
		const uid = seedUser(db);
		const result = await createForm(db, uid, { ...base, slug: "My Event" });
		expect(result.ok).toBe(false);
	});

	it("rejects a duplicate slug", async () => {
		const db = createTestDb();
		const uid = seedUser(db);
		await createForm(db, uid, { ...base, slug: "meetup" });
		const result = await createForm(db, uid, { ...base, slug: "meetup" });
		expect(result).toEqual({ ok: false, error: "That URL is already taken" });
	});

	it("rejects a malformed Slack channel id", async () => {
		const db = createTestDb();
		const uid = seedUser(db);
		const result = await createForm(db, uid, {
			...base,
			slug: "meetup",
			slackChannelId: "not-a-channel",
		});
		expect(result).toEqual({ ok: false, error: "Invalid Slack channel ID" });
	});

	it("enforces the three-form limit per user", async () => {
		const db = createTestDb();
		const uid = seedUser(db);
		await createForm(db, uid, { ...base, slug: "a" });
		await createForm(db, uid, { ...base, slug: "b" });
		await createForm(db, uid, { ...base, slug: "c" });
		const result = await createForm(db, uid, { ...base, slug: "d" });
		expect(result).toEqual({
			ok: false,
			error: "You can create up to 3 forms",
		});
	});

	it("requires a title", async () => {
		const db = createTestDb();
		const uid = seedUser(db);
		const result = await createForm(db, uid, {
			...base,
			title: "  ",
			slug: "meetup",
		});
		expect(result).toEqual({ ok: false, error: "Title and URL are required" });
	});
});

describe("deleteForm", () => {
	it("cascades feedback and rsvps before the form", async () => {
		const db = createTestDb();
		const uid = seedUser(db);
		await createForm(db, uid, {
			...base,
			slug: "meetup",
			feedbackEnabled: true,
		});
		const formMaybe = getFormBySlug(db, "meetup");
		expect(formMaybe).toBeDefined();
		// biome-ignore lint/style/noNonNullAssertion: form is asserted above
		const form = formMaybe!;
		const other = seedUser(db, "u2");
		db.insert(rsvps).values({ id: "r1", formId: form.id, userId: other }).run();
		db.insert(feedback)
			.values({ id: "f1", formId: form.id, userId: other, content: "nice" })
			.run();

		deleteForm(db, form.id);

		expect(db.select().from(forms).all()).toHaveLength(0);
		expect(db.select().from(rsvps).all()).toHaveLength(0);
		expect(db.select().from(feedback).all()).toHaveLength(0);
	});
});
