import { describe, expect, it } from "vitest";
import { resolvePublicOrigins } from "./public-origin";

describe("resolvePublicOrigins", () => {
	it("normalizes, deduplicates, and preserves a canonical first origin", () => {
		expect(
			resolvePublicOrigins(
				" https://events.example.com/,https://alt.example.com,https://events.example.com ",
				"production",
			),
		).toEqual({
			primary: "https://events.example.com",
			all: ["https://events.example.com", "https://alt.example.com"],
			allowedHosts: ["events.example.com", "alt.example.com"],
		});
	});

	it.each([
		"ftp://example.com",
		"https://user@example.com",
		"https://example.com/path",
		"https://example.com?x=1",
		"https://example.com#x",
		"not a url",
	])("rejects unsafe origin %s", (value) => {
		expect(() => resolvePublicOrigins(value, "production")).toThrow();
	});

	it("fails closed in production", () => {
		expect(() => resolvePublicOrigins(undefined, "production")).toThrow(
			"PUBLIC_URL",
		);
	});

	it("uses the fixed development origin", () => {
		expect(resolvePublicOrigins(undefined, "development").primary).toBe(
			"http://localhost:4321",
		);
	});
});
