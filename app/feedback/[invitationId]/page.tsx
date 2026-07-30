import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FeedbackResponseForm from "@/components/FeedbackResponseForm";
import { db } from "@/lib/db";
import { getFeedbackInvitationContext } from "@/lib/feedback";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
	title: "Event feedback",
	robots: { index: false, follow: false },
};

export default async function FeedbackPage({
	params,
	searchParams,
}: {
	params: Promise<{ invitationId: string }>;
	searchParams: Promise<{ sig?: string }>;
}) {
	const { invitationId } = await params;
	const { sig = "" } = await searchParams;
	const context = getFeedbackInvitationContext(db, invitationId, sig);
	if (!context) notFound();
	const answerMap = new Map(
		context.answers.map((answer) => [
			answer.questionId,
			JSON.parse(answer.valueJson) as unknown,
		]),
	);
	return (
		<div className="max-w-2xl mx-auto space-y-8">
			<div>
				<p className="text-sm text-zinc-500">{context.form.title}</p>
				<h1 className="text-3xl font-bold mt-1">
					{context.feedbackForm.title}
				</h1>
				<p className="text-zinc-400 mt-3">
					Your answers are identified to the event host.
				</p>
			</div>
			{context.feedbackForm.status === "closed" ? (
				<p className="p-5 rounded-xl bg-zinc-900">
					This feedback form is closed. Thanks for taking part.
				</p>
			) : (
				<FeedbackResponseForm
					invitationId={invitationId}
					signature={sig}
					questions={context.questions.map((question) => ({
						id: question.id,
						kind: question.kind,
						prompt: question.prompt,
						required: question.required,
						options: question.optionsJson
							? (JSON.parse(question.optionsJson) as string[])
							: [],
						value: answerMap.get(question.id),
					}))}
				/>
			)}
		</div>
	);
}
