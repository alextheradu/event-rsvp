import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { DB } from "./db";
import { createCampaign } from "./notifications";
import { getPublicOrigin } from "./public-origin";
import {
	feedbackAnswers,
	feedbackForms,
	feedbackInvitations,
	feedbackQuestions,
	feedbackResponses,
	forms,
	rsvps,
} from "./schema";
import { validateTemplate } from "./templates";

export type FeedbackQuestionKind =
	| "short_text"
	| "long_text"
	| "rating_1_5"
	| "single_choice"
	| "multiple_choice";

export interface FeedbackQuestionInput {
	id?: string;
	kind: FeedbackQuestionKind;
	prompt: string;
	required: boolean;
	options: string[];
}

export const DEFAULT_FEEDBACK_DM =
	"hi {first_name}! thanks for coming to {event_name}. could you share feedback so {host_name} can improve the next event? {feedback_link}";

export function getOrCreateFeedbackForm(db: DB, formId: string) {
	const existing = db
		.select()
		.from(feedbackForms)
		.where(eq(feedbackForms.formId, formId))
		.get();
	if (existing) return existing;
	const id = crypto.randomUUID();
	db.insert(feedbackForms)
		.values({
			id,
			formId,
			title: "Event feedback",
			dmTemplate: DEFAULT_FEEDBACK_DM,
		})
		.run();
	return db
		.select()
		.from(feedbackForms)
		.where(eq(feedbackForms.id, id))
		.get() as typeof feedbackForms.$inferSelect;
}

export function listFeedbackQuestions(db: DB, feedbackFormId: string) {
	return db
		.select()
		.from(feedbackQuestions)
		.where(eq(feedbackQuestions.feedbackFormId, feedbackFormId))
		.orderBy(asc(feedbackQuestions.position))
		.all();
}

export function validateQuestion(input: FeedbackQuestionInput) {
	const prompt = input.prompt.trim();
	if (!prompt || prompt.length > 300) {
		throw new Error("Question must be between 1 and 300 characters");
	}
	const allowed: FeedbackQuestionKind[] = [
		"short_text",
		"long_text",
		"rating_1_5",
		"single_choice",
		"multiple_choice",
	];
	if (!allowed.includes(input.kind)) throw new Error("Invalid question type");
	const options = input.options.map((value) => value.trim()).filter(Boolean);
	if (input.kind === "single_choice" || input.kind === "multiple_choice") {
		if (
			options.length < 2 ||
			options.length > 10 ||
			new Set(options).size !== options.length
		) {
			throw new Error("Choice questions need 2–10 unique options");
		}
	} else if (options.length) {
		throw new Error("This question type cannot have options");
	}
	return { ...input, prompt, options };
}

export function saveFeedbackDraft(
	db: DB,
	formId: string,
	input: {
		title: string;
		dmTemplate: string;
		questions: FeedbackQuestionInput[];
	},
) {
	if (!input.title.trim() || input.title.trim().length > 120) {
		throw new Error("Feedback title is required");
	}
	validateTemplate(input.dmTemplate, { feedback: true });
	if (!input.dmTemplate.includes("{feedback_link}")) {
		throw new Error("DM copy must include {feedback_link}");
	}
	if (input.questions.length > 20) throw new Error("Maximum 20 questions");
	const questions = input.questions.map(validateQuestion);
	return db.transaction((tx) => {
		const feedbackForm = getOrCreateFeedbackForm(tx as DB, formId);
		if (feedbackForm.status !== "draft") {
			throw new Error("Questions are locked after feedback opens");
		}
		tx.update(feedbackForms)
			.set({
				title: input.title.trim(),
				dmTemplate: input.dmTemplate.trim(),
				updatedAt: new Date(),
			})
			.where(eq(feedbackForms.id, feedbackForm.id))
			.run();
		tx.delete(feedbackQuestions)
			.where(eq(feedbackQuestions.feedbackFormId, feedbackForm.id))
			.run();
		for (const [position, question] of questions.entries()) {
			tx.insert(feedbackQuestions)
				.values({
					id: question.id ?? crypto.randomUUID(),
					feedbackFormId: feedbackForm.id,
					kind: question.kind,
					prompt: question.prompt,
					required: question.required,
					position,
					optionsJson:
						question.options.length > 0
							? JSON.stringify(question.options)
							: null,
				})
				.run();
		}
		return feedbackForm.id;
	});
}

function signingKey() {
	const secret =
		process.env.SESSION_SECRET || "dev-fallback-secret-change-in-production";
	return createHash("sha256")
		.update("event-rsvp:feedback-link:v1\0")
		.update(secret)
		.digest();
}

export function signFeedbackInvitation(invitationId: string) {
	return createHmac("sha256", signingKey())
		.update(invitationId)
		.digest("base64url");
}

export function verifyFeedbackInvitation(
	invitationId: string,
	signature: string,
) {
	if (
		!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(invitationId) ||
		!/^[A-Za-z0-9_-]{43}$/.test(signature)
	) {
		return false;
	}
	const expected = Buffer.from(signFeedbackInvitation(invitationId));
	const actual = Buffer.from(signature);
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function sendFeedbackInvitations(
	db: DB,
	formId: string,
	actorId: string,
) {
	const result = db.transaction((tx) => {
		const form = tx.select().from(forms).where(eq(forms.id, formId)).get();
		const feedbackForm = tx
			.select()
			.from(feedbackForms)
			.where(eq(feedbackForms.formId, formId))
			.get();
		if (!form || !feedbackForm) throw new Error("Feedback form not found");
		if (feedbackForm.status !== "draft") {
			const invitations = tx
				.select()
				.from(feedbackInvitations)
				.where(eq(feedbackInvitations.feedbackFormId, feedbackForm.id))
				.all();
			return { form, feedbackForm, invitations, existing: true };
		}
		if (!form.endAt || form.endAt > new Date()) {
			throw new Error("Feedback can only be sent after the event ends");
		}
		const questions = listFeedbackQuestions(tx as DB, feedbackForm.id);
		if (!questions.length) throw new Error("Add at least one question");
		const attendees = tx
			.select()
			.from(rsvps)
			.where(and(eq(rsvps.formId, formId), eq(rsvps.status, "confirmed")))
			.all()
			.filter((rsvp) => rsvp.checkedInAt && rsvp.notificationsEnabled);
		if (!attendees.length) {
			throw new Error("No checked-in attendees can receive feedback");
		}
		const invitations = attendees.map((rsvp) => ({
			id: crypto.randomUUID(),
			feedbackFormId: feedbackForm.id,
			rsvpId: rsvp.id,
		}));
		tx.insert(feedbackInvitations).values(invitations).run();
		tx.update(feedbackForms)
			.set({ status: "open", updatedAt: new Date() })
			.where(eq(feedbackForms.id, feedbackForm.id))
			.run();
		return { form, feedbackForm, invitations, existing: false };
	});
	if (result.existing)
		return { existing: true, invitationCount: result.invitations.length };

	const links = new Map(
		result.invitations.map((invitation) => [
			invitation.rsvpId,
			`${getPublicOrigin()}/feedback/${invitation.id}?sig=${signFeedbackInvitation(invitation.id)}`,
		]),
	);
	let campaign: ReturnType<typeof createCampaign>;
	try {
		campaign = createCampaign(db, {
			formId,
			creatorId: actorId,
			kind: "feedback_request",
			audience: "single",
			template: result.feedbackForm.dmTemplate,
			isOperational: false,
			scheduledAt: new Date(),
			rsvpIds: result.invitations.map(({ rsvpId }) => rsvpId),
			feedbackLinks: links,
		});
	} catch (error) {
		db.transaction((tx) => {
			tx.delete(feedbackInvitations)
				.where(
					inArray(
						feedbackInvitations.id,
						result.invitations.map(({ id }) => id),
					),
				)
				.run();
			tx.update(feedbackForms)
				.set({ status: "draft", updatedAt: new Date() })
				.where(eq(feedbackForms.id, result.feedbackForm.id))
				.run();
		});
		throw error;
	}
	return {
		existing: false,
		invitationCount: result.invitations.length,
		campaignId: campaign.campaignId,
	};
}

export function getFeedbackInvitationContext(
	db: DB,
	invitationId: string,
	signature: string,
) {
	if (!verifyFeedbackInvitation(invitationId, signature)) return null;
	const invitation = db
		.select({
			invitation: feedbackInvitations,
			feedbackForm: feedbackForms,
			form: forms,
			rsvp: rsvps,
		})
		.from(feedbackInvitations)
		.innerJoin(
			feedbackForms,
			eq(feedbackInvitations.feedbackFormId, feedbackForms.id),
		)
		.innerJoin(forms, eq(feedbackForms.formId, forms.id))
		.innerJoin(rsvps, eq(feedbackInvitations.rsvpId, rsvps.id))
		.where(eq(feedbackInvitations.id, invitationId))
		.get();
	if (!invitation || invitation.form.cancelledAt) return null;
	const questions = listFeedbackQuestions(db, invitation.feedbackForm.id);
	const response = db
		.select()
		.from(feedbackResponses)
		.where(eq(feedbackResponses.invitationId, invitationId))
		.get();
	const answers = response
		? db
				.select()
				.from(feedbackAnswers)
				.where(eq(feedbackAnswers.responseId, response.id))
				.all()
		: [];
	if (!invitation.invitation.openedAt) {
		db.update(feedbackInvitations)
			.set({ openedAt: new Date() })
			.where(eq(feedbackInvitations.id, invitationId))
			.run();
	}
	return { ...invitation, questions, response, answers };
}

function validateAnswer(
	question: typeof feedbackQuestions.$inferSelect,
	value: unknown,
) {
	const options = question.optionsJson
		? (JSON.parse(question.optionsJson) as string[])
		: [];
	if (question.kind === "multiple_choice") {
		const values = Array.isArray(value) ? value.map(String) : [];
		if (values.some((item) => !options.includes(item))) {
			throw new Error(`Invalid answer for ${question.prompt}`);
		}
		if (question.required && !values.length)
			throw new Error(`${question.prompt} is required`);
		return values;
	}
	const text = typeof value === "string" ? value.trim() : "";
	if (question.required && !text)
		throw new Error(`${question.prompt} is required`);
	if (!text) return "";
	if (
		question.kind === "rating_1_5" &&
		!["1", "2", "3", "4", "5"].includes(text)
	) {
		throw new Error(`Invalid answer for ${question.prompt}`);
	}
	if (question.kind === "single_choice" && !options.includes(text)) {
		throw new Error(`Invalid answer for ${question.prompt}`);
	}
	if (text.length > (question.kind === "long_text" ? 4_000 : 500)) {
		throw new Error(`${question.prompt} is too long`);
	}
	return text;
}

export function submitFeedbackResponse(
	db: DB,
	invitationId: string,
	signature: string,
	values: ReadonlyMap<string, unknown>,
) {
	const context = getFeedbackInvitationContext(db, invitationId, signature);
	if (!context) throw new Error("Feedback invitation not found");
	if (context.feedbackForm.status !== "open") {
		throw new Error("This feedback form is closed");
	}
	const answers = context.questions.map((question) => ({
		question,
		value: validateAnswer(question, values.get(question.id)),
	}));
	return db.transaction((tx) => {
		const now = new Date();
		const responseId = context.response?.id ?? crypto.randomUUID();
		if (context.response) {
			tx.update(feedbackResponses)
				.set({ updatedAt: now })
				.where(eq(feedbackResponses.id, responseId))
				.run();
			tx.delete(feedbackAnswers)
				.where(eq(feedbackAnswers.responseId, responseId))
				.run();
		} else {
			tx.insert(feedbackResponses)
				.values({
					id: responseId,
					invitationId,
					submittedAt: now,
					updatedAt: now,
				})
				.run();
		}
		if (answers.length) {
			tx.insert(feedbackAnswers)
				.values(
					answers.map(({ question, value }) => ({
						id: crypto.randomUUID(),
						responseId,
						questionId: question.id,
						valueJson: JSON.stringify(value),
					})),
				)
				.run();
		}
		return responseId;
	});
}

export function closeFeedback(db: DB, formId: string) {
	db.update(feedbackForms)
		.set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
		.where(eq(feedbackForms.formId, formId))
		.run();
}
