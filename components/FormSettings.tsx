"use client";

import { useActionState } from "react";
import { updateFormAction } from "@/lib/actions/form";
import type { Form } from "@/lib/forms";

const fieldClass =
	"w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all text-sm";

type EditableFormSettings = Pick<
	Form,
	| "id"
	| "isOpen"
	| "isPublic"
	| "feedbackEnabled"
	| "description"
	| "website"
	| "slackChannelId"
>;

export default function FormSettings({ form }: { form: EditableFormSettings }) {
	const [state, action, pending] = useActionState(updateFormAction, {});

	return (
		<form action={action} className="space-y-4">
			<input type="hidden" name="id" value={form.id} />

			<label className="flex items-center gap-3 cursor-pointer select-none">
				<input
					type="checkbox"
					name="isOpen"
					defaultChecked={form.isOpen}
					className="rounded border-zinc-700 bg-zinc-800 text-primary focus:ring-0"
				/>
				<span className="text-sm text-zinc-300">Accepting RSVPs</span>
			</label>

			<label className="flex items-center gap-3 cursor-pointer select-none">
				<input
					type="checkbox"
					name="isPublic"
					defaultChecked={form.isPublic}
					className="rounded border-zinc-700 bg-zinc-800 text-primary focus:ring-0"
				/>
				<span className="text-sm text-zinc-300">Public</span>
			</label>

			<label className="flex items-center gap-3 cursor-pointer select-none">
				<input
					type="checkbox"
					name="feedbackEnabled"
					defaultChecked={form.feedbackEnabled}
					className="rounded border-zinc-700 bg-zinc-800 text-primary focus:ring-0"
				/>
				<span className="text-sm text-zinc-300">Enable feedback</span>
			</label>

			<div className="space-y-1.5 pt-1">
				<label htmlFor="description" className="block text-sm text-zinc-300">
					Description
				</label>
				<textarea
					id="description"
					name="description"
					rows={3}
					defaultValue={form.description ?? ""}
					placeholder="What is this for?"
					className={`${fieldClass} resize-none`}
				/>
			</div>

			<div className="space-y-1.5 pt-1">
				<label htmlFor="website" className="block text-sm text-zinc-300">
					Website
				</label>
				<input
					type="url"
					id="website"
					name="website"
					defaultValue={form.website ?? ""}
					placeholder="https://example.com"
					className={fieldClass}
				/>
				<p className="text-xs text-zinc-600">A link shown on the RSVP page.</p>
			</div>

			<div className="space-y-1.5 pt-1">
				<label htmlFor="slackChannelId" className="block text-sm text-zinc-300">
					Slack channel ID
				</label>
				<input
					id="slackChannelId"
					name="slackChannelId"
					defaultValue={form.slackChannelId ?? ""}
					pattern="[A-Z][A-Z0-9]{6,12}"
					title="Slack channel ID (e.g. C0123456789)"
					placeholder="C0123456789"
					className={fieldClass}
				/>
				<p className="text-xs text-zinc-600">
					People who RSVP will be invited to this channel.
				</p>
			</div>

			{state.error && <p className="text-sm text-red-400">{state.error}</p>}

			<button
				type="submit"
				disabled={pending}
				className="bg-zinc-800 text-zinc-200 px-5 py-2.5 rounded-xl hover:bg-zinc-700 transition-colors text-sm font-medium mt-1 disabled:opacity-60"
			>
				{pending ? "Saving…" : "Save settings"}
			</button>
		</form>
	);
}
