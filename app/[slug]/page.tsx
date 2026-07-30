import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FeedbackForm from "@/components/FeedbackForm";
import { CancelRsvpButton, RsvpButton } from "@/components/RsvpButton";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFormBySlug } from "@/lib/forms";
import { feedback, rsvps } from "@/lib/schema";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
	const { slug } = await params;
	const form = getFormBySlug(db, slug);
	if (!form) return { title: "Not found" };

	const title = `RSVP for ${form.title}`;
	const description = form.description || `RSVP for ${form.title}`;

	// This is the page people actually post in Slack, so its og tags matter more
	// than any other page's. Root-layout metadata does not deep-merge openGraph —
	// declaring it here replaces the parent's, which is what we want. `url` has to
	// be spelled out: `metadataBase` alone resolves relative URLs but never emits
	// an `og:url` of its own.
	return {
		title,
		description,
		openGraph: { title, description, type: "website", url: `/${slug}` },
		twitter: { card: "summary", title, description },
	};
}

export default async function FormPage({ params }: Params) {
	const { slug } = await params;
	const user = await getSession();
	const form = getFormBySlug(db, slug);

	if (!form) notFound();
	if (!form.isPublic && (!user || form.creatorId !== user.id)) notFound();

	const userRsvp = user
		? db
				.select()
				.from(rsvps)
				.where(and(eq(rsvps.formId, form.id), eq(rsvps.userId, user.id)))
				.get()
		: undefined;

	const userFeedback = user
		? db
				.select()
				.from(feedback)
				.where(and(eq(feedback.formId, form.id), eq(feedback.userId, user.id)))
				.get()
		: undefined;

	const eligible =
		!user || process.env.NODE_ENV !== "production" || user.isAllowed;
	const isManager = Boolean(
		user && (user.id === form.creatorId || isAdmin(user)),
	);

	if (userRsvp) {
		return (
			<div className="w-full max-w-md space-y-4">
				<div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7 space-y-5">
					<div className="flex items-start gap-3.5">
						<div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
							<svg
								className="w-4 h-4 text-emerald-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2.5}
								aria-hidden="true"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M5 13l4 4L19 7"
								/>
							</svg>
						</div>
						<div>
							<p className="font-semibold text-white leading-snug">
								You&apos;re in!
							</p>
							<p className="text-sm text-zinc-400 mt-0.5">{form.title}</p>
						</div>
					</div>

					{form.feedbackEnabled && !userFeedback && (
						<div className="border-t border-zinc-800 pt-5">
							<FeedbackForm formId={form.id} />
						</div>
					)}

					{form.feedbackEnabled && userFeedback && (
						<div className="border-t border-zinc-800 pt-5">
							<p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
								Your feedback
							</p>
							<p className="text-sm text-zinc-300 leading-relaxed">
								{userFeedback.content}
							</p>
						</div>
					)}
				</div>

				<div className="flex items-center justify-center text-sm">
					<CancelRsvpButton formId={form.id} />
				</div>
			</div>
		);
	}

	return (
		<div className="w-full max-w-md">
			<div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7 space-y-6">
				<div className="space-y-2">
					<h1 className="text-2xl font-bold tracking-tight leading-tight">
						{form.title}
					</h1>
					{form.description && (
						<p className="text-sm text-zinc-400 leading-relaxed">
							{form.description}
						</p>
					)}
					{form.website && (
						<a
							href={form.website}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary-dark transition-colors"
						>
							{form.website.replace(/^https?:\/\//, "")}
						</a>
					)}
				</div>

				<div className="h-px bg-zinc-800" />

				{isManager ? (
					<Link
						href={`/${slug}/manage`}
						className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
					>
						Manage this form
					</Link>
				) : !form.isOpen ? (
					<div className="text-sm text-zinc-500">Submissions are closed</div>
				) : !eligible ? (
					<p className="text-sm text-zinc-500">
						Your account isn&apos;t eligible for YSWS programs.
					</p>
				) : user ? (
					<RsvpButton formId={form.id} />
				) : (
					<a
						href={`/auth/login?return=/${slug}&action=rsvp`}
						className="block w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-xl transition-colors text-center active:scale-[0.98]"
					>
						RSVP
					</a>
				)}
			</div>
		</div>
	);
}
