"use client";

import { useActionState } from "react";
import { updateFormAction } from "@/lib/actions/form";
import type { Form } from "@/lib/forms";
import EventDetailsFields from "./EventDetailsFields";

const fieldClass =
	"w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3.5 py-3 text-sm text-zinc-100 placeholder-zinc-700 transition-colors focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/20";

type EditableFormSettings = Pick<
	Form,
	| "id"
	| "isOpen"
	| "isPublic"
	| "requiresVerification"
	| "feedbackEnabled"
	| "description"
	| "website"
	| "slackChannelId"
	| "startAt"
	| "endAt"
	| "timezone"
	| "eventFormat"
	| "capacity"
	| "attendeeNotes"
	| "locationDisplay"
	| "locationLatitude"
	| "locationLongitude"
	| "locationProvider"
	| "locationPlaceId"
	| "onlineUrl"
>;

export default function FormSettings({ form }: { form: EditableFormSettings }) {
	const [state, action, pending] = useActionState(updateFormAction, {});

	return (
		<form action={action} className="space-y-8">
			<input type="hidden" name="id" value={form.id} />

			<section className="space-y-4">
				<div>
					<h3 className="text-sm font-semibold text-zinc-200">
						RSVP preferences
					</h3>
					<p className="mt-1 text-xs text-zinc-600">
						Control who can discover and join this event.
					</p>
				</div>
				<div className="divide-y divide-zinc-800/80 border-y border-zinc-800/80">
					<label className="flex cursor-pointer items-start gap-3 py-4 select-none">
						<input
							type="checkbox"
							name="isOpen"
							defaultChecked={form.isOpen}
							className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-primary focus:ring-primary/40"
						/>
						<span>
							<span className="block text-sm font-medium text-zinc-200">
								Accepting RSVPs
							</span>
							<span className="mt-1 block text-xs leading-relaxed text-zinc-600">
								People can reserve a spot or join the waitlist.
							</span>
						</span>
					</label>

					<label className="flex cursor-pointer items-start gap-3 py-4 select-none">
						<input
							type="checkbox"
							name="isPublic"
							defaultChecked={form.isPublic}
							className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-primary focus:ring-primary/40"
						/>
						<span>
							<span className="block text-sm font-medium text-zinc-200">
								Public event
							</span>
							<span className="mt-1 block text-xs leading-relaxed text-zinc-600">
								Anyone with the link can view the event.
							</span>
						</span>
					</label>

					<label className="flex cursor-pointer items-start gap-3 py-4 select-none">
						<input
							type="checkbox"
							name="requiresVerification"
							defaultChecked={form.requiresVerification}
							className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-primary focus:ring-primary/40"
						/>
						<span>
							<span className="block text-sm font-medium text-zinc-200">
								Require Hack Club verification
							</span>
							<span className="mt-1 block text-xs leading-relaxed text-zinc-600">
								Only verified, YSWS-eligible Hack Club members can RSVP. Turn
								this off to allow any signed-in Hack Club account.
							</span>
						</span>
					</label>
				</div>
			</section>

			<section className="space-y-5">
				<div>
					<h3 className="text-sm font-semibold text-zinc-200">Event page</h3>
					<p className="mt-1 text-xs text-zinc-600">
						This information appears before someone RSVPs.
					</p>
				</div>
				<div className="space-y-1.5">
					<label htmlFor="description" className="block text-sm text-zinc-400">
						Description
					</label>
					<textarea
						id="description"
						name="description"
						rows={3}
						defaultValue={form.description ?? ""}
						placeholder="What will happen at this event?"
						className={`${fieldClass} resize-none`}
					/>
				</div>
				<EventDetailsFields defaults={form} />
			</section>

			<div className="space-y-3 rounded-xl bg-amber-500/[0.06] p-4 ring-1 ring-inset ring-amber-800/25">
				<p className="text-xs font-semibold tracking-wide text-amber-300 uppercase">
					Attendee-impacting changes
				</p>
				<label className="flex gap-3 text-sm leading-relaxed text-zinc-400">
					<input
						type="checkbox"
						name="confirmChanges"
						className="mt-1 rounded border-zinc-700 bg-zinc-900 text-primary"
					/>
					I reviewed any schedule or location changes.
				</label>
				<label className="flex gap-3 text-sm leading-relaxed text-zinc-400">
					<input
						type="checkbox"
						name="notifyAttendees"
						className="mt-1 rounded border-zinc-700 bg-zinc-900 text-primary"
					/>
					Send confirmed and waitlisted attendees a Slack update.
				</label>
			</div>

			<section className="space-y-5">
				<div>
					<h3 className="text-sm font-semibold text-zinc-200">Links & Slack</h3>
					<p className="mt-1 text-xs text-zinc-600">
						Optional destinations connected to this event.
					</p>
				</div>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-1.5">
						<label htmlFor="website" className="block text-sm text-zinc-400">
							Website
						</label>
						<input
							type="url"
							id="website"
							name="website"
							defaultValue={form.website ?? ""}
							placeholder="https://example.com"
							className={fieldClass}
						/>
					</div>

					<div className="space-y-1.5">
						<label
							htmlFor="slackChannelId"
							className="block text-sm text-zinc-400"
						>
							Slack channel ID
						</label>
						<input
							id="slackChannelId"
							name="slackChannelId"
							defaultValue={form.slackChannelId ?? ""}
							pattern="[A-Z][A-Z0-9]{6,12}"
							title="Slack channel ID (e.g. C0123456789)"
							placeholder="C0123456789"
							className={fieldClass}
						/>
						<p className="text-xs leading-relaxed text-zinc-600">
							For a private channel, type /invite in Slack and add the RSVP bot
							before attendees RSVP.
						</p>
					</div>
				</div>
			</section>

			{state.error && (
				<p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">
					{state.error}
				</p>
			)}

			<button
				type="submit"
				disabled={pending}
				className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark active:translate-y-px disabled:opacity-50"
			>
				{pending ? "Saving…" : "Save settings"}
			</button>
		</form>
	);
}
