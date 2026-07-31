"use client";

import { useActionState, useRef, useState } from "react";
import { createFormAction } from "@/lib/actions/form";
import EventDetailsFields from "./EventDetailsFields";

const inputClass =
	"w-full bg-zinc-900/50 border border-zinc-800/60 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all disabled:opacity-50";

export default function NewFormForm({ canCreate }: { canCreate: boolean }) {
	const [state, action, pending] = useActionState(createFormAction, {});
	const formRef = useRef<HTMLFormElement>(null);
	const dialogRef = useRef<HTMLDialogElement>(null);
	// The dialog's confirm button calls `requestSubmit()`, which re-fires `onSubmit`.
	// Without this latch the handler would reopen the dialog forever and the action
	// would never run.
	const confirmed = useRef(false);
	const [preview, setPreview] = useState({ title: "", slug: "" });

	return (
		<>
			{state.error && (
				<div className="bg-red-950/30 border border-red-900/30 text-red-400 rounded-xl px-4 py-3 text-sm">
					{state.error}
				</div>
			)}

			<form
				ref={formRef}
				action={action}
				onSubmit={(e) => {
					if (confirmed.current) {
						confirmed.current = false;
						return;
					}
					e.preventDefault();
					const data = new FormData(e.currentTarget);
					setPreview({
						title: String(data.get("title") ?? "").trim(),
						slug: String(data.get("slug") ?? "").trim(),
					});
					dialogRef.current?.showModal();
				}}
				className="space-y-6"
			>
				<div className="space-y-1.5">
					<label
						htmlFor="title"
						className="block text-sm font-medium text-zinc-300"
					>
						Title
					</label>
					<input
						id="title"
						name="title"
						required
						disabled={!canCreate}
						className={inputClass}
						placeholder="My event"
					/>
				</div>

				<div className="space-y-1.5">
					<label
						htmlFor="slug"
						className="block text-sm font-medium text-zinc-300"
					>
						URL
					</label>
					<div className="flex items-center gap-1">
						<span className="text-zinc-600 text-sm shrink-0">/</span>
						<input
							id="slug"
							name="slug"
							required
							pattern="[a-z0-9\-]+"
							disabled={!canCreate}
							className={inputClass}
							placeholder="my-event"
						/>
					</div>
					<p className="text-xs text-zinc-600">
						Lowercase letters, numbers, and hyphens only.
					</p>
				</div>

				<div className="space-y-1.5">
					<label
						htmlFor="description"
						className="block text-sm font-medium text-zinc-300"
					>
						Description <span className="text-zinc-600">(optional)</span>
					</label>
					<textarea
						id="description"
						name="description"
						rows={3}
						disabled={!canCreate}
						className={`${inputClass} resize-none`}
						placeholder="What is this for?"
					/>
				</div>

				<div className="space-y-1.5">
					<label
						htmlFor="website"
						className="block text-sm font-medium text-zinc-300"
					>
						Website <span className="text-zinc-600">(optional)</span>
					</label>
					<input
						type="url"
						id="website"
						name="website"
						disabled={!canCreate}
						className={inputClass}
						placeholder="https://example.com"
					/>
					<p className="text-xs text-zinc-600">
						A link shown on the RSVP page.
					</p>
				</div>

				<div className="space-y-1.5">
					<label
						htmlFor="slackChannelId"
						className="block text-sm font-medium text-zinc-300"
					>
						Slack channel ID <span className="text-zinc-600">(optional)</span>
					</label>
					<input
						id="slackChannelId"
						name="slackChannelId"
						disabled={!canCreate}
						pattern="[A-Z][A-Z0-9]{6,12}"
						title="Slack channel ID (e.g. C0123456789)"
						className={inputClass}
						placeholder="C0123456789"
					/>
					<p className="text-xs text-zinc-600">
						People who RSVP will be invited to this channel. For a private
						channel, run{" "}
						<code className="rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-zinc-300">
							/invite @basement dweller
						</code>{" "}
						first.
					</p>
				</div>

				<EventDetailsFields />

				<button
					type="submit"
					disabled={!canCreate || pending}
					className={
						canCreate
							? "w-full px-6 py-3.5 rounded-xl transition-all font-medium bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/20 active:scale-[0.98]"
							: "w-full px-6 py-3.5 rounded-xl font-medium bg-zinc-800 text-zinc-600 cursor-not-allowed"
					}
				>
					{pending ? "Creating…" : "Create form"}
				</button>
			</form>

			<dialog
				ref={dialogRef}
				className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 m-0 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full backdrop:bg-black/60 backdrop:backdrop-blur-sm"
			>
				<h2 className="text-base font-semibold text-zinc-100 mb-2">
					Before you create
				</h2>
				<p className="text-sm text-zinc-400 mb-1">
					The URL and name{" "}
					<span className="text-zinc-200 font-medium">cannot be changed</span>{" "}
					after creation.
				</p>
				<ul className="text-sm text-zinc-500 mt-3 mb-5 space-y-1">
					<li>
						Name:{" "}
						<span className="text-zinc-300 font-medium">{preview.title}</span>
					</li>
					<li>
						URL: <span className="text-zinc-600">/</span>
						<span className="text-zinc-300 font-mono">{preview.slug}</span>
					</li>
				</ul>
				<div className="flex gap-3">
					<button
						type="button"
						onClick={() => dialogRef.current?.close()}
						className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors text-sm font-medium"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={() => {
							dialogRef.current?.close();
							confirmed.current = true;
							formRef.current?.requestSubmit();
						}}
						className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors text-sm font-medium shadow-lg shadow-primary/20"
					>
						Create form
					</button>
				</div>
			</dialog>
		</>
	);
}
