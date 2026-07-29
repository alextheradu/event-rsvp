import { describe, expect, it, vi } from "vitest";
import { createSlackClient } from "./slack";

function fakeFetch(responses: Record<string, unknown>) {
	return vi.fn(async (url: string, _options?: unknown) => {
		const method = String(url).split("/api/")[1];
		return {
			json: async () =>
				responses[method] ?? { ok: false, error: "not_stubbed" },
		} as Response;
	});
}

describe("slack client", () => {
	it("returns false instead of throwing when conversations.open fails", async () => {
		const fetchImpl = fakeFetch({
			"conversations.open": { ok: false, error: "user_not_found" },
		});
		const slack = createSlackClient("xoxb-test", fetchImpl as never);
		await expect(slack.dm("U123", "hi")).resolves.toBe(false);
	});

	it("returns false when no bot token is configured", async () => {
		const fetchImpl = fakeFetch({});
		const slack = createSlackClient(undefined, fetchImpl as never);
		await expect(slack.dm("U123", "hi")).resolves.toBe(false);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("posts the message to the opened DM channel", async () => {
		const fetchImpl = fakeFetch({
			"conversations.open": { ok: true, channel: { id: "D1" } },
			"chat.postMessage": { ok: true },
		});
		const slack = createSlackClient("xoxb-test", fetchImpl as never);
		await expect(slack.dm("U123", "hi")).resolves.toBe(true);
		const postCall = fetchImpl.mock.calls.find((c) =>
			String(c[0]).endsWith("chat.postMessage"),
		);
		expect(postCall).toBeDefined();
		expect(String((postCall?.[1] as RequestInit).body)).toContain("channel=D1");
	});

	it("joins a channel before inviting", async () => {
		const fetchImpl = fakeFetch({
			"conversations.join": { ok: true },
			"conversations.invite": { ok: true },
		});
		const slack = createSlackClient("xoxb-test", fetchImpl as never);
		await expect(slack.inviteToChannel("C1", "U123")).resolves.toBe(true);
		expect(
			fetchImpl.mock.calls.map((c) => String(c[0]).split("/api/")[1]),
		).toEqual(["conversations.join", "conversations.invite"]);
	});
});
