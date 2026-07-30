"use client";

import { useState, useTransition } from "react";
import { enableReminderAction } from "@/lib/actions/notifications";

export default function EnableReminderButton({
	campaignId,
}: {
	campaignId: string;
}) {
	const [pending, start] = useTransition();
	const [error, setError] = useState<string | null>(null);
	return (
		<>
			<button
				type="button"
				disabled={pending}
				onClick={() =>
					start(async () => {
						const result = await enableReminderAction(campaignId);
						setError(result.ok ? null : (result.error ?? "Could not enable"));
					})
				}
				className="text-xs text-primary mt-2"
			>
				{pending ? "Enabling…" : "Enable reminder"}
			</button>
			{error && <p className="text-xs text-red-400 mt-1">{error}</p>}
		</>
	);
}
