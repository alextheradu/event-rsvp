import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FeedbackResponseForm from "@/components/FeedbackResponseForm";
import { isAdmin, requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateFeedbackForm, listFeedbackQuestions } from "@/lib/feedback";
import { forms } from "@/lib/schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
	title: "Feedback preview",
	robots: { index: false, follow: false },
};

export default async function FeedbackPreviewPage({
	params,
}: {
	params: Promise<{ formId: string }>;
}) {
	const { formId } = await params;
	const user = await requireSession(`/feedback/preview/${formId}`);
	const form = db.select().from(forms).where(eq(forms.id, formId)).get();
	if (!form || (form.creatorId !== user.id && !isAdmin(user))) notFound();
	const feedbackForm = getOrCreateFeedbackForm(db, formId);
	const questions = listFeedbackQuestions(db, feedbackForm.id);
	return (
		<div className="max-w-2xl mx-auto space-y-8">
			<div>
				<p className="text-sm text-zinc-500">{form.title}</p>
				<h1 className="text-3xl font-bold mt-1">{feedbackForm.title}</h1>
				<p className="text-amber-300 text-sm mt-3">
					Preview only — this is what checked-in attendees will see. Nothing
					here gets saved.
				</p>
			</div>
			{questions.length === 0 ? (
				<p className="p-5 rounded-xl bg-zinc-900 text-zinc-400">
					No questions yet — add some in the feedback builder first.
				</p>
			) : (
				<FeedbackResponseForm
					invitationId=""
					signature=""
					preview
					questions={questions.map((question) => ({
						id: question.id,
						kind: question.kind,
						prompt: question.prompt,
						required: question.required,
						options: question.optionsJson
							? (JSON.parse(question.optionsJson) as string[])
							: [],
						value: undefined,
					}))}
				/>
			)}
		</div>
	);
}
