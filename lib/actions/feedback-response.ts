"use server";

import { deps } from "../deps";
import {
	getFeedbackInvitationContext,
	submitFeedbackResponse,
} from "../feedback";

export interface FeedbackResponseState {
	error?: string;
	success?: boolean;
}

export async function submitFeedbackResponseAction(
	_prev: FeedbackResponseState,
	data: FormData,
): Promise<FeedbackResponseState> {
	const invitationId = String(data.get("invitationId") ?? "");
	const signature = String(data.get("signature") ?? "");
	const context = getFeedbackInvitationContext(
		deps.db,
		invitationId,
		signature,
	);
	if (!context) return { error: "Feedback invitation not found" };
	const values = new Map<string, unknown>();
	for (const question of context.questions) {
		const entries = data.getAll(`question_${question.id}`).map(String);
		values.set(
			question.id,
			question.kind === "multiple_choice" ? entries : (entries[0] ?? ""),
		);
	}
	try {
		submitFeedbackResponse(deps.db, invitationId, signature, values);
		return { success: true };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : "Could not save feedback",
		};
	}
}
