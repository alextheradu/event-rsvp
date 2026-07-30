"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession, isAdmin } from "../auth";
import { deps } from "../deps";
import { createCampaign } from "../notifications";
import { eventChanges, forms } from "../schema";

export async function cancelEventAction(formId: string, confirmation: string) {
	const user = await getSession();
	const form = deps.db.select().from(forms).where(eq(forms.id, formId)).get();
	if (!user || !form || (form.creatorId !== user.id && !isAdmin(user))) {
		return { ok: false, error: "Not found" };
	}
	if (confirmation !== form.slug) {
		return { ok: false, error: `Type ${form.slug} to confirm` };
	}
	if (!form.cancelledAt) {
		deps.db.transaction((tx) => {
			tx.update(forms)
				.set({
					cancelledAt: new Date(),
					isOpen: false,
					updatedAt: new Date(),
				})
				.where(eq(forms.id, formId))
				.run();
			tx.insert(eventChanges)
				.values({
					id: crypto.randomUUID(),
					formId,
					actorId: user.id,
					kind: "event_cancelled",
					beforeJson: JSON.stringify({ cancelledAt: null }),
					afterJson: JSON.stringify({ cancelledAt: new Date().toISOString() }),
				})
				.run();
		});
		for (const audience of ["confirmed", "waitlisted"] as const) {
			createCampaign(deps.db, {
				formId,
				creatorId: user.id,
				kind: "event_cancelled",
				audience,
				template: "{event_name} has been cancelled.",
				isOperational: true,
				scheduledAt: new Date(),
			});
		}
	}
	revalidatePath(`/${form.slug}`);
	revalidatePath(`/${form.slug}/manage`);
	return { ok: true };
}
