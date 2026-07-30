import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const rawSecret = process.env.SESSION_SECRET;

if (process.env.NODE_ENV === "production" && !rawSecret) {
	throw new Error(
		"SESSION_SECRET must be set in production. Refusing to start with the public dev fallback secret.",
	);
}

const secret = new TextEncoder().encode(
	rawSecret || "dev-fallback-secret-change-in-production",
);

export interface SessionUser {
	id: string;
	name: string;
	email: string;
	avatarUrl: string | null;
	isAllowed: boolean;
	slackId: string | null;
}

export async function createSession(user: SessionUser): Promise<string> {
	return new SignJWT({ ...user })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("7d")
		.sign(secret);
}

export async function verifySession(
	token: string,
): Promise<SessionUser | null> {
	try {
		// Pin the algorithm. Without this, a token signed with the same secret using
		// HS384/HS512 verifies even though we only ever issue HS256.
		const { payload } = await jwtVerify(token, secret, {
			algorithms: ["HS256"],
		});
		return {
			id: payload.id as string,
			name: payload.name as string,
			email: payload.email as string,
			avatarUrl: (payload.avatarUrl as string) || null,
			isAllowed: payload.isAllowed as boolean,
			slackId: (payload.slackId as string) || null,
		};
	} catch {
		return null;
	}
}
