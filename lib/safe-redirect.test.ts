import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./safe-redirect";

describe("safeReturnTo", () => {
	it("keeps a normal relative path", () => {
		expect(safeReturnTo("/meetup")).toBe("/meetup");
		expect(safeReturnTo("/meetup/manage")).toBe("/meetup/manage");
	});

	it("falls back to / for absent or empty input", () => {
		expect(safeReturnTo(null)).toBe("/");
		expect(safeReturnTo("")).toBe("/");
	});

	it("rejects absolute URLs on another origin", () => {
		expect(safeReturnTo("https://evil.com")).toBe("/");
		expect(safeReturnTo("http://evil.com/path")).toBe("/");
	});

	it("rejects protocol-relative URLs", () => {
		expect(safeReturnTo("//evil.com")).toBe("/");
		expect(safeReturnTo("//evil.com/path")).toBe("/");
	});

	it("rejects backslash-smuggled hosts", () => {
		expect(safeReturnTo("/\\evil.com")).toBe("/");
		expect(safeReturnTo("\\\\evil.com")).toBe("/");
	});

	it("rejects non-http schemes", () => {
		expect(safeReturnTo("javascript:alert(1)")).toBe("/");
		expect(safeReturnTo("data:text/html,x")).toBe("/");
	});

	it("rejects anything not starting with a single slash", () => {
		expect(safeReturnTo("meetup")).toBe("/");
	});

	// `new URL()` strips tab/CR/LF while parsing, so each of these becomes
	// "//evil.com" — a protocol-relative URL — at the sink.
	it("rejects control characters that URL parsing would strip", () => {
		expect(safeReturnTo("/\n/evil.com")).toBe("/");
		expect(safeReturnTo("/\r/evil.com")).toBe("/");
		expect(safeReturnTo("/\t/evil.com")).toBe("/");
	});

	it("keeps the sink from resolving to another origin", () => {
		const base = "http://localhost:4321";
		for (const attack of [
			"/\n/evil.com",
			"/\r/evil.com",
			"/\t/evil.com",
			"//evil.com",
			"/\\evil.com",
			"https://evil.com",
		]) {
			const resolved = new URL(safeReturnTo(attack), base);
			expect(resolved.origin).toBe(base);
		}
	});
});
