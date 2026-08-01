"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
	addBlockedWordAction,
	type BlockedWordActionState,
	removeBlockedWordAction,
} from "@/lib/actions/admin";

interface BlockedWordItem {
	id: string;
	word: string;
	normalized: string;
}

function RemoveButton() {
	const { pending } = useFormStatus();
	return (
		<button
			type="submit"
			disabled={pending}
			className="shrink-0 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-500 transition-all hover:border-red-900/60 hover:bg-red-950/30 hover:text-red-400 active:scale-[0.98] disabled:cursor-wait disabled:opacity-50"
		>
			{pending ? "Removing…" : "Remove"}
		</button>
	);
}

export default function BlockedWordsManager({
	words,
}: {
	words: BlockedWordItem[];
}) {
	const [state, action, pending] = useActionState(
		addBlockedWordAction,
		{} as BlockedWordActionState,
	);
	const formRef = useRef<HTMLFormElement>(null);

	useEffect(() => {
		if (state.success) formRef.current?.reset();
	}, [state.success]);

	return (
		<section className="space-y-4 border-t border-zinc-800/70 pt-7">
			<div className="space-y-1.5">
				<div className="flex items-baseline justify-between gap-4">
					<h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
						Blocked RSVP words
					</h2>
					<span className="font-mono text-xs text-zinc-700">
						{words.length}
					</span>
				</div>
				<p className="max-w-[65ch] text-sm leading-relaxed text-zinc-500">
					Stops new forms containing a blocked word, including number, symbol,
					accent, and common alphabet lookalikes. Emoji are allowed; other
					Unicode symbols are rejected.
				</p>
			</div>

			<form ref={formRef} action={action} className="space-y-2">
				<label
					htmlFor="blocked-word"
					className="block text-sm font-medium text-zinc-300"
				>
					Word or phrase
				</label>
				<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
					<input
						id="blocked-word"
						name="word"
						required
						maxLength={80}
						autoComplete="off"
						placeholder="Enter a word"
						className="min-w-0 rounded-xl border border-zinc-800/70 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-700 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
						disabled={pending}
					/>
					<button
						type="submit"
						disabled={pending}
						className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-dark active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
					>
						{pending ? "Adding…" : "Block word"}
					</button>
				</div>
				<p className="text-xs text-zinc-600">
					Matching ignores case, separators, and lookalike substitutions.
				</p>
				{state.error && (
					<p className="rounded-lg border border-red-900/30 bg-red-950/30 px-3 py-2 text-sm text-red-400">
						{state.error}
					</p>
				)}
				{state.success && (
					<p className="rounded-lg border border-emerald-900/30 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-400">
						{state.success}
					</p>
				)}
			</form>

			{words.length === 0 ? (
				<div className="rounded-xl border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-600">
					No words are blocked yet.
				</div>
			) : (
				<div className="divide-y divide-zinc-800/60 border-y border-zinc-800/60">
					{words.map((word) => (
						<div key={word.id} className="flex items-center gap-3 py-3">
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium text-zinc-200">
									{word.word}
								</p>
								{word.normalized !== word.word.toLowerCase() && (
									<p className="truncate font-mono text-xs text-zinc-700">
										matched as {word.normalized}
									</p>
								)}
							</div>
							<form action={removeBlockedWordAction.bind(null, word.id)}>
								<RemoveButton />
							</form>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
