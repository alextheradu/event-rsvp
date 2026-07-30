"use client";

import { useActionState, useState } from "react";
import {
	type FeedbackResponseState,
	submitFeedbackResponseAction,
} from "@/lib/actions/feedback-response";

interface Question {
	id: string;
	kind: string;
	prompt: string;
	required: boolean;
	options: string[];
	value: unknown;
}

const field =
	"w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm";

export default function FeedbackResponseForm({
	invitationId,
	signature,
	questions,
	preview = false,
}: {
	invitationId: string;
	signature: string;
	questions: Question[];
	preview?: boolean;
}) {
	const [state, action, pending] = useActionState(
		submitFeedbackResponseAction,
		{} as FeedbackResponseState,
	);
	const [previewSubmitted, setPreviewSubmitted] = useState(false);
	if (!preview && state.success) {
		return (
			<div className="p-5 rounded-xl bg-emerald-950/30 text-emerald-300">
				Thanks—your feedback was saved. You can revisit this link to edit it
				until the host closes the form.
			</div>
		);
	}
	if (preview && previewSubmitted) {
		return (
			<div className="p-5 rounded-xl bg-emerald-950/30 text-emerald-300">
				This is the confirmation attendees see after submitting. (Preview —
				nothing was saved.)
			</div>
		);
	}
	return (
		<form
			action={preview ? undefined : action}
			onSubmit={
				preview
					? (event) => {
							event.preventDefault();
							setPreviewSubmitted(true);
						}
					: undefined
			}
			className="space-y-6"
		>
			{!preview && (
				<>
					<input type="hidden" name="invitationId" value={invitationId} />
					<input type="hidden" name="signature" value={signature} />
				</>
			)}
			{questions.map((question) => (
				<fieldset key={question.id} className="space-y-2">
					<legend className="font-medium">
						{question.prompt}
						{question.required && <span className="text-red-400"> *</span>}
					</legend>
					{question.kind === "short_text" && (
						<input
							className={field}
							name={`question_${question.id}`}
							required={question.required}
							defaultValue={
								typeof question.value === "string" ? question.value : ""
							}
						/>
					)}
					{question.kind === "long_text" && (
						<textarea
							className={field}
							rows={5}
							name={`question_${question.id}`}
							required={question.required}
							defaultValue={
								typeof question.value === "string" ? question.value : ""
							}
						/>
					)}
					{question.kind === "rating_1_5" && (
						<div className="flex gap-4">
							{[1, 2, 3, 4, 5].map((rating) => (
								<label key={rating} className="flex items-center gap-1">
									<input
										type="radio"
										name={`question_${question.id}`}
										value={rating}
										required={question.required}
										defaultChecked={String(question.value) === String(rating)}
									/>
									{rating}
								</label>
							))}
						</div>
					)}
					{(question.kind === "single_choice" ||
						question.kind === "multiple_choice") && (
						<div className="space-y-2">
							{question.options.map((option) => (
								<label key={option} className="flex items-center gap-2">
									<input
										type={
											question.kind === "single_choice" ? "radio" : "checkbox"
										}
										name={`question_${question.id}`}
										value={option}
										required={
											question.required && question.kind === "single_choice"
										}
										defaultChecked={
											Array.isArray(question.value)
												? question.value.includes(option)
												: question.value === option
										}
									/>
									{option}
								</label>
							))}
						</div>
					)}
				</fieldset>
			))}
			{!preview && state.error && (
				<p className="text-sm text-red-400">{state.error}</p>
			)}
			<button
				type="submit"
				disabled={pending}
				className="px-6 py-3 rounded-xl bg-primary text-white disabled:opacity-50"
			>
				{preview
					? "Preview submit (not saved)"
					: pending
						? "Saving…"
						: "Save feedback"}
			</button>
		</form>
	);
}
