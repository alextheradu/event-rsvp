import { count, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import EnableReminderButton from "@/components/EnableReminderButton";
import NotificationComposer from "@/components/NotificationComposer";
import RetryDeliveryButton from "@/components/RetryDeliveryButton";
import { isAdmin, requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFormBySlug } from "@/lib/forms";
import { getPublicOrigin } from "@/lib/public-origin";
import {
	notificationCampaigns,
	notificationDeliveries,
	rsvps,
	users,
} from "@/lib/schema";
import { eventTemplateValues } from "@/lib/templates";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const user = await requireSession(`/${slug}/manage/notifications`);
	const form = getFormBySlug(db, slug);
	if (!form || (form.creatorId !== user.id && !isAdmin(user))) notFound();
	const campaigns = db
		.select({
			id: notificationCampaigns.id,
			kind: notificationCampaigns.kind,
			audience: notificationCampaigns.audience,
			status: notificationCampaigns.status,
			scheduledAt: notificationCampaigns.scheduledAt,
			total: count(notificationDeliveries.id),
		})
		.from(notificationCampaigns)
		.leftJoin(
			notificationDeliveries,
			eq(notificationDeliveries.campaignId, notificationCampaigns.id),
		)
		.where(eq(notificationCampaigns.formId, form.id))
		.groupBy(notificationCampaigns.id)
		.orderBy(notificationCampaigns.createdAt)
		.all();
	const deliveries = db
		.select({
			id: notificationDeliveries.id,
			campaignId: notificationDeliveries.campaignId,
			status: notificationDeliveries.status,
			error: notificationDeliveries.slackError,
		})
		.from(notificationDeliveries)
		.innerJoin(
			notificationCampaigns,
			eq(notificationDeliveries.campaignId, notificationCampaigns.id),
		)
		.where(eq(notificationCampaigns.formId, form.id))
		.all();
	const attendeeRows = db
		.select()
		.from(rsvps)
		.where(eq(rsvps.formId, form.id))
		.all();
	const host = db
		.select()
		.from(users)
		.where(eq(users.id, form.creatorId))
		.get();
	if (!host) notFound();
	return (
		<div className="max-w-3xl mx-auto space-y-8">
			<h1 className="text-2xl font-bold">Notifications</h1>
			<NotificationComposer
				formId={form.id}
				timezone={form.timezone}
				counts={{
					confirmed: attendeeRows.filter((rsvp) => rsvp.status === "confirmed")
						.length,
					waitlisted: attendeeRows.filter(
						(rsvp) => rsvp.status === "waitlisted",
					).length,
					checkedIn: attendeeRows.filter((rsvp) => rsvp.checkedInAt).length,
				}}
				sampleContext={eventTemplateValues(
					form,
					host.name,
					"Sample Attendee",
					`${getPublicOrigin()}/${form.slug}`,
				)}
			/>
			<section className="space-y-3">
				<h2 className="font-semibold">Delivery history</h2>
				{campaigns.map((campaign) => (
					<div key={campaign.id} className="p-4 rounded-xl bg-zinc-900">
						<div className="flex justify-between">
							<span className="capitalize">
								{campaign.kind.replaceAll("_", " ")}
							</span>
							<span className="text-sm text-zinc-500">{campaign.status}</span>
						</div>
						<p className="text-xs text-zinc-500 mt-2">
							{campaign.audience} · {campaign.total} recipients ·{" "}
							{campaign.scheduledAt?.toLocaleString("en-US") ?? "Draft"}
						</p>
						{campaign.status === "draft" &&
							campaign.kind.startsWith("reminder_") && (
								<EnableReminderButton campaignId={campaign.id} />
							)}
						{(() => {
							const outcomes = deliveries.filter(
								(delivery) => delivery.campaignId === campaign.id,
							);
							const failed = outcomes.filter(
								(delivery) => delivery.status === "failed",
							);
							return (
								<>
									{outcomes.length > 0 && (
										<p className="text-xs text-zinc-500 mt-2">
											{outcomes.filter((d) => d.status === "sent").length} sent
											{" · "}
											{failed.length} failed{" · "}
											{outcomes.filter((d) => d.status === "skipped").length}{" "}
											skipped
										</p>
									)}
									{failed.map((delivery) => (
										<div
											key={delivery.id}
											className="flex gap-3 items-center mt-2 text-xs text-red-300"
										>
											<span>{delivery.error ?? "Slack delivery failed"}</span>
											<RetryDeliveryButton deliveryId={delivery.id} />
										</div>
									))}
								</>
							);
						})()}
					</div>
				))}
				{campaigns.length === 0 && (
					<p className="text-zinc-500">Nothing has been sent yet.</p>
				)}
			</section>
		</div>
	);
}
