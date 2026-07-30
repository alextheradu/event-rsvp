"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession, isAdmin } from "../auth";
import { deps } from "../deps";
import {
	closeFeedback,
	type FeedbackQuestionInput,
	saveFeedbackDraft,
	sendFeedbackInvitations,
} from "../feedback";
import { getPublicOrigin } from "../public-origin";
import { forms } from "../schema";
import { eventTemplateValues, renderTemplate } from "../templates";

export interface FeedbackBuilderState {
	error?: string;
	success?: boolean;
}

async function authorize(formId: string) {
	const user = await getSession();
	const form = deps.db.select().from(forms).where(eq(forms.id, formId)).get();
	if (!user || !form || (form.creatorId !== user.id && !isAdmin(user))) {
		return null;
	}
	return { user, form };
}

export async function saveFeedbackBuilderAction(
	_prev: FeedbackBuilderState,
	data: FormData,
): Promise<FeedbackBuilderState> {
	const formId = String(data.get("formId") ?? "");
	const auth = await authorize(formId);
	if (!auth) return { error: "Not found" };
	try {
		const questions = JSON.parse(
			String(data.get("questionsJson") ?? "[]"),
		) as FeedbackQuestionInput[];
		saveFeedbackDraft(deps.db, formId, {
			title: String(data.get("title") ?? ""),
			dmTemplate: String(data.get("dmTemplate") ?? ""),
			questions,
		});
		revalidatePath(`/${auth.form.slug}/manage/feedback`);
		return { success: true };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : "Could not save feedback",
		};
	}
}

export async function sendFeedbackInvitationsAction(formId: string) {
	const auth = await authorize(formId);
	if (!auth) return { ok: false, error: "Not found" };
	try {
		const result = sendFeedbackInvitations(deps.db, formId, auth.user.id);
		revalidatePath(`/${auth.form.slug}/manage/feedback`);
		return { ok: true, ...result };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Could not send feedback",
		};
	}
}

export async function sendFeedbackPreviewAction(
	formId: string,
	dmTemplate: string,
) {
	const auth = await authorize(formId);
	if (!auth) return { ok: false, error: "Not found" };
	if (!auth.user.slackId) {
		return { ok: false, error: "Link a Slack account to preview DMs" };
	}
	let rendered: string;
	try {
		const context = eventTemplateValues(
			auth.form,
			auth.user.name,
			auth.user.name,
			`${getPublicOrigin()}/${auth.form.slug}`,
			`${getPublicOrigin()}/feedback/preview/${formId}`,
		);
		rendered = renderTemplate(dmTemplate, context, { feedback: true });
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Invalid message",
		};
	}
	const sent = await deps.slack.dm(
		auth.user.slackId,
		`👀 *Feedback DM preview* this is what checked-in attendees will see once you send it:\n\n${rendered}`,
	);
	if (!sent) return { ok: false, error: "Could not send preview" };
	return { ok: true };
}

export async function closeFeedbackAction(formId: string) {
	const auth = await authorize(formId);
	if (!auth) return { ok: false, error: "Not found" };
	closeFeedback(deps.db, formId);
	revalidatePath(`/${auth.form.slug}/manage/feedback`);
	return { ok: true };
}
