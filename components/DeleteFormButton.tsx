"use client";

import { useTransition } from "react";
import { deleteFormAction } from "@/lib/actions/form";

export default function DeleteFormButton({ formId }: { formId: string }) {
	const [pending, start] = useTransition();

	return (
		<button
			type="button"
			disabled={pending}
			onClick={() => {
				if (
					confirm("Delete this form and all its data? This cannot be undone.")
				) {
					start(() => deleteFormAction(formId));
				}
			}}
			className="bg-red-950/30 text-red-400 px-5 py-2.5 rounded-xl hover:bg-red-950/50 transition-colors text-sm font-medium disabled:opacity-60"
		>
			{pending ? "Deleting…" : "Delete form"}
		</button>
	);
}
