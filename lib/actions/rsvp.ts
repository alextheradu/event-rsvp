"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "../auth";
import { deps } from "../deps";
import { getFormById } from "../forms";
import { cancelRsvp, createRsvp } from "../rsvp";

export async function rsvpAction(formId: string): Promise<void> {
	const user = await getSession();
	if (!user) return;
	await createRsvp(deps, user.id, formId);
	const form = getFormById(deps.db, formId);
	if (form) revalidatePath(`/${form.slug}`);
}

export async function cancelRsvpAction(formId: string): Promise<void> {
	const user = await getSession();
	if (!user) return;
	await cancelRsvp(deps, user.id, formId);
	const form = getFormById(deps.db, formId);
	if (form) revalidatePath(`/${form.slug}`);
}
