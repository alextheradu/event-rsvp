"use client";

import { useTransition } from "react";
import { closeFeedbackAction } from "@/lib/actions/feedback-builder";

export default function CloseFeedbackButton({ formId }: { formId: string }) {
	const [pending, start] = useTransition();
	return (
		<button
			type="button"
			disabled={pending}
			onClick={() => {
				if (window.confirm("Close feedback permanently?")) {
					start(async () => {
						await closeFeedbackAction(formId);
					});
				}
			}}
			className="px-4 py-2 rounded-xl bg-red-950 text-red-300"
		>
			{pending ? "Closing…" : "Close feedback"}
		</button>
	);
}
