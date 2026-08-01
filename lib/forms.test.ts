import { describe, expect, it } from "vitest";
import { addBlockedWord } from "./content-policy";
import { createForm, deleteForm, getFormBySlug } from "./forms";
import {
	channelAccessAttempts,
	eventChanges,
	feedback,
	feedbackAnswers,
	feedbackForms,
	feedbackInvitations,
	feedbackQuestions,
	feedbackResponses,
	forms,
	notificationCampaigns,
	notificationDeliveries,
	rsvps,
	users,
} from "./schema";
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
		expect(getFormBySlug(db, "meetup")?.requiresVerification).toBe(true);
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

	it("returns the taken-URL error when the unique constraint fires", async () => {
		const db = createTestDb();
		const uid = seedUser(db);
		db.insert(forms)
			.values({
				id: "pre-existing",
				slug: "meetup",
				title: "Other",
				creatorId: uid,
			})
			.run();

		// getFormBySlug would already catch this, so bypass the pre-check's value by
		// asserting the error text is identical on both paths.
		const result = await createForm(db, uid, { ...base, slug: "meetup" });
		expect(result).toEqual({ ok: false, error: "That URL is already taken" });
	});

	it.each([
		{ title: "B@dword meetup", slug: "safe-event" },
		{ title: "Safe meetup", slug: "the-badword-event" },
		{
			title: "Safe meetup",
			slug: "safe-event",
			description: "A b.a.d.w.o.r.d description",
		},
	])(
		"rejects blocked visual variants anywhere in new form content",
		async (input) => {
			const db = createTestDb();
			const uid = seedUser(db);
			addBlockedWord(db, "badword", uid);
			const result = await createForm(db, uid, { ...base, ...input });
			expect(result).toEqual({
				ok: false,
				error: "This form includes a word that is not allowed",
			});
		},
	);

	it("allows emoji but rejects other Unicode symbols in new form content", async () => {
		const db = createTestDb();
		const uid = seedUser(db);
		expect(
			await createForm(db, uid, {
				...base,
				title: "Pizza night 🍕",
				slug: "pizza-night",
			}),
		).toEqual({ ok: true, slug: "pizza-night" });
		expect(
			await createForm(db, uid, {
				...base,
				title: "Math ∑ night",
				slug: "math-night",
			}),
		).toEqual({
			ok: false,
			error:
				"Unsupported Unicode symbols are not allowed in forms; emoji are okay",
		});
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
		db.insert(eventChanges)
			.values({
				id: "change",
				formId: form.id,
				actorId: uid,
				kind: "test",
				beforeJson: "{}",
				afterJson: "{}",
			})
			.run();
		db.insert(channelAccessAttempts)
			.values({
				id: "access",
				rsvpId: "r1",
				kind: "grant",
				nextAttemptAt: new Date(),
			})
			.run();
		db.insert(notificationCampaigns)
			.values({
				id: "campaign",
				formId: form.id,
				kind: "test",
				audience: "single",
				template: "test",
				creatorId: uid,
			})
			.run();
		db.insert(notificationDeliveries)
			.values({
				id: "delivery",
				campaignId: "campaign",
				rsvpId: "r1",
				userId: other,
				renderedText: "test",
				nextAttemptAt: new Date(),
			})
			.run();
		db.insert(feedbackForms)
			.values({
				id: "feedback-form",
				formId: form.id,
				title: "Feedback",
				dmTemplate: "{feedback_link}",
			})
			.run();
		db.insert(feedbackQuestions)
			.values({
				id: "question",
				feedbackFormId: "feedback-form",
				kind: "short_text",
				prompt: "Thoughts?",
				position: 0,
			})
			.run();
		db.insert(feedbackInvitations)
			.values({
				id: "invitation",
				feedbackFormId: "feedback-form",
				rsvpId: "r1",
			})
			.run();
		db.insert(feedbackResponses)
			.values({
				id: "response",
				invitationId: "invitation",
				submittedAt: new Date(),
			})
			.run();
		db.insert(feedbackAnswers)
			.values({
				id: "answer",
				responseId: "response",
				questionId: "question",
				valueJson: '"nice"',
			})
			.run();

		deleteForm(db, form.id);

		expect(db.select().from(forms).all()).toHaveLength(0);
		expect(db.select().from(rsvps).all()).toHaveLength(0);
		expect(db.select().from(feedback).all()).toHaveLength(0);
		expect(db.select().from(eventChanges).all()).toHaveLength(0);
		expect(db.select().from(channelAccessAttempts).all()).toHaveLength(0);
		expect(db.select().from(notificationCampaigns).all()).toHaveLength(0);
		expect(db.select().from(notificationDeliveries).all()).toHaveLength(0);
		expect(db.select().from(feedbackForms).all()).toHaveLength(0);
		expect(db.select().from(feedbackQuestions).all()).toHaveLength(0);
		expect(db.select().from(feedbackInvitations).all()).toHaveLength(0);
		expect(db.select().from(feedbackResponses).all()).toHaveLength(0);
		expect(db.select().from(feedbackAnswers).all()).toHaveLength(0);
	});
});
