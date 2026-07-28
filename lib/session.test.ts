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
});
