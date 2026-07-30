import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Roster from "@/components/Roster";
import { isAdmin, requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFormBySlug } from "@/lib/forms";
import { feedbackForms, rsvps, users } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function RosterPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const user = await requireSession(`/${slug}/manage/roster`);
	const form = getFormBySlug(db, slug);
	if (!form || (form.creatorId !== user.id && !isAdmin(user))) notFound();
	const rows = db
		.select({
			id: rsvps.id,
			name: users.name,
			status: rsvps.status,
			checkedInAt: rsvps.checkedInAt,
			verificationStatus: rsvps.verificationStatus,
			channelAccessStatus: rsvps.channelAccessStatus,
			notificationsEnabled: rsvps.notificationsEnabled,
			feedbackStatus: feedbackForms.status,
		})
		.from(rsvps)
		.innerJoin(users, eq(rsvps.userId, users.id))
		.leftJoin(feedbackForms, eq(feedbackForms.formId, rsvps.formId))
		.where(eq(rsvps.formId, form.id))
		.orderBy(rsvps.createdAt)
		.all();
	return (
		<div className="max-w-4xl mx-auto space-y-6">
			<h1 className="text-2xl font-bold">{form.title} roster</h1>
			<Roster
				rows={rows.map(({ checkedInAt, feedbackStatus, ...row }) => ({
					...row,
					checkedIn: Boolean(checkedInAt),
					feedbackOpen: feedbackStatus === "open",
				}))}
			/>
		</div>
	);
}
