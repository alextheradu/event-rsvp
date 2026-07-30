import { describe, expect, it } from "vitest";
import {
	getFeedbackInvitationContext,
	saveFeedbackDraft,
	sendFeedbackInvitations,
	signFeedbackInvitation,
	submitFeedbackResponse,
	verifyFeedbackInvitation,
} from "./feedback";
import {
	feedbackAnswers,
	feedbackInvitations,
	feedbackResponses,
	forms,
	rsvps,
	users,
} from "./schema";
import { createTestDb } from "./test-db";

describe("structured feedback", () => {
	it("creates signed invitations and one editable response", () => {
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
				endAt: new Date(Date.now() - 60_000),
			})
			.run();
		db.insert(rsvps)
			.values({
				id: "rsvp",
				formId: "form",
				userId: "guest",
				checkedInAt: new Date(),
				checkedInBy: "host",
			})
			.run();
		saveFeedbackDraft(db, "form", {
			title: "How was it?",
			dmTemplate: "hi {first_name}! {feedback_link}",
			questions: [
				{
					id: "question",
					kind: "rating_1_5",
					prompt: "Rating",
					required: true,
					options: [],
				},
			],
		});
		expect(sendFeedbackInvitations(db, "form", "host").invitationCount).toBe(1);
		const invitation = db.select().from(feedbackInvitations).get();
		expect(invitation).toBeDefined();
		if (!invitation) throw new Error("missing invitation");
		const signature = signFeedbackInvitation(invitation.id);
		expect(verifyFeedbackInvitation(invitation.id, signature)).toBe(true);
		expect(verifyFeedbackInvitation(invitation.id, `${signature}x`)).toBe(
			false,
		);
		const context = getFeedbackInvitationContext(db, invitation.id, signature);
		expect(context?.questions).toHaveLength(1);
		submitFeedbackResponse(
			db,
			invitation.id,
			signature,
			new Map([["question", "5"]]),
		);
		submitFeedbackResponse(
			db,
			invitation.id,
			signature,
			new Map([["question", "4"]]),
		);
		expect(db.select().from(feedbackResponses).all()).toHaveLength(1);
		expect(
			JSON.parse(db.select().from(feedbackAnswers).get()?.valueJson ?? ""),
		).toBe("4");
	});
});
