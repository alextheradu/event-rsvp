import { type NextRequest, NextResponse } from "next/server";
import { deps } from "@/lib/deps";
import { getFormBySlug } from "@/lib/forms";
import { countRsvps } from "@/lib/rsvp";

// Required. Without it Next treats this handler as statically renderable, bakes a
// response at build time, and the count freezes at whatever it was when the image
// was built.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	const slug = new URL(request.url).searchParams.get("slug");
	if (!slug) return new NextResponse("Slug required", { status: 400 });

	const form = getFormBySlug(deps.db, slug);
	if (!form) return new NextResponse("Form not found", { status: 404 });

	// Deliberately reports counts for non-public forms too — this matches the Astro
	// behavior the README documents as a frozen public contract.
	return NextResponse.json({ count: countRsvps(deps.db, form.id) });
}
