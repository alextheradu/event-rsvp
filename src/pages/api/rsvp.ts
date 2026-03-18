import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db } from "../../lib/db";
import { feedback, forms, rsvps, users } from "../../lib/schema";
import { inviteToChannel } from "../../lib/slack";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	if (!locals.user) {
		return redirect("/auth/login");
	}

	const data = await request.formData();
	const formId = data.get("formId") as string;
	const method = data.get("_method") as string;

	if (!formId) {
		return new Response("Missing formId", { status: 400 });
	}

	const form = await db.select().from(forms).where(eq(forms.id, formId)).get();
	if (!form) {
		return new Response("Form not found", { status: 404 });
	}

	if (method === "DELETE") {
		await db
			.delete(feedback)
			.where(
				and(eq(feedback.formId, formId), eq(feedback.userId, locals.user.id)),
			);
		await db
			.delete(rsvps)
			.where(and(eq(rsvps.formId, formId), eq(rsvps.userId, locals.user.id)));
	} else {
		if (form.creatorId === locals.user.id) {
			return new Response("Cannot RSVP to your own event", { status: 403 });
		}
		if (!import.meta.env.DEV && !locals.user.isAllowed) {
			return new Response("Not eligible for YSWS programs", { status: 403 });
		}
		if (!form.isOpen) {
			return new Response("Submissions closed", { status: 403 });
		}
		try {
			await db.insert(rsvps).values({
				id: crypto.randomUUID(),
				formId,
				userId: locals.user.id,
			});

			if (form.slackChannelId) {
				const user = await db
					.select()
					.from(users)
					.where(eq(users.id, locals.user.id))
					.get();
				if (user?.slackId) {
					await inviteToChannel(form.slackChannelId, user.slackId);
				}
			}
		} catch {
			// dupe
		}
	}

	return redirect(`/${form.slug}`);
};
