import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { geoapifyPlaces } from "@/lib/geoapify";
import { users } from "@/lib/schema";

const buckets = new Map<string, { tokens: number; updatedAt: number }>();

function takeToken(userId: string) {
	const now = Date.now();
	const bucket = buckets.get(userId) ?? { tokens: 10, updatedAt: now };
	bucket.tokens = Math.min(10, bucket.tokens + (now - bucket.updatedAt) / 1000);
	bucket.updatedAt = now;
	if (bucket.tokens < 1) {
		buckets.set(userId, bucket);
		return false;
	}
	bucket.tokens -= 1;
	buckets.set(userId, bucket);
	return true;
}

export async function GET(request: NextRequest) {
	const user = await getSession();
	const current = user
		? db.select().from(users).where(eq(users.id, user.id)).get()
		: null;
	if (!current?.isAllowed) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	if (!takeToken(current.id)) {
		return NextResponse.json(
			{ error: "Too many requests" },
			{ status: 429, headers: { "Cache-Control": "private, no-store" } },
		);
	}
	const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
	if (query.length < 3 || query.length > 100) {
		return NextResponse.json(
			{ error: "Query must be 3–100 characters" },
			{ status: 400, headers: { "Cache-Control": "private, no-store" } },
		);
	}
	const suggestions = await geoapifyPlaces.autocomplete(query);
	return NextResponse.json(suggestions, {
		headers: { "Cache-Control": "private, no-store" },
	});
}
