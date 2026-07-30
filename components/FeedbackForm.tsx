"use client";

import { useActionState } from "react";
import { submitFeedbackAction } from "@/lib/actions/feedback";

export default function FeedbackForm({ formId }: { formId: string }) {
	const [state, action, pending] = useActionState(submitFeedbackAction, {});

	return (
		<form action={action} className="space-y-3">
			<input type="hidden" name="formId" value={formId} />
			<div>
				<p className="text-sm font-medium text-zinc-200">Got any feedback?</p>
				<p className="text-xs text-zinc-500 mt-0.5">
					Goes directly to the organizer.
				</p>
			</div>
			<textarea
				name="content"
				rows={3}
				required
				placeholder="Share your thoughts..."
				className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all resize-none text-sm"
			/>
			{state.error && <p className="text-sm text-red-400">{state.error}</p>}
			<button
				type="submit"
				disabled={pending}
				className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
			>
				{pending ? "Sending…" : "Send"}
			</button>
		</form>
	);
}
