import { describe, expect, it } from "vitest";
import { createSession, verifySession } from "./session";

const user = {
	id: "u1",
	name: "Ada",
	email: "",
	avatarUrl: null,
	isAllowed: true,
	slackId: "U123",
};

describe("session", () => {
	it("round-trips a user", async () => {
		const token = await createSession(user);
		expect(await verifySession(token)).toEqual(user);
	});

	it("rejects a tampered token", async () => {
		const token = await createSession(user);
		const tampered = `${token.slice(0, -3)}aaa`;
		expect(await verifySession(tampered)).toBeNull();
	});

	it("rejects garbage", async () => {
		expect(await verifySession("not-a-jwt")).toBeNull();
	});

	it("rejects a token signed with a different HMAC algorithm", async () => {
		const { SignJWT } = await import("jose");
		const secret = new TextEncoder().encode(
			process.env.SESSION_SECRET || "dev-fallback-secret-change-in-production",
		);
		const hs512 = await new SignJWT({ ...user })
			.setProtectedHeader({ alg: "HS512" })
			.setIssuedAt()
			.setExpirationTime("7d")
			.sign(secret);

		expect(await verifySession(hs512)).toBeNull();
	});
});
