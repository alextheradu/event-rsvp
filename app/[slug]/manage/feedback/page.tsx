import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import FeedbackBuilder from "@/components/FeedbackBuilder";
import { isAdmin, requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateFeedbackForm, listFeedbackQuestions } from "@/lib/feedback";
import { getFormBySlug } from "@/lib/forms";
import { legacyFeedback, rsvps, users } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function FeedbackManagePage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const user = await requireSession(`/${slug}/manage/feedback`);
	const form = getFormBySlug(db, slug);
	if (!form || (form.creatorId !== user.id && !isAdmin(user))) notFound();
	const feedbackForm = getOrCreateFeedbackForm(db, form.id);
	const questions = listFeedbackQuestions(db, feedbackForm.id).map(
		(question) => ({
			id: question.id,
			kind: question.kind as
				| "short_text"
				| "long_text"
				| "rating_1_5"
				| "single_choice"
				| "multiple_choice",
			prompt: question.prompt,
			required: question.required,
			options: question.optionsJson
				? (JSON.parse(question.optionsJson) as string[])
				: [],
		}),
	);
	const checkedIn = db
		.select()
		.from(rsvps)
		.where(and(eq(rsvps.formId, form.id), eq(rsvps.status, "confirmed")))
		.all()
		.filter((rsvp) => rsvp.checkedInAt).length;
	const legacy = db
		.select({ row: legacyFeedback, name: users.name })
		.from(legacyFeedback)
		.innerJoin(users, eq(legacyFeedback.userId, users.id))
		.where(eq(legacyFeedback.formId, form.id))
		.all();
	const eventEnded = Boolean(form.endAt && form.endAt <= new Date());
	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
						Post-event workflow
					</p>
					<h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
						Feedback
					</h2>
					<p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
						Write the questions and Slack DM here. After the event, the bot
						sends each checked-in attendee a private link to your in-platform
						form.
					</p>
				</div>
				<Link
					href={`/${slug}/manage/feedback/results`}
					className="inline-flex w-fit items-center rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
				>
					View responses →
				</Link>
			</div>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
				<section className="rounded-2xl bg-zinc-900/65 p-5 ring-1 ring-inset ring-zinc-800/80 sm:p-7">
					<FeedbackBuilder
						formId={form.id}
						title={feedbackForm.title}
						dmTemplate={feedbackForm.dmTemplate}
						status={feedbackForm.status}
						initialQuestions={questions}
						canSend={eventEnded && checkedIn > 0}
						eventEnded={eventEnded}
						checkedInCount={checkedIn}
					/>
				</section>

				<aside className="space-y-4">
					<section className="rounded-2xl bg-zinc-900/65 p-5 ring-1 ring-inset ring-zinc-800/80">
						<div className="flex items-center justify-between">
							<h3 className="font-semibold text-white">Send checklist</h3>
							<span
								className={`rounded-md px-2 py-1 text-xs font-medium capitalize ${
									feedbackForm.status === "draft"
										? "bg-zinc-800 text-zinc-400"
										: "bg-emerald-500/10 text-emerald-300"
								}`}
							>
								{feedbackForm.status}
							</span>
						</div>
						<ol className="mt-5 space-y-4 text-sm">
							<li className="flex gap-3">
								<span className="font-mono text-zinc-600">01</span>
								<span
									className={
										questions.length ? "text-zinc-300" : "text-zinc-500"
									}
								>
									Add at least one question
								</span>
							</li>
							<li className="flex gap-3">
								<span className="font-mono text-zinc-600">02</span>
								<span
									className={eventEnded ? "text-zinc-300" : "text-zinc-500"}
								>
									Wait until the event ends
								</span>
							</li>
							<li className="flex gap-3">
								<span className="font-mono text-zinc-600">03</span>
								<span className={checkedIn ? "text-zinc-300" : "text-zinc-500"}>
									Check in attendees ({checkedIn})
								</span>
							</li>
							<li className="flex gap-3">
								<span className="font-mono text-zinc-600">04</span>
								<span className="text-zinc-500">Preview and send the DM</span>
							</li>
						</ol>
						<Link
							href={`/${slug}/manage/roster`}
							className="mt-5 inline-block text-sm font-medium text-primary hover:text-red-300"
						>
							Open check-in roster →
						</Link>
					</section>
				</aside>
			</div>
			{legacy.length > 0 && (
				<section className="space-y-3 border-t border-zinc-800 pt-7">
					<div>
						<h2 className="font-semibold text-white">Legacy feedback</h2>
						<p className="mt-1 text-sm text-zinc-600">
							Responses collected by the previous single-text-box system.
						</p>
					</div>
					{legacy.map(({ row, name }) => (
						<div key={row.id} className="rounded-xl bg-zinc-900 p-4">
							<p>{row.content}</p>
							<p className="text-xs text-zinc-500 mt-2">{name}</p>
						</div>
					))}
				</section>
			)}
		</div>
	);
}
