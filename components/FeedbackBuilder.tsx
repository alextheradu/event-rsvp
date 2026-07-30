"use client";

import { useActionState, useState, useTransition } from "react";
import {
	type FeedbackBuilderState,
	saveFeedbackBuilderAction,
	sendFeedbackInvitationsAction,
	sendFeedbackPreviewAction,
} from "@/lib/actions/feedback-builder";
import type { FeedbackQuestionInput } from "@/lib/feedback";

const field =
	"w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3.5 py-3 text-sm text-zinc-100 placeholder-zinc-700 transition-colors focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function FeedbackBuilder({
	formId,
	title,
	dmTemplate,
	status,
	initialQuestions,
	canSend,
	eventEnded,
	checkedInCount,
}: {
	formId: string;
	title: string;
	dmTemplate: string;
	status: string;
	initialQuestions: FeedbackQuestionInput[];
	canSend: boolean;
	eventEnded: boolean;
	checkedInCount: number;
}) {
	const [questions, setQuestions] = useState(initialQuestions);
	const [dmTemplateValue, setDmTemplateValue] = useState(dmTemplate);
	const [state, action, pending] = useActionState(
		saveFeedbackBuilderAction,
		{} as FeedbackBuilderState,
	);
	const [sending, startSending] = useTransition();
	const [sendMessage, setSendMessage] = useState<string | null>(null);
	const [previewing, startPreview] = useTransition();
	const [previewMessage, setPreviewMessage] = useState<string | null>(null);
	const locked = status !== "draft";
	return (
		<div className="space-y-8">
			<form action={action} className="space-y-7">
				<input type="hidden" name="formId" value={formId} />
				<input
					type="hidden"
					name="questionsJson"
					value={JSON.stringify(questions)}
				/>
				<div>
					<p className="text-xs font-semibold tracking-[0.12em] text-zinc-600 uppercase">
						Form setup
					</p>
					<h3 className="mt-1 text-lg font-semibold text-white">
						Questions attendees will answer
					</h3>
				</div>
				<label className="block space-y-1.5 text-sm text-zinc-400">
					<span>Form title</span>
					<input
						className={field}
						name="title"
						defaultValue={title}
						disabled={locked}
					/>
				</label>
				<label className="block space-y-1.5 text-sm text-zinc-400">
					<span>Slack DM copy</span>
					<textarea
						className={field}
						name="dmTemplate"
						rows={4}
						value={dmTemplateValue}
						onChange={(event) => setDmTemplateValue(event.target.value)}
						disabled={locked}
					/>
					<span className="text-xs text-zinc-500">
						Variables: {"{first_name}"}, {"{event_name}"}, {"{event_date}"},{" "}
						{"{event_time}"}, {"{timezone}"}, {"{location}"}, {"{host_name}"},{" "}
						{"{event_link}"}, {"{feedback_link}"}
					</span>
				</label>
				<div className="flex flex-wrap items-center gap-3">
					<button
						type="button"
						disabled={previewing || !dmTemplateValue.trim()}
						onClick={() =>
							startPreview(async () => {
								const result = await sendFeedbackPreviewAction(
									formId,
									dmTemplateValue,
								);
								setPreviewMessage(
									result.ok
										? "Sent — check your Slack DMs."
										: (result.error ?? "Could not send preview"),
								);
							})
						}
						className="rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
					>
						{previewing ? "Sending…" : "Send preview to yourself"}
					</button>
					{previewMessage && (
						<span className="text-xs text-zinc-500">{previewMessage}</span>
					)}
				</div>
				<div className="space-y-3">
					{questions.map((question, index) => (
						<article
							key={question.id ?? index}
							className="space-y-4 rounded-xl bg-zinc-950/55 p-4 ring-1 ring-inset ring-zinc-800"
						>
							<p className="text-xs font-semibold text-zinc-600">
								Question {index + 1}
							</p>
							<input
								className={field}
								value={question.prompt}
								disabled={locked}
								placeholder={`Question ${index + 1}`}
								onChange={(event) =>
									setQuestions((current) =>
										current.map((item, itemIndex) =>
											itemIndex === index
												? { ...item, prompt: event.target.value }
												: item,
										),
									)
								}
							/>
							<div className="flex flex-wrap gap-3">
								<select
									className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
									value={question.kind}
									disabled={locked}
									onChange={(event) =>
										setQuestions((current) =>
											current.map((item, itemIndex) =>
												itemIndex === index
													? {
															...item,
															kind: event.target
																.value as FeedbackQuestionInput["kind"],
															options: event.target.value.includes("choice")
																? item.options.length >= 2
																	? item.options
																	: ["Option 1", "Option 2"]
																: [],
														}
													: item,
											),
										)
									}
								>
									<option value="short_text">Short text</option>
									<option value="long_text">Long text</option>
									<option value="rating_1_5">1–5 rating</option>
									<option value="single_choice">Single choice</option>
									<option value="multiple_choice">Multiple choice</option>
								</select>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={question.required}
										disabled={locked}
										onChange={(event) =>
											setQuestions((current) =>
												current.map((item, itemIndex) =>
													itemIndex === index
														? { ...item, required: event.target.checked }
														: item,
												),
											)
										}
									/>
									Required
								</label>
								<button
									type="button"
									disabled={locked || index === 0}
									onClick={() =>
										setQuestions((current) => {
											const next = [...current];
											[next[index - 1], next[index]] = [
												next[index],
												next[index - 1],
											];
											return next;
										})
									}
									className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
								>
									Up
								</button>
								<button
									type="button"
									disabled={locked || index === questions.length - 1}
									onClick={() =>
										setQuestions((current) => {
											const next = [...current];
											[next[index], next[index + 1]] = [
												next[index + 1],
												next[index],
											];
											return next;
										})
									}
									className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
								>
									Down
								</button>
								<button
									type="button"
									disabled={locked}
									onClick={() =>
										setQuestions((current) =>
											current.filter((_, itemIndex) => itemIndex !== index),
										)
									}
									className="rounded-md px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10"
								>
									Remove
								</button>
							</div>
							{question.kind.includes("choice") && (
								<textarea
									className={field}
									disabled={locked}
									value={question.options.join("\n")}
									placeholder="One option per line"
									onChange={(event) =>
										setQuestions((current) =>
											current.map((item, itemIndex) =>
												itemIndex === index
													? {
															...item,
															options: event.target.value.split("\n"),
														}
													: item,
											),
										)
									}
								/>
							)}
						</article>
					))}
				</div>
				{!locked && questions.length < 20 && (
					<button
						type="button"
						onClick={() =>
							setQuestions((current) => [
								...current,
								{
									id: crypto.randomUUID(),
									kind: "short_text",
									prompt: "",
									required: false,
									options: [],
								},
							])
						}
						className="rounded-lg border border-dashed border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-white"
					>
						Add question
					</button>
				)}
				{state.error && <p className="text-red-400 text-sm">{state.error}</p>}
				{state.success && <p className="text-emerald-400 text-sm">Saved.</p>}
				{!locked && (
					<button
						type="submit"
						disabled={pending}
						className="rounded-lg bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-white disabled:opacity-50"
					>
						{pending ? "Saving…" : "Save feedback form"}
					</button>
				)}
			</form>
			<div className="space-y-3 border-t border-zinc-800 pt-7">
				<div>
					<p className="text-xs font-semibold tracking-[0.12em] text-zinc-600 uppercase">
						Send
					</p>
					<h3 className="mt-1 text-lg font-semibold text-white">
						DM checked-in attendees
					</h3>
					{!eventEnded && (
						<p className="mt-2 text-sm text-zinc-500">
							This unlocks after the event ends.
						</p>
					)}
					{eventEnded && checkedInCount === 0 && (
						<p className="mt-2 text-sm text-zinc-500">
							Check in at least one attendee before sending.
						</p>
					)}
					{canSend && (
						<p className="mt-2 text-sm text-zinc-400">
							Ready to send to {checkedInCount} checked-in attendee
							{checkedInCount === 1 ? "" : "s"}.
						</p>
					)}
				</div>
				<button
					type="button"
					disabled={!canSend || locked || sending}
					onClick={() =>
						startSending(async () => {
							const result = await sendFeedbackInvitationsAction(formId);
							setSendMessage(
								result.ok && "invitationCount" in result
									? `Queued ${result.invitationCount} invitation(s).`
									: (result.error ?? "Could not send"),
							);
						})
					}
					className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-dark active:translate-y-px disabled:cursor-not-allowed disabled:opacity-35"
				>
					{sending ? "Queuing…" : "Send feedback to checked-in attendees"}
				</button>
				{sendMessage && <p className="text-sm text-zinc-400">{sendMessage}</p>}
			</div>
		</div>
	);
}
