import type { APIRoute } from "astro";
import { count, eq } from "drizzle-orm";
import { db } from "../../lib/db";
import { forms, rsvps } from "../../lib/schema";

export const GET: APIRoute = async ({ request }) => {
	const url = new URL(request.url);
	const rsvpSlug = url.searchParams.get("slug");

	if (!rsvpSlug) {
		return new Response("Slug required", { status: 400 });
	}

	const [form] = await db
		.select()
		.from(forms)
		.where(eq(forms.slug, rsvpSlug))
		.limit(1);

	if (!form) {
		return new Response("Form not found", { status: 404 });
	}

	const [{ rsvpCount }] = await db
		.select({ rsvpCount: count() })
		.from(rsvps)
		.where(eq(rsvps.formId, form.id));

	return new Response(JSON.stringify({ count: rsvpCount }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};
