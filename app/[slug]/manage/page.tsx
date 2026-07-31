import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CancelEventButton from "@/components/CancelEventButton";
import CopyButton from "@/components/CopyButton";
import DeleteFormButton from "@/components/DeleteFormButton";
import FormSettings from "@/components/FormSettings";
import SlackChannelSetupNotice from "@/components/SlackChannelSetupNotice";
import { getSession, isAdmin, requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFormBySlug } from "@/lib/forms";
import { getPublicOrigin } from "@/lib/public-origin";
import { feedbackForms, rsvps, users } from "@/lib/schema";

export const dynamic = "force-dynamic";

type Params = {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ created?: string }>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
	const { slug } = await params;
	const user = await getSession();
	const form = getFormBySlug(db, slug);
	if (!form || !user || (form.creatorId !== user.id && !isAdmin(user))) {
		return { title: "Not found" };
	}
	return { title: `Manage - ${form.title}` };
}

export default async function ManagePage({ params, searchParams }: Params) {
	const [{ slug }, { created }] = await Promise.all([params, searchParams]);
	const user = await requireSession(`/${slug}/manage`);
	const form = getFormBySlug(db, slug);
	if (!form || (form.creatorId !== user.id && !isAdmin(user))) notFound();

	const rsvpList = db
		.select({
			name: users.name,
			avatarUrl: users.avatarUrl,
			rsvpDate: rsvps.createdAt,
			id: rsvps.id,
			status: rsvps.status,
			checkedInAt: rsvps.checkedInAt,
			channelAccessStatus: rsvps.channelAccessStatus,
		})
		.from(rsvps)
		.innerJoin(users, eq(rsvps.userId, users.id))
		.where(eq(rsvps.formId, form.id))
		.orderBy(rsvps.createdAt)
		.all();
	const feedbackWorkspace = db
		.select()
		.from(feedbackForms)
		.where(eq(feedbackForms.formId, form.id))
		.get();

	const confirmedCount = rsvpList.filter(
		({ status }) => status === "confirmed",
	).length;
	const waitlistCount = rsvpList.filter(
		({ status }) => status === "waitlisted",
	).length;
	const checkedInCount = rsvpList.filter(
		({ checkedInAt }) => checkedInAt,
	).length;
	const accessAttentionCount = rsvpList.filter(({ channelAccessStatus }) =>
		[
			"failed",
			"verification_needed",
			"verification_unavailable",
			"needs_review",
		].includes(channelAccessStatus),
	).length;
	const eventDate =
		form.startAt && form.timezone
			? new Intl.DateTimeFormat("en-US", {
					dateStyle: "medium",
					timeStyle: "short",
					timeZone: form.timezone,
				}).format(form.startAt)
			: "Schedule not set";
	const eventUrl = `${getPublicOrigin()}/${slug}`;
	const feedbackStatus = feedbackWorkspace?.status ?? "not set up";

	return (
		<div className="space-y-10">
			{created === "slack" && form.slackChannelId && (
				<SlackChannelSetupNotice channelId={form.slackChannelId} />
			)}
			<section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="flex flex-wrap items-center gap-2">
						<span
							className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${
								form.cancelledAt
									? "bg-red-500/10 text-red-300"
									: form.isOpen
										? "bg-emerald-500/10 text-emerald-300"
										: "bg-zinc-800 text-zinc-400"
							}`}
						>
							{form.cancelledAt
								? "Cancelled"
								: form.isOpen
									? "Accepting RSVPs"
									: "RSVPs closed"}
						</span>
						<span className="text-sm text-zinc-500">{eventDate}</span>
					</div>
					<div className="mt-2 flex items-center gap-2">
						<p className="truncate font-mono text-xs text-zinc-600">
							{eventUrl}
						</p>
						<CopyButton value={eventUrl} label="Copy" />
					</div>
				</div>
				<Link
					href={`/${slug}/stats`}
					className="text-sm font-medium text-zinc-400 transition-colors hover:text-white"
				>
					Public stats →
				</Link>
			</section>

			<section
				aria-label="Event totals"
				className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-zinc-800/80 lg:grid-cols-4"
			>
				{[
					["Confirmed", confirmedCount],
					["Waitlisted", waitlistCount],
					["Checked in", checkedInCount],
					["Access issues", accessAttentionCount],
				].map(([label, value]) => (
					<div key={label} className="bg-zinc-900/90 px-5 py-5">
						<p className="text-2xl font-semibold tabular-nums tracking-tight text-white">
							{value}
						</p>
						<p className="mt-1 text-xs font-medium text-zinc-500">{label}</p>
					</div>
				))}
			</section>

			<section>
				<div className="mb-4">
					<p className="text-xs font-semibold tracking-[0.14em] text-zinc-600 uppercase">
						Run the event
					</p>
					<h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
						Your event tools
					</h2>
				</div>
				<div className="grid gap-3 lg:grid-cols-12">
					<Link
						href={`/${slug}/manage/feedback`}
						className="group relative overflow-hidden rounded-2xl bg-primary p-6 text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 lg:col-span-6"
					>
						<div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
						<div className="relative flex min-h-40 flex-col justify-between">
							<div>
								<div className="flex items-center justify-between gap-4">
									<p className="text-xs font-semibold tracking-[0.14em] text-white/65 uppercase">
										Post-event feedback
									</p>
									<span className="rounded-md bg-black/15 px-2 py-1 text-xs font-medium capitalize">
										{feedbackStatus}
									</span>
								</div>
								<h3 className="mt-4 max-w-md text-2xl font-semibold tracking-tight">
									Write your questions and DM attendees after check-in.
								</h3>
							</div>
							<span className="mt-6 text-sm font-semibold">
								Open feedback builder{" "}
								<span className="inline-block transition-transform group-hover:translate-x-1">
									→
								</span>
							</span>
						</div>
					</Link>

					<Link
						href={`/${slug}/manage/roster`}
						className="group flex min-h-40 flex-col justify-between rounded-2xl bg-zinc-900 p-5 ring-1 ring-inset ring-zinc-800 transition-all hover:bg-zinc-800/80 hover:ring-zinc-700 lg:col-span-3"
					>
						<div>
							<p className="text-xs font-semibold tracking-[0.12em] text-zinc-600 uppercase">
								Roster
							</p>
							<h3 className="mt-3 text-lg font-semibold text-white">
								Check in attendees
							</h3>
							<p className="mt-2 text-sm leading-relaxed text-zinc-500">
								Review verification and channel access.
							</p>
						</div>
						<span className="mt-5 text-sm font-medium text-zinc-300 group-hover:text-white">
							Open roster →
						</span>
					</Link>

					<Link
						href={`/${slug}/manage/notifications`}
						className="group flex min-h-40 flex-col justify-between rounded-2xl bg-zinc-900 p-5 ring-1 ring-inset ring-zinc-800 transition-all hover:bg-zinc-800/80 hover:ring-zinc-700 lg:col-span-3"
					>
						<div>
							<p className="text-xs font-semibold tracking-[0.12em] text-zinc-600 uppercase">
								Messages
							</p>
							<h3 className="mt-3 text-lg font-semibold text-white">
								Remind your attendees
							</h3>
							<p className="mt-2 text-sm leading-relaxed text-zinc-500">
								Preview, schedule, and track Slack DMs.
							</p>
						</div>
						<span className="mt-5 text-sm font-medium text-zinc-300 group-hover:text-white">
							Open messages →
						</span>
					</Link>
				</div>
			</section>

			<section className="grid gap-8 border-t border-zinc-800/80 pt-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
				<div className="space-y-6">
					<div>
						<p className="text-xs font-semibold tracking-[0.14em] text-zinc-600 uppercase">
							Configuration
						</p>
						<h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
							Event settings
						</h2>
						<p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
							Changes to time or location can optionally notify everyone
							affected.
						</p>
					</div>
					{form.capacity !== null && confirmedCount > form.capacity && (
						<p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
							This event is {confirmedCount - form.capacity} attendee(s) over
							capacity. Existing confirmations remain in place.
						</p>
					)}
					<FormSettings
						form={{
							id: form.id,
							isOpen: form.isOpen,
							isPublic: form.isPublic,
							requiresVerification: form.requiresVerification,
							feedbackEnabled: form.feedbackEnabled,
							description: form.description,
							website: form.website,
							slackChannelId: form.slackChannelId,
							startAt: form.startAt,
							endAt: form.endAt,
							timezone: form.timezone,
							eventFormat: form.eventFormat,
							capacity: form.capacity,
							attendeeNotes: form.attendeeNotes,
							locationDisplay: form.locationDisplay,
							locationLatitude: form.locationLatitude,
							locationLongitude: form.locationLongitude,
							locationProvider: form.locationProvider,
							locationPlaceId: form.locationPlaceId,
							onlineUrl: form.onlineUrl,
						}}
					/>
				</div>

				<aside className="space-y-8 lg:border-l lg:border-zinc-800/80 lg:pl-8">
					<div>
						<div className="flex items-center justify-between">
							<h2 className="font-semibold text-white">Recent RSVPs</h2>
							<Link
								href={`/${slug}/manage/roster`}
								className="text-xs font-medium text-primary hover:text-red-300"
							>
								View all
							</Link>
						</div>
						{rsvpList.length === 0 ? (
							<p className="py-8 text-center text-sm text-zinc-600">
								No RSVPs yet.
							</p>
						) : (
							<div className="mt-4 divide-y divide-zinc-800/80">
								{rsvpList
									.slice(-5)
									.reverse()
									.map((rsvp) => (
										<div key={rsvp.id} className="flex items-center gap-3 py-3">
											{rsvp.avatarUrl ? (
												// biome-ignore lint/performance/noImgElement: arbitrary Slack avatar hosts cannot be statically allowlisted.
												<img
													src={rsvp.avatarUrl}
													alt=""
													className="h-8 w-8 rounded-lg object-cover"
												/>
											) : (
												<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-xs font-semibold text-zinc-400">
													{rsvp.name.charAt(0).toUpperCase()}
												</div>
											)}
											<div className="min-w-0 flex-1">
												<p className="truncate text-sm font-medium text-zinc-200">
													{rsvp.name}
												</p>
												<p className="text-xs capitalize text-zinc-600">
													{rsvp.status}
												</p>
											</div>
										</div>
									))}
							</div>
						)}
					</div>

					<div className="space-y-4 rounded-xl bg-red-950/15 p-5 ring-1 ring-inset ring-red-900/30">
						<p className="text-xs font-semibold tracking-[0.12em] text-red-400 uppercase">
							Danger zone
						</p>
						<div className="space-y-5">
							<CancelEventButton
								formId={form.id}
								slug={form.slug}
								cancelled={Boolean(form.cancelledAt)}
							/>
							<div className="border-t border-red-900/30 pt-4">
								<DeleteFormButton formId={form.id} />
							</div>
						</div>
					</div>
				</aside>
			</section>
		</div>
	);
}
