"use server";

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

	if (deps.allowIneligible === false && !user.isAllowed) {
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

	deleteForm(deps.db, id);
	revalidatePath("/");
	redirect("/");
}
