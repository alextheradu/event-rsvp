import { and, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import CloseFeedbackButton from "@/components/CloseFeedbackButton";
import { isAdmin, requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFormBySlug } from "@/lib/forms";
import {
	feedbackAnswers,
	feedbackForms,
	feedbackInvitations,
	feedbackQuestions,
	feedbackResponses,
	notificationCampaigns,
	notificationDeliveries,
	rsvps,
	users,
} from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function FeedbackResultsPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const user = await requireSession(`/${slug}/manage/feedback/results`);
	const form = getFormBySlug(db, slug);
	if (!form || (form.creatorId !== user.id && !isAdmin(user))) notFound();
	const feedbackForm = db
		.select()
		.from(feedbackForms)
		.where(eq(feedbackForms.formId, form.id))
		.get();
	if (!feedbackForm) {
		return <p className="max-w-3xl mx-auto">No feedback form yet.</p>;
	}
	const invitations = db
		.select({
			invitation: feedbackInvitations,
			name: users.name,
			responseId: feedbackResponses.id,
		})
		.from(feedbackInvitations)
		.innerJoin(rsvps, eq(feedbackInvitations.rsvpId, rsvps.id))
		.innerJoin(users, eq(rsvps.userId, users.id))
		.leftJoin(
			feedbackResponses,
			eq(feedbackResponses.invitationId, feedbackInvitations.id),
		)
		.where(eq(feedbackInvitations.feedbackFormId, feedbackForm.id))
		.all();
	const responseIds = invitations.flatMap(({ responseId }) =>
		responseId ? [responseId] : [],
	);
	const answers = responseIds.length
		? db
				.select({
					answer: feedbackAnswers,
					question: feedbackQuestions,
				})
				.from(feedbackAnswers)
				.innerJoin(
					feedbackQuestions,
					eq(feedbackAnswers.questionId, feedbackQuestions.id),
				)
				.where(inArray(feedbackAnswers.responseId, responseIds))
				.all()
		: [];
	const namesByResponse = new Map(
		invitations.flatMap(({ responseId, name }) =>
			responseId ? [[responseId, name] as const] : [],
		),
	);
	const deliveryOutcomes = db
		.select({ status: notificationDeliveries.status })
		.from(notificationDeliveries)
		.innerJoin(
			notificationCampaigns,
			eq(notificationDeliveries.campaignId, notificationCampaigns.id),
		)
		.where(
			and(
				eq(notificationCampaigns.formId, form.id),
				eq(notificationCampaigns.kind, "feedback_request"),
			),
		)
		.all();
	const summaryQuestions = [
		...new Map(
			answers.map(({ question }) => [question.id, question] as const),
		).values(),
	].filter((question) =>
		["rating_1_5", "single_choice", "multiple_choice"].includes(question.kind),
	);
	return (
		<div className="max-w-3xl mx-auto space-y-8">
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-2xl font-bold">Feedback results</h1>
					<p className="text-sm text-zinc-500 mt-1">
						{invitations.length} invited ·{" "}
						{deliveryOutcomes.filter(({ status }) => status === "sent").length}{" "}
						delivered ·{" "}
						{
							deliveryOutcomes.filter(({ status }) => status === "failed")
								.length
						}{" "}
						failed ·{" "}
						{invitations.filter(({ invitation }) => invitation.openedAt).length}{" "}
						opened · {responseIds.length} submitted
					</p>
				</div>
				{feedbackForm.status === "open" && (
					<CloseFeedbackButton formId={form.id} />
				)}
			</div>
			{summaryQuestions.length > 0 && (
				<section className="space-y-3">
					<h2 className="font-semibold">Summary</h2>
					{summaryQuestions.map((question) => {
						const values = answers
							.filter(({ question: item }) => item.id === question.id)
							.flatMap(({ answer }) => {
								const value = JSON.parse(answer.valueJson) as unknown;
								return Array.isArray(value)
									? value.map(String)
									: [String(value)];
							})
							.filter(Boolean);
						const counts = Object.entries(
							values.reduce<Record<string, number>>((result, value) => {
								result[value] = (result[value] ?? 0) + 1;
								return result;
							}, {}),
						);
						const average =
							question.kind === "rating_1_5" && values.length
								? values.reduce((sum, value) => sum + Number(value), 0) /
									values.length
								: null;
						return (
							<div key={question.id} className="p-4 rounded-xl bg-zinc-900">
								<p className="font-medium">{question.prompt}</p>
								{average !== null && (
									<p className="text-sm text-zinc-400 mt-1">
										Average: {average.toFixed(2)} / 5
									</p>
								)}
								<p className="text-sm text-zinc-500 mt-1">
									{counts
										.map(([value, total]) => `${value}: ${total}`)
										.join(" · ")}
								</p>
							</div>
						);
					})}
				</section>
			)}
			<div className="space-y-3">
				{answers.map(({ answer, question }) => (
					<div key={answer.id} className="p-4 rounded-xl bg-zinc-900">
						<p className="text-sm text-zinc-500">{question.prompt}</p>
						<p className="mt-1">
							{Array.isArray(JSON.parse(answer.valueJson))
								? (JSON.parse(answer.valueJson) as string[]).join(", ")
								: String(JSON.parse(answer.valueJson))}
						</p>
						<p className="text-xs text-zinc-600 mt-2">
							{namesByResponse.get(answer.responseId)}
						</p>
					</div>
				))}
				{answers.length === 0 && (
					<p className="text-zinc-500">No responses yet.</p>
				)}
			</div>
		</div>
	);
}
