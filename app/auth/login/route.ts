import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { safeReturnTo } from "@/lib/safe-redirect";

export async function GET(request: NextRequest) {
	const clientId = process.env.HCA_CLIENT_ID;
	if (!clientId) {
		return new NextResponse("HCA_CLIENT_ID not configured in .env", {
			status: 500,
		});
	}

	const url = new URL(request.url);
	// Validate on the way in, so an open-redirect payload never reaches the cookie.
	const returnTo = safeReturnTo(url.searchParams.get("return"));
	const action = url.searchParams.get("action") || "";
	const state = crypto.randomUUID();

	(await cookies()).set(
		"oauth_state",
		JSON.stringify({ state, returnTo, action }),
		{
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 600,
		},
	);

	const authUrl = new URL("https://auth.hackclub.com/oauth/authorize");
	authUrl.searchParams.set("client_id", clientId);
	authUrl.searchParams.set(
		"redirect_uri",
		new URL("/oauth/callback", url).toString(),
	);
	authUrl.searchParams.set("response_type", "code");
	authUrl.searchParams.set("scope", "verification_status slack_id");
	authUrl.searchParams.set("state", state);

	return NextResponse.redirect(authUrl);
}
