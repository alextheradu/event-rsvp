import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { deps } from "@/lib/deps";
import { getFormBySlug } from "@/lib/forms";
import { OAUTH_REDIRECT_URI } from "@/lib/oauth";
import { createRsvp } from "@/lib/rsvp";
import { safeReturnTo } from "@/lib/safe-redirect";
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { slack } from "@/lib/slack";
import { upsertOAuthUser } from "@/lib/users";

interface StoredState {
	state: string;
	returnTo: string;
	action: string;
}

export async function GET(request: NextRequest) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const jar = await cookies();

	let stored: StoredState | null = null;
	try {
		const raw = jar.get("oauth_state")?.value;
		stored = raw ? (JSON.parse(raw) as StoredState) : null;
	} catch {
		stored = null;
	}
	jar.delete("oauth_state");

	const fail = (reason: string) =>
		NextResponse.redirect(new URL(`/?error=${reason}`, url));

	if (!code || !state || !stored || state !== stored.state) {
		return fail("invalid_state");
	}

	const tokenRes = await fetch("https://auth.hackclub.com/oauth/token", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			grant_type: "authorization_code",
			code,
			client_id: process.env.HCA_CLIENT_ID,
			client_secret: process.env.HCA_CLIENT_SECRET,
			redirect_uri: OAUTH_REDIRECT_URI,
		}),
	});
	if (!tokenRes.ok) return fail("token_exchange");

	const tokenData = await tokenRes.json();
	const userRes = await fetch("https://auth.hackclub.com/api/v1/me", {
		headers: { Authorization: `Bearer ${tokenData.access_token}` },
	});
	if (!userRes.ok) return fail("userinfo");

	const raw = await userRes.json();
	const identity = raw.identity ?? raw;
	const slackId: string | null = identity.slack_id || null;

	const profile = slackId ? await slack.getProfile(slackId) : null;

	const sessionUser = await upsertOAuthUser(deps.db, {
		hackclubId: String(identity.id),
		slackId,
		name: profile?.displayName ?? "",
		avatarUrl: profile?.avatarUrl ?? null,
		yswsEligible: deps.allowIneligible || Boolean(identity.ysws_eligible),
	});

	const token = await createSession(sessionUser);
	jar.set(SESSION_COOKIE, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_MAX_AGE,
	});

	// Re-validate on the way out: the cookie is attacker-influenced input, and a value
	// written by an older build (or a tampered cookie) must not be trusted here.
	const returnTo = safeReturnTo(stored.returnTo);

	if (stored.action === "rsvp" && returnTo !== "/") {
		const slug = returnTo.replace(/^\//, "").split("/")[0];
		const form = getFormBySlug(deps.db, slug);
		if (form) await createRsvp(deps, sessionUser.id, form.id);
	}

	return NextResponse.redirect(new URL(returnTo, url));
}
