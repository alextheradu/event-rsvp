"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession } from "../auth";
import { deps } from "../deps";
import { getFormById } from "../forms";
import { hasRsvp } from "../rsvp";
import { feedback } from "../schema";

export interface ActionState {
	error?: string;
}

export async function submitFeedbackAction(
	_prev: ActionState,
	data: FormData,
): Promise<ActionState> {
	const user = await getSession();
	if (!user) return { error: "You must be signed in" };

	const formId = String(data.get("formId") ?? "");
	const content = String(data.get("content") ?? "").trim();
	if (!formId || !content) return { error: "Feedback cannot be empty" };

	const form = getFormById(deps.db, formId);
	if (!form?.feedbackEnabled) return { error: "Feedback is not enabled" };

	if (!hasRsvp(deps.db, user.id, formId)) {
		return { error: "You must RSVP before leaving feedback" };
	}

	const existing = deps.db
		.select()
		.from(feedback)
		.where(and(eq(feedback.formId, formId), eq(feedback.userId, user.id)))
		.get();
	if (existing) return {};

	deps.db
		.insert(feedback)
		.values({ id: crypto.randomUUID(), formId, userId: user.id, content })
		.run();

	revalidatePath(`/${form.slug}`);
	return {};
}
