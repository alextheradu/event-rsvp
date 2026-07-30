import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { forms, rsvps } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function Home() {
	const user = await getSession();

	if (!user) {
		return (
			<div className="text-center py-24 max-w-md mx-auto">
				<h1 className="text-4xl font-bold tracking-tight mb-3">RSVP</h1>
				<p className="text-zinc-400 text-lg mb-10 leading-relaxed">
					Quick RSVPs for YSWSes. Create a form, share the link, collect
					responses.
				</p>
				<a
					href="/auth/login"
					className="inline-block bg-primary text-white px-6 py-3.5 rounded-xl hover:bg-primary-dark transition-all font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30"
				>
					Sign in to get started
				</a>
			</div>
		);
	}

	const myForms = db
		.select()
		.from(forms)
		.where(eq(forms.creatorId, user.id))
		.orderBy(desc(forms.createdAt))
		.all();

	const myRsvps = db
		.select()
		.from(rsvps)
		.innerJoin(forms, eq(rsvps.formId, forms.id))
		.where(eq(rsvps.userId, user.id))
		.orderBy(desc(rsvps.createdAt))
		.all()
		.map((r) => ({ rsvp: r.rsvps, form: r.forms }));

	return (
		<div className="max-w-2xl mx-auto space-y-10">
			<h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

			{myForms.length > 0 && (
				<section>
					<h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">
						Your Forms
					</h2>
					<div className="space-y-2">
						{myForms.map((form) => (
							<Link
								key={form.id}
								href={`/${form.slug}/manage`}
								className="block p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/60 hover:border-zinc-700/60 transition-colors"
							>
								<div className="flex items-center justify-between">
									<div>
										<h3 className="font-medium">{form.title}</h3>
										<p className="text-sm text-zinc-500 mt-0.5">/{form.slug}</p>
									</div>
									<span
										className={
											form.isOpen
												? "text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
												: "text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-500"
										}
									>
										{form.isOpen ? "Open" : "Closed"}
									</span>
								</div>
							</Link>
						))}
					</div>
				</section>
			)}

			<section>
				<h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">
					Your RSVPs
				</h2>
				{myRsvps.length === 0 ? (
					<p className="text-zinc-600 text-sm py-8 text-center">
						No RSVPs yet.
					</p>
				) : (
					<div className="space-y-2">
						{myRsvps.map(({ rsvp, form }) => (
							<Link
								key={rsvp.id}
								href={`/${form.slug}`}
								className="block p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/60 hover:border-zinc-700/60 transition-colors"
							>
								<h3 className="font-medium">{form.title}</h3>
								{/* Explicit locale: the Astro original called toLocaleDateString()
								    with no argument, which silently follows the server's LANG and
								    renders differently on the dev machine and in the container. */}
								<p className="text-sm text-zinc-500 mt-0.5">
									RSVP&apos;d {rsvp.createdAt.toLocaleDateString("en-US")}
								</p>
							</Link>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
