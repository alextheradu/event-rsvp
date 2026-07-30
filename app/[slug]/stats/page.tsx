import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFormBySlug } from "@/lib/forms";
import { countRsvps } from "@/lib/rsvp";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
	const { slug } = await params;
	const user = await getSession();
	const form = getFormBySlug(db, slug);
	if (!form || (!form.isPublic && (!user || form.creatorId !== user.id))) {
		return { title: "Not found" };
	}

	const total = countRsvps(db, form.id);
	const title = `${form.title} - Stats`;
	const description = `${total} ${total === 1 ? "person" : "people"} RSVP'd for ${form.title}`;

	return {
		title,
		description,
		openGraph: { title, description, type: "website", url: `/${slug}/stats` },
		twitter: { card: "summary", title, description },
	};
}

export default async function StatsPage({ params }: Params) {
	const { slug } = await params;
	const user = await getSession();
	const form = getFormBySlug(db, slug);

	if (!form) notFound();
	if (!form.isPublic && (!user || form.creatorId !== user.id)) notFound();

	const total = countRsvps(db, form.id);
	const isManager = Boolean(
		user && (user.id === form.creatorId || isAdmin(user)),
	);

	return (
		<div className="max-w-2xl mx-auto space-y-4">
			<Link
				href={isManager ? `/${slug}/manage` : `/${slug}`}
				className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
			>
				{isManager ? "Back to manage" : "Back to form"}
			</Link>
			<h1 className="text-2xl font-bold tracking-tight">{form.title}</h1>
			<p className="text-zinc-400">
				{total} {total === 1 ? "person" : "people"} RSVP&apos;d
			</p>
			{form.slackChannelId && (
				<a
					href={`https://hackclub.slack.com/archives/${form.slackChannelId}`}
					className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
					target="_blank"
					rel="noopener noreferrer"
				>
					Join the Slack channel
				</a>
			)}
		</div>
	);
}
