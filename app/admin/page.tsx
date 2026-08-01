import { and, count, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import AllowToggle from "@/components/AllowToggle";
import BlockedWordsManager from "@/components/BlockedWordsManager";
import { getSession, isAdmin } from "@/lib/auth";
import { getBlockedWords } from "@/lib/content-policy";
import { db } from "@/lib/db";
import { forms, rsvps, users } from "@/lib/schema";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
	const user = await getSession();
	if (!isAdmin(user)) notFound();

	const allUsers = db.select().from(users).orderBy(users.createdAt).all();
	const allBlockedWords = getBlockedWords(db);

	const allForms = db
		.select({
			id: forms.id,
			slug: forms.slug,
			title: forms.title,
			isOpen: forms.isOpen,
			createdAt: forms.createdAt,
			creatorName: users.name,
			rsvpCount: count(rsvps.id),
		})
		.from(forms)
		.leftJoin(users, eq(forms.creatorId, users.id))
		.leftJoin(
			rsvps,
			and(eq(forms.id, rsvps.formId), eq(rsvps.status, "confirmed")),
		)
		.groupBy(forms.id)
		.orderBy(forms.createdAt)
		.all();

	return (
		<div className="max-w-2xl mx-auto space-y-10">
			<h1 className="text-2xl font-bold tracking-tight">Admin</h1>

			<BlockedWordsManager words={allBlockedWords} />

			<section className="space-y-3">
				<h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">
					Users{" "}
					<span className="text-zinc-700 normal-case font-normal">
						({allUsers.length})
					</span>
				</h2>
				<div className="space-y-1.5">
					{allUsers.map((listedUser) => (
						<div
							key={listedUser.id}
							className="flex items-center gap-3 p-3.5 bg-zinc-900/50 rounded-xl border border-zinc-800/60"
						>
							{listedUser.avatarUrl ? (
								// biome-ignore lint/performance/noImgElement: avatar URLs are arbitrary remote hosts; next/image would need every one allowlisted.
								<img
									src={listedUser.avatarUrl}
									alt=""
									className="w-8 h-8 rounded-full shrink-0"
								/>
							) : (
								<div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm text-zinc-500 font-medium shrink-0">
									{(listedUser.name || "?").charAt(0).toUpperCase()}
								</div>
							)}
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium truncate">
									{listedUser.name || (
										<span className="text-zinc-600 italic">unnamed</span>
									)}
								</p>
								<p className="text-xs text-zinc-600">{listedUser.slackId}</p>
							</div>
							<AllowToggle
								userId={listedUser.id}
								isAllowed={listedUser.isAllowed}
							/>
						</div>
					))}
				</div>
			</section>

			<section className="space-y-3">
				<h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">
					Forms{" "}
					<span className="text-zinc-700 normal-case font-normal">
						({allForms.length})
					</span>
				</h2>
				<div className="space-y-1.5">
					{allForms.map((form) => (
						<Link
							key={form.id}
							href={`/${form.slug}/manage`}
							className="flex items-center gap-3 p-3.5 bg-zinc-900/50 rounded-xl border border-zinc-800/60 hover:border-zinc-700/60 transition-colors"
						>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium truncate">{form.title}</p>
								<p className="text-xs text-zinc-600">
									/{form.slug} · {form.creatorName} · {form.rsvpCount} RSVPs
								</p>
							</div>
							<span
								className={
									form.isOpen
										? "text-xs px-2.5 py-1 rounded-full shrink-0 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
										: "text-xs px-2.5 py-1 rounded-full shrink-0 bg-zinc-800 text-zinc-500"
								}
							>
								{form.isOpen ? "Open" : "Closed"}
							</span>
						</Link>
					))}
				</div>
			</section>
		</div>
	);
}
