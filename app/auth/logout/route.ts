import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/oauth";
import { SESSION_COOKIE } from "@/lib/session";

export async function GET(request: NextRequest) {
	(await cookies()).delete(SESSION_COOKIE);
	return NextResponse.redirect(new URL("/", `${getPublicOrigin(request)}/`));
}
