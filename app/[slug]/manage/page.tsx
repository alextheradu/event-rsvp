import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import DeleteFormButton from "@/components/DeleteFormButton";
import FormSettings from "@/components/FormSettings";
import { getSession, isAdmin, requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFormBySlug } from "@/lib/forms";
import { getPublicOrigin } from "@/lib/oauth";
import { feedback as feedbackTable, rsvps, users } from "@/lib/schema";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

// `generateMetadata` runs even on requests the page itself rejects, so it repeats
// the authorization check. Without it the <title> would leak a private form's name
// to anyone who guesses the slug.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
	const { slug } = await params;
	const user = await getSession();
	const form = getFormBySlug(db, slug);
	if (!form || !user || (form.creatorId !== user.id && !isAdmin(user))) {
		return { title: "Not found" };
	}
	return { title: `Manage - ${form.title}` };
}

export default async function ManagePage({ params }: Params) {
	const { slug } = await params;
	const user = await requireSession(`/${slug}/manage`);
	const form = getFormBySlug(db, slug);

	if (!form || (form.creatorId !== user.id && !isAdmin(user))) notFound();

	const rsvpList = db
		.select({
			name: users.name,
			avatarUrl: users.avatarUrl,
			rsvpDate: rsvps.createdAt,
			id: rsvps.id,
		})
		.from(rsvps)
		.innerJoin(users, eq(rsvps.userId, users.id))
		.where(eq(rsvps.formId, form.id))
		.orderBy(rsvps.createdAt)
		.all();

	const feedbackList = form.feedbackEnabled
		? db
				.select({
					id: feedbackTable.id,
					content: feedbackTable.content,
					name: users.name,
					avatarUrl: users.avatarUrl,
					createdAt: feedbackTable.createdAt,
				})
				.from(feedbackTable)
				.innerJoin(users, eq(feedbackTable.userId, users.id))
				.where(eq(feedbackTable.formId, form.id))
				.orderBy(feedbackTable.createdAt)
				.all()
		: [];

	const requestHeaders = await headers();
	const siteUrl = getPublicOrigin(
		new Request("http://localhost:4321", { headers: requestHeaders }),
	);

	return (
		<div className="max-w-2xl mx-auto space-y-10">
			<div>
				<Link
					href={`/${slug}`}
					className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
				>
					Back to form
				</Link>
				<h1 className="text-2xl font-bold tracking-tight mt-4">{form.title}</h1>
				<div className="flex items-center gap-3 mt-2">
					<span className="text-zinc-500 text-sm">{rsvpList.length} RSVPs</span>
					<span className="text-zinc-800">·</span>
					<span className="text-xs text-zinc-600 font-mono select-all">
						{siteUrl}/{slug}
					</span>
				</div>
			</div>

			<section className="bg-zinc-900/50 rounded-2xl border border-zinc-800/60 p-6 space-y-5">
				<h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">
					Settings
				</h2>
				<FormSettings
					form={{
						id: form.id,
						isOpen: form.isOpen,
						isPublic: form.isPublic,
						feedbackEnabled: form.feedbackEnabled,
						description: form.description,
						website: form.website,
						slackChannelId: form.slackChannelId,
					}}
				/>
			</section>

			<section>
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">
						RSVPs
					</h2>
					<Link
						href={`/${slug}/stats`}
						className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
					>
						Public stats page
					</Link>
				</div>
				{rsvpList.length === 0 ? (
					<p className="text-zinc-600 text-sm text-center py-10">
						No RSVPs yet.
					</p>
				) : (
					<div className="space-y-1.5">
						{rsvpList.map(({ id, name, avatarUrl, rsvpDate }) => (
							<div
								key={id}
								className="flex items-center gap-3 p-3.5 bg-zinc-900/50 rounded-xl border border-zinc-800/60"
							>
								{avatarUrl ? (
									// biome-ignore lint/performance/noImgElement: avatar URLs are arbitrary remote hosts; next/image would need every one allowlisted.
									<img
										src={avatarUrl}
										alt=""
										className="w-8 h-8 rounded-full"
									/>
								) : (
									<div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm text-zinc-500 font-medium">
										{name.charAt(0).toUpperCase()}
									</div>
								)}
								<span className="flex-1 text-sm font-medium truncate">
									{name}
								</span>
								{/* Explicit locale: the Astro original used the server's LANG,
								    which renders differently per machine. */}
								<span className="text-xs text-zinc-600 shrink-0">
									{rsvpDate.toLocaleDateString("en-US")}
								</span>
							</div>
						))}
					</div>
				)}
			</section>

			{form.feedbackEnabled && (
				<section>
					<h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-4">
						Feedback
					</h2>
					{feedbackList.length === 0 ? (
						<p className="text-zinc-600 text-sm text-center py-10">
							No feedback yet.
						</p>
					) : (
						<div className="space-y-2">
							{feedbackList.map(
								({ id, content, name, avatarUrl, createdAt }) => (
									<div
										key={id}
										className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/60"
									>
										<p className="text-sm text-zinc-300 leading-relaxed">
											{content}
										</p>
										<div className="flex items-center gap-2 mt-3">
											{avatarUrl ? (
												// biome-ignore lint/performance/noImgElement: avatar URLs are arbitrary remote hosts; next/image would need every one allowlisted.
												<img
													src={avatarUrl}
													alt=""
													className="w-5 h-5 rounded-full"
												/>
											) : (
												<div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500 font-medium">
													{name.charAt(0).toUpperCase()}
												</div>
											)}
											<span className="text-xs text-zinc-500">{name}</span>
											<span className="text-xs text-zinc-700">·</span>
											<span className="text-xs text-zinc-600">
												{createdAt.toLocaleDateString("en-US")}
											</span>
										</div>
									</div>
								),
							)}
						</div>
					)}
				</section>
			)}

			<section className="bg-zinc-900/50 rounded-2xl border border-red-900/20 p-6 space-y-3">
				<h2 className="text-sm font-medium text-red-400 uppercase tracking-wide">
					Danger zone
				</h2>
				<DeleteFormButton formId={form.id} />
			</section>
		</div>
	);
}
