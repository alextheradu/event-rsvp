"use client";

import { useState, useTransition } from "react";
import { cancelRsvpAction, rsvpAction } from "@/lib/actions/rsvp";

export function RsvpButton({ formId }: { formId: string }) {
	const [pending, start] = useTransition();
	const [error, setError] = useState<string | null>(null);

	return (
		<div className="space-y-2">
			<button
				type="button"
				disabled={pending}
				onClick={() =>
					start(async () => {
						// Render the reason. Without this a rejected RSVP — closed form,
						// own form, blocked account — looks identical to success: the page
						// revalidates unchanged and the user is left guessing.
						const result = await rsvpAction(formId);
						setError(result.ok ? null : result.error);
					})
				}
				className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-xl transition-colors active:scale-[0.98] disabled:opacity-60"
			>
				{pending ? "RSVPing…" : "RSVP"}
			</button>
			{error && <p className="text-sm text-red-400">{error}</p>}
		</div>
	);
}

export function CancelRsvpButton({ formId }: { formId: string }) {
	const [pending, start] = useTransition();
	const [error, setError] = useState<string | null>(null);

	return (
		<div className="space-y-2 text-center">
			<button
				type="button"
				disabled={pending}
				onClick={() =>
					start(async () => {
						const result = await cancelRsvpAction(formId);
						setError(result.ok ? null : result.error);
					})
				}
				className="text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-60"
			>
				{pending ? "Cancelling…" : "Cancel RSVP"}
			</button>
			{error && <p className="text-sm text-red-400">{error}</p>}
		</div>
	);
}
