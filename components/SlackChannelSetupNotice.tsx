"use client";

import { useEffect, useRef } from "react";

export default function SlackChannelSetupNotice({
	channelId,
}: {
	channelId: string;
}) {
	const dialogRef = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		dialogRef.current?.showModal();

		const url = new URL(window.location.href);
		url.searchParams.delete("created");
		window.history.replaceState(
			window.history.state,
			"",
			url.href.slice(url.origin.length),
		);
	}, []);

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby="slack-setup-title"
			className="fixed top-1/2 left-1/2 m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-700 bg-zinc-900 p-0 text-zinc-100 shadow-2xl shadow-zinc-950/70 backdrop:bg-zinc-950/75 backdrop:backdrop-blur-sm"
		>
			<div className="border-b border-zinc-800 px-6 py-5">
				<p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
					One Slack step left
				</p>
				<h2
					id="slack-setup-title"
					className="mt-2 text-xl font-semibold tracking-tight text-white"
				>
					Add the RSVP bot to your channel
				</h2>
				<p className="mt-2 text-sm leading-relaxed text-zinc-400">
					Slack will not let the bot invite attendees to a private channel until
					the bot is a member.
				</p>
			</div>

			<div className="px-6 py-5">
				<ol className="space-y-4 text-sm text-zinc-300">
					<li className="grid grid-cols-[1.75rem_1fr] gap-3">
						<span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 font-mono text-xs text-zinc-400">
							1
						</span>
						<span className="pt-1">Open the Slack channel.</span>
					</li>
					<li className="grid grid-cols-[1.75rem_1fr] gap-3">
						<span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 font-mono text-xs text-zinc-400">
							2
						</span>
						<span className="pt-1">
							Type{" "}
							<code className="font-mono text-zinc-100">
								/invite @basement_dweller
							</code>
							.
						</span>
					</li>
					<li className="grid grid-cols-[1.75rem_1fr] gap-3">
						<span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 font-mono text-xs text-zinc-400">
							3
						</span>
						<span className="pt-1">
							Confirm that the channel ID is{" "}
							<code className="font-mono text-zinc-100">{channelId}</code>.
						</span>
					</li>
				</ol>

				<form method="dialog" className="mt-6">
					<button
						type="submit"
						className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark active:translate-y-px"
					>
						Got it
					</button>
				</form>
			</div>
		</dialog>
	);
}
