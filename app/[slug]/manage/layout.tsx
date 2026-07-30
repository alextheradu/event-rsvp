import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import ManageNav from "@/components/ManageNav";
import { isAdmin, requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFormBySlug } from "@/lib/forms";

export default async function ManageLayout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const user = await requireSession(`/${slug}/manage`);
	const form = getFormBySlug(db, slug);
	if (!form || (form.creatorId !== user.id && !isAdmin(user))) notFound();
	return (
		<div className="mx-auto w-full max-w-5xl">
			<header className="mb-8 border-b border-zinc-800/80">
				<div className="flex flex-col gap-5 pb-1 sm:flex-row sm:items-end sm:justify-between">
					<div className="min-w-0">
						<Link
							href="/"
							className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-200"
						>
							← All events
						</Link>
						<p className="mt-5 text-xs font-semibold tracking-[0.16em] text-primary uppercase">
							Event workspace
						</p>
						<h1 className="mt-1 truncate text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
							{form.title}
						</h1>
					</div>
					<Link
						href={`/${slug}`}
						className="mb-3 inline-flex w-fit items-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-900/70 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-all hover:border-zinc-600 hover:bg-zinc-800 hover:text-white active:translate-y-px"
					>
						View event
						<span aria-hidden="true">↗</span>
					</Link>
				</div>
				<ManageNav slug={slug} />
			</header>
			{children}
		</div>
	);
}
