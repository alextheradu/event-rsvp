"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession, isAdmin } from "../auth";
import { enqueueChannelAccess } from "../channel-access";
import { setCheckedIn } from "../check-in";
import { deps } from "../deps";
import { feedbackForms, forms, rsvps } from "../schema";

export async function setCheckedInAction(
	rsvpId: string,
	checkedIn: boolean,
	confirmFeedbackCorrection = false,
) {
	const user = await getSession();
	if (!user) return { ok: false, error: "You must sign in" };
	const row = deps.db
		.select({ form: forms })
		.from(rsvps)
		.innerJoin(forms, eq(rsvps.formId, forms.id))
		.where(eq(rsvps.id, rsvpId))
		.get();
	if (!row || (row.form.creatorId !== user.id && !isAdmin(user))) {
		return { ok: false, error: "Not found" };
	}
	const feedbackForm = deps.db
		.select()
		.from(feedbackForms)
		.where(eq(feedbackForms.formId, row.form.id))
		.get();
	if (feedbackForm?.status === "closed") {
		return { ok: false, error: "Attendance is locked after feedback closes" };
	}
	if (feedbackForm?.status === "open" && !confirmFeedbackCorrection) {
		return {
			ok: false,
			error: "Confirm attendance correction after feedback opened",
		};
	}
	const result = setCheckedIn(deps.db, rsvpId, user.id, checkedIn);
	revalidatePath(`/${row.form.slug}/manage`);
	revalidatePath(`/${row.form.slug}/manage/roster`);
	return result;
}

export async function retryChannelAccessAction(rsvpId: string) {
	const user = await getSession();
	if (!user) return { ok: false };
	const row = deps.db
		.select({ form: forms })
		.from(rsvps)
		.innerJoin(forms, eq(rsvps.formId, forms.id))
		.where(eq(rsvps.id, rsvpId))
		.get();
	if (!row || (row.form.creatorId !== user.id && !isAdmin(user))) {
		return { ok: false };
	}
	enqueueChannelAccess(deps.db, rsvpId);
	revalidatePath(`/${row.form.slug}/manage/roster`);
	return { ok: true };
}
