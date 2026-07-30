"use client";

import { useActionState, useState } from "react";
import {
	createNotificationAction,
	type NotificationActionState,
} from "@/lib/actions/notifications";
import { renderTemplate, type TemplateContext } from "@/lib/templates";

const field =
	"w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm";

export default function NotificationComposer({
	formId,
	timezone,
	counts,
	sampleContext,
}: {
	formId: string;
	timezone: string | null;
	counts: { confirmed: number; waitlisted: number; checkedIn: number };
	sampleContext: TemplateContext;
}) {
	const [audience, setAudience] = useState<
		"confirmed" | "waitlisted" | "checked_in"
	>("confirmed");
	const [message, setMessage] = useState("");
	const [scheduledAt, setScheduledAt] = useState("");
	const [state, action, pending] = useActionState(
		createNotificationAction,
		{} as NotificationActionState,
	);
	let renderedPreview = message || "Your message preview appears here.";
	if (message) {
		try {
			renderedPreview = renderTemplate(message, sampleContext);
		} catch {
			// The Server Action returns the precise validation error on submit.
		}
	}
	return (
		<form action={action} className="space-y-4 p-5 rounded-2xl bg-zinc-900/50">
			<input type="hidden" name="formId" value={formId} />
			<h2 className="font-semibold">New announcement</h2>
			<p className="text-xs text-zinc-500">
				Current audience sizes: {counts.confirmed} confirmed ·{" "}
				{counts.waitlisted} waitlisted · {counts.checkedIn} checked in
			</p>
			<label className="block space-y-1 text-sm">
				<span>Audience</span>
				<select
					name="audience"
					className={field}
					value={audience}
					onChange={(event) =>
						setAudience(
							event.target.value as "confirmed" | "waitlisted" | "checked_in",
						)
					}
				>
					<option value="confirmed">Confirmed attendees</option>
					<option value="waitlisted">Waitlisted attendees</option>
					<option value="checked_in">Checked-in attendees</option>
				</select>
			</label>
			<label className="block space-y-1 text-sm">
				<span>Message</span>
				<textarea
					name="template"
					rows={5}
					required
					className={field}
					value={message}
					onChange={(event) => setMessage(event.target.value)}
					placeholder="hi {first_name}! an update about {event_name}…"
				/>
			</label>
			<label className="block space-y-1 text-sm">
				<span>Send at ({timezone ?? "UTC"}; leave empty for now)</span>
				<input
					type="datetime-local"
					name="scheduledAt"
					className={field}
					value={scheduledAt}
					onChange={(event) => setScheduledAt(event.target.value)}
				/>
			</label>
			<div className="rounded-xl border border-zinc-800 p-4 text-sm space-y-2">
				<p className="text-xs uppercase tracking-wide text-zinc-500">
					Confirmation preview
				</p>
				<p className="whitespace-pre-wrap text-zinc-300">{renderedPreview}</p>
				<p className="text-xs text-zinc-500">
					{
						{
							confirmed: counts.confirmed,
							waitlisted: counts.waitlisted,
							checked_in: counts.checkedIn,
						}[audience]
					}{" "}
					current recipient(s) ·{" "}
					{scheduledAt ? `${scheduledAt} ${timezone ?? "UTC"}` : "send now"}
				</p>
			</div>
			<p className="text-xs text-zinc-500">
				You are scheduling a non-operational message. Attendee opt-outs are
				respected.
			</p>
			{state.error && <p className="text-sm text-red-400">{state.error}</p>}
			{state.success && (
				<p className="text-sm text-emerald-400">{state.success}</p>
			)}
			<button
				type="submit"
				disabled={pending}
				className="px-5 py-2.5 rounded-xl bg-primary text-white"
			>
				{pending ? "Scheduling…" : "Confirm and schedule"}
			</button>
		</form>
	);
}
