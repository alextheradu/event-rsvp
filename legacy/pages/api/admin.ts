import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db } from "../../lib/db";
import { users } from "../../lib/schema";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	if (!locals.user || locals.user.slackId !== import.meta.env.ADMIN_ID) {
		return new Response("Forbidden", { status: 403 });
	}

	const data = await request.formData();
	const userId = data.get("userId") as string;
	const isAllowed = data.get("isAllowed") === "1";

	if (!userId) {
		return new Response("Missing userId", { status: 400 });
	}

	await db.update(users).set({ isAllowed }).where(eq(users.id, userId));

	return redirect("/admin");
};
