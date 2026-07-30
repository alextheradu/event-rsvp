import type { Metadata } from "next";
import Link from "next/link";
import NewFormForm from "@/components/NewFormForm";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { countFormsByCreator, MAX_FORMS_PER_USER } from "@/lib/forms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New Form - RSVP" };

export default async function NewFormPage() {
	const user = await requireSession("/new");

	const eligible = process.env.NODE_ENV !== "production" || user.isAllowed;
	const formCount = countFormsByCreator(db, user.id);
	const canCreate = eligible && formCount < MAX_FORMS_PER_USER;

	return (
		<div className="max-w-lg mx-auto space-y-8">
			<div>
				<Link
					href="/"
					className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
				>
					Back
				</Link>
				<h1 className="text-2xl font-bold tracking-tight mt-4">
					Create a new form
				</h1>
				<p className="text-zinc-500 text-sm mt-1">
					Set up an RSVP form and share the link.
				</p>
			</div>

			{!eligible && (
				<div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl px-4 py-3 text-sm text-zinc-500">
					Your account is not eligible for YSWS programs. You cannot create
					forms.
				</div>
			)}

			{eligible && formCount >= MAX_FORMS_PER_USER && (
				<div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl px-4 py-3 text-sm text-zinc-500">
					You&apos;ve reached the limit of {MAX_FORMS_PER_USER} forms. Delete an
					existing one to create a new one.
				</div>
			)}

			<NewFormForm canCreate={canCreate} />
		</div>
	);
}
