"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "../auth";
import { deps } from "../deps";
import {
	createForm,
	deleteForm,
	getFormById,
	SLACK_CHANNEL_RE,
	updateForm,
} from "../forms";
import { users } from "../schema";
import type { ActionState } from "./feedback";

function str(data: FormData, key: string): string | null {
	const value = String(data.get(key) ?? "").trim();
	return value === "" ? null : value;
}

export async function createFormAction(
	_prev: ActionState,
	data: FormData,
): Promise<ActionState> {
	const user = await getSession();
	if (!user) redirect("/auth/login?return=/new");

	// Read eligibility from the database, not the session. The session JWT lives up
	// to 7 days, so trusting it would let someone an admin just blocked keep creating
	// forms until it expires. `createRsvp` already reads from the row for the same
	// reason; this keeps the two consistent.
	const row = deps.db.select().from(users).where(eq(users.id, user.id)).get();
	if (!deps.allowIneligible && !row?.isAllowed) {
		return { error: "Your account is not eligible for YSWS programs" };
	}

	const result = await createForm(deps.db, user.id, {
		title: String(data.get("title") ?? ""),
		slug: String(data.get("slug") ?? ""),
		description: str(data, "description"),
		website: str(data, "website"),
		slackChannelId: str(data, "slackChannelId"),
		feedbackEnabled: data.has("feedbackEnabled"),
	});

	if (!result.ok) return { error: result.error };
	redirect(`/${result.slug}/manage`);
}

export async function updateFormAction(
	_prev: ActionState,
	data: FormData,
): Promise<ActionState> {
	const user = await getSession();
	if (!user) redirect("/auth/login");

	const id = String(data.get("id") ?? "");
	const form = getFormById(deps.db, id);
	if (!form || (form.creatorId !== user.id && !isAdmin(user))) {
		return { error: "Not found" };
	}

	const slackChannelId = str(data, "slackChannelId");
	if (slackChannelId && !SLACK_CHANNEL_RE.test(slackChannelId)) {
		return { error: "Invalid Slack channel ID" };
	}

	updateForm(deps.db, id, {
		isOpen: data.has("isOpen"),
		isPublic: data.has("isPublic"),
		feedbackEnabled: data.has("feedbackEnabled"),
		description: str(data, "description"),
		website: str(data, "website"),
		slackChannelId,
	});

	revalidatePath(`/${form.slug}`);
	revalidatePath(`/${form.slug}/manage`);
	return {};
}

export async function deleteFormAction(id: string): Promise<void> {
	const user = await getSession();
	if (!user) redirect("/auth/login");

	const form = getFormById(deps.db, id);
	if (!form || (form.creatorId !== user.id && !isAdmin(user))) return;

	const slug = form.slug;
	deleteForm(deps.db, id);
	// Revalidate the deleted form's own routes too, not just the dashboard —
	// otherwise those paths keep serving cached content for a form that is gone.
	revalidatePath("/");
	revalidatePath(`/${slug}`);
	revalidatePath(`/${slug}/manage`);
	revalidatePath(`/${slug}/stats`);
	redirect("/");
}
