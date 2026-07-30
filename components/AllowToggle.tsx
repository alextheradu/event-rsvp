"use client";

import { useTransition } from "react";
import { toggleUserAllowedAction } from "@/lib/actions/admin";

export default function AllowToggle({
	userId,
	isAllowed,
}: {
	userId: string;
	isAllowed: boolean;
}) {
	const [pending, start] = useTransition();

	return (
		<button
			type="button"
			disabled={pending}
			onClick={() => start(() => toggleUserAllowedAction(userId, !isAllowed))}
			className={
				isAllowed
					? "text-xs px-2.5 py-1 rounded-full border transition-colors bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 disabled:opacity-60"
					: "text-xs px-2.5 py-1 rounded-full border transition-colors bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20 disabled:opacity-60"
			}
		>
			{pending ? "Saving…" : isAllowed ? "Allowed" : "Blocked"}
		</button>
	);
}
