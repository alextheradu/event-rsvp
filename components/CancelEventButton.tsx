"use client";

import { useState, useTransition } from "react";
import { cancelEventAction } from "@/lib/actions/event-changes";

export default function CancelEventButton({
	formId,
	slug,
	cancelled,
}: {
	formId: string;
	slug: string;
	cancelled: boolean;
}) {
	const [confirmation, setConfirmation] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [pending, start] = useTransition();
	if (cancelled) return <p className="text-red-400">Event cancelled.</p>;
	return (
		<div className="space-y-2">
			<p className="text-sm text-zinc-500">
				Type <code>{slug}</code> to cancel and notify attendees.
			</p>
			<div className="grid gap-2">
				<input
					value={confirmation}
					onChange={(event) => setConfirmation(event.target.value)}
					aria-label={`Type ${slug} to confirm cancellation`}
					className="min-w-0 w-full rounded-lg border border-red-900/40 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 focus:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-900/30"
				/>
				<button
					type="button"
					disabled={pending}
					onClick={() =>
						start(async () => {
							const result = await cancelEventAction(formId, confirmation);
							setMessage(
								result.ok ? "Event cancelled." : (result.error ?? null),
							);
						})
					}
					className="w-full rounded-lg bg-red-950 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-900/70 disabled:opacity-50"
				>
					Cancel event
				</button>
			</div>
			{message && <p className="text-sm text-zinc-400">{message}</p>}
		</div>
	);
}
