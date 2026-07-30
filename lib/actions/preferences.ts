"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession } from "../auth";
import { deps } from "../deps";
import { addRsvpToScheduledCampaigns } from "../notifications";
import {
	forms,
	notificationCampaigns,
	notificationDeliveries,
	rsvps,
} from "../schema";

export async function setNotificationPreferenceAction(
	formId: string,
	enabled: boolean,
) {
	const user = await getSession();
	if (!user) return { ok: false };
	const rsvp = deps.db
		.select()
		.from(rsvps)
		.where(and(eq(rsvps.formId, formId), eq(rsvps.userId, user.id)))
		.get();
	if (!rsvp || (rsvp.status !== "confirmed" && rsvp.status !== "waitlisted")) {
		return { ok: false };
	}
	deps.db.transaction((tx) => {
		tx.update(rsvps)
			.set({ notificationsEnabled: enabled })
			.where(eq(rsvps.id, rsvp.id))
			.run();
		if (!enabled) {
			const campaignIds = tx
				.select({ id: notificationCampaigns.id })
				.from(notificationCampaigns)
				.where(
					and(
						eq(notificationCampaigns.formId, formId),
						eq(notificationCampaigns.isOperational, false),
					),
				)
				.all()
				.map(({ id }) => id);
			for (const campaignId of campaignIds) {
				tx.update(notificationDeliveries)
					.set({
						status: "skipped",
						slackError: "attendee_opted_out",
						completedAt: new Date(),
					})
					.where(
						and(
							eq(notificationDeliveries.campaignId, campaignId),
							eq(notificationDeliveries.rsvpId, rsvp.id),
							eq(notificationDeliveries.status, "queued"),
						),
					)
					.run();
			}
		}
	});
	if (enabled) addRsvpToScheduledCampaigns(deps.db, rsvp.id);
	const form = deps.db.select().from(forms).where(eq(forms.id, formId)).get();
	if (form) revalidatePath(`/${form.slug}`);
	return { ok: true };
}
