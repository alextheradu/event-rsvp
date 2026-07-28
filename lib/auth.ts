import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_COOKIE, type SessionUser, verifySession } from "./session";

export const getSession = cache(async (): Promise<SessionUser | null> => {
	const token = (await cookies()).get(SESSION_COOKIE)?.value;
	if (!token) return null;
	return verifySession(token);
});

export async function requireSession(returnTo?: string): Promise<SessionUser> {
	const user = await getSession();
	if (!user) {
		redirect(
			returnTo
				? `/auth/login?return=${encodeURIComponent(returnTo)}`
				: "/auth/login",
		);
	}
	return user;
}

export function isAdmin(user: SessionUser | null): boolean {
	const adminId = process.env.ADMIN_ID;
	return Boolean(user?.slackId && adminId && user.slackId === adminId);
}
