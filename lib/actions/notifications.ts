"use server";

import { Temporal } from "@js-temporal/polyfill";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession, isAdmin } from "../auth";
import { deps } from "../deps";
import { createCampaign, type NotificationAudience } from "../notifications";
import {
	forms,
	notificationCampaigns,
	notificationDeliveries,
} from "../schema";

export interface NotificationActionState {
	error?: string;
	success?: string;
}

export async function enableReminderAction(campaignId: string) {
	const user = await getSession();
	const row = deps.db
		.select({ campaign: notificationCampaigns, form: forms })
		.from(notificationCampaigns)
		.innerJoin(forms, eq(notificationCampaigns.formId, forms.id))
		.where(eq(notificationCampaigns.id, campaignId))
		.get();
	if (
		!user ||
		!row ||
		(row.form.creatorId !== user.id && !isAdmin(user)) ||
		row.campaign.status !== "draft"
	) {
		return { ok: false, error: "Not found" };
	}
	if (!row.campaign.scheduledAt || row.campaign.scheduledAt <= new Date()) {
		return { ok: false, error: "This reminder time has already passed" };
	}
	const result = createCampaign(deps.db, {
		formId: row.form.id,
		creatorId: user.id,
		kind: row.campaign.kind,
		audience: row.campaign.audience as NotificationAudience,
		template: row.campaign.template,
		isOperational: row.campaign.isOperational,
		scheduledAt: row.campaign.scheduledAt,
	});
	deps.db
		.update(notificationCampaigns)
		.set({ status: "cancelled", updatedAt: new Date() })
		.where(eq(notificationCampaigns.id, campaignId))
		.run();
	revalidatePath(`/${row.form.slug}/manage/notifications`);
	return { ok: true, recipientCount: result.recipientCount };
}

export async function retryDeliveryAction(deliveryId: string) {
	const user = await getSession();
	const row = deps.db
		.select({
			delivery: notificationDeliveries,
			campaign: notificationCampaigns,
			form: forms,
		})
		.from(notificationDeliveries)
		.innerJoin(
			notificationCampaigns,
			eq(notificationDeliveries.campaignId, notificationCampaigns.id),
		)
		.innerJoin(forms, eq(notificationCampaigns.formId, forms.id))
		.where(eq(notificationDeliveries.id, deliveryId))
		.get();
	if (
		!user ||
		!row ||
		(row.form.creatorId !== user.id && !isAdmin(user)) ||
		row.delivery.status !== "failed"
	) {
		return { ok: false };
	}
	deps.db
		.update(notificationDeliveries)
		.set({
			status: "queued",
			attempts: 0,
			nextAttemptAt: new Date(),
			leaseOwner: null,
			leasedAt: null,
			completedAt: null,
		})
		.where(eq(notificationDeliveries.id, deliveryId))
		.run();
	deps.db
		.update(notificationCampaigns)
		.set({ status: "sending", updatedAt: new Date() })
		.where(eq(notificationCampaigns.id, row.campaign.id))
		.run();
	revalidatePath(`/${row.form.slug}/manage/notifications`);
	return { ok: true };
}

export async function createNotificationAction(
	_prev: NotificationActionState,
	data: FormData,
): Promise<NotificationActionState> {
	const user = await getSession();
	const formId = String(data.get("formId") ?? "");
	const form = deps.db.select().from(forms).where(eq(forms.id, formId)).get();
	if (!user || !form || (form.creatorId !== user.id && !isAdmin(user))) {
		return { error: "Not found" };
	}
	try {
		const rawSchedule = String(data.get("scheduledAt") ?? "");
		const scheduledAt = rawSchedule
			? new Date(
					Temporal.PlainDateTime.from(rawSchedule).toZonedDateTime(
						form.timezone ?? "UTC",
						{
							disambiguation: "reject",
						},
					).epochMilliseconds,
				)
			: new Date();
		if (scheduledAt < new Date()) {
			throw new Error("Send time cannot be in the past");
		}
		const result = createCampaign(deps.db, {
			formId,
			creatorId: user.id,
			kind: "announcement",
			audience: String(data.get("audience")) as NotificationAudience,
			template: String(data.get("template") ?? ""),
			isOperational: false,
			scheduledAt,
		});
		revalidatePath(`/${form.slug}/manage/notifications`);
		return { success: `Queued ${result.recipientCount} delivery(s).` };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : "Could not schedule",
		};
	}
}
