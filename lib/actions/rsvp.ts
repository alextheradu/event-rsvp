"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "../auth";
import { deps } from "../deps";
import { getFormById } from "../forms";
import { cancelRsvp, createRsvp, type RsvpFailure } from "../rsvp";

export type RsvpActionResult = { ok: true } | { ok: false; error: string };

const RSVP_FAILURE_MESSAGES: Record<RsvpFailure, string> = {
	not_found: "This form no longer exists.",
	closed: "Submissions are closed.",
	own_form: "You can't RSVP to your own event.",
	ineligible: "Your account isn't eligible for YSWS programs.",
};

/**
 * Returns a result rather than void. Discarding it would make a rejected RSVP —
 * closed form, own form, blocked account — indistinguishable from success at the
 * call site: the user clicks RSVP, the page revalidates unchanged, and nothing
 * explains why. The caller renders `error` when present.
 */
export async function rsvpAction(formId: string): Promise<RsvpActionResult> {
	const user = await getSession();
	if (!user) return { ok: false, error: "You must be signed in." };

	const result = await createRsvp(deps, user.id, formId);
	const form = getFormById(deps.db, formId);
	if (form) revalidatePath(`/${form.slug}`);

	if (!result.ok) {
		return { ok: false, error: RSVP_FAILURE_MESSAGES[result.reason] };
	}
	return { ok: true };
}

export async function cancelRsvpAction(
	formId: string,
): Promise<RsvpActionResult> {
	const user = await getSession();
	if (!user) return { ok: false, error: "You must be signed in." };

	await cancelRsvp(deps, user.id, formId);
	const form = getFormById(deps.db, formId);
	if (form) revalidatePath(`/${form.slug}`);
	return { ok: true };
}
