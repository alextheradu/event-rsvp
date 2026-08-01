import { describe, expect, it } from "vitest";
import {
	addBlockedWord,
	containsBlockedWord,
	getBlockedWords,
	hasOnlyAllowedUnicode,
	normalizeBlockedWord,
	removeBlockedWord,
} from "./content-policy";
import { users } from "./schema";
import { createTestDb } from "./test-db";

function seedAdmin(db: ReturnType<typeof createTestDb>) {
	db.insert(users)
		.values({
			id: "admin",
			hackclubId: "h-admin",
			name: "Admin",
			email: "",
			isAllowed: true,
		})
		.run();
}

describe("blocked-word matching", () => {
	it.each([
		["badword", true],
		["A BADWORD event", true],
		["b@dw0rd", true],
		["b.a.d.w.o.r.d", true],
		["bádwörd", true],
		["bаdwοrd", true],
		["friendly meetup", false],
	])("checks visual variants in %s", (candidate, expected) => {
		expect(containsBlockedWord(candidate, "badword")).toBe(expected);
	});

	it("handles ambiguous one/pipe substitutions", () => {
		expect(containsBlockedWord("k1ll", "kill")).toBe(true);
		expect(containsBlockedWord("a||", "all")).toBe(true);
	});

	it("normalizes an admin-entered word", () => {
		expect(normalizeBlockedWord("  Bád Wörd ")).toBe("badword");
	});
});

describe("Unicode content policy", () => {
	it("allows regular Unicode text and emoji sequences", () => {
		expect(hasOnlyAllowedUnicode("Café meetup — bring snacks 🍕 👩🏽‍💻")).toBe(
			true,
		);
	});

	it.each(["Math ∑ meetup", "Price ¥100", "Arrow → here", "hidden\u200btext"])(
		"rejects unsupported Unicode in %s",
		(value) => expect(hasOnlyAllowedUnicode(value)).toBe(false),
	);
});

describe("blocked-word storage", () => {
	it("adds, deduplicates, lists, and removes normalized words", () => {
		const db = createTestDb();
		seedAdmin(db);
		expect(addBlockedWord(db, "Bád word", "admin")).toEqual({ ok: true });
		expect(addBlockedWord(db, "badword", "admin")).toEqual({
			ok: false,
			error: "That word or an equivalent is already blocked",
		});

		const [stored] = getBlockedWords(db);
		expect(stored.word).toBe("Bád word");
		expect(stored.normalized).toBe("badword");
		removeBlockedWord(db, stored.id);
		expect(getBlockedWords(db)).toEqual([]);
	});
});
