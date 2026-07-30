"use client";

import { useState, useTransition } from "react";
import { setNotificationPreferenceAction } from "@/lib/actions/preferences";
import CopyButton from "./CopyButton";

export default function NotificationPreference({
	formId,
	enabled,
	eventUrl,
}: {
	formId: string;
	enabled: boolean;
	eventUrl: string;
}) {
	const [value, setValue] = useState(enabled);
	const [pending, start] = useTransition();
	return (
		<div className="space-y-4 border-t border-zinc-800 pt-5">
			<label className="flex cursor-pointer items-start gap-3 select-none">
				<input
					type="checkbox"
					checked={value}
					disabled={pending}
					onChange={(event) => {
						const next = event.target.checked;
						start(async () => {
							const result = await setNotificationPreferenceAction(
								formId,
								next,
							);
							if (result.ok) setValue(next);
						});
					}}
					className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-primary focus:ring-primary/40 disabled:opacity-50"
				/>
				<span>
					<span className="block text-sm font-medium text-zinc-200">
						Reminders &amp; feedback requests
					</span>
					<span className="mt-1 block text-xs leading-relaxed text-zinc-600">
						RSVP status, reschedules, and cancellations are always sent.
					</span>
				</span>
			</label>
			<div className="flex items-center justify-between gap-3">
				<p className="truncate font-mono text-xs text-zinc-600">{eventUrl}</p>
				<CopyButton value={eventUrl} label="Copy RSVP link" />
			</div>
		</div>
	);
}
