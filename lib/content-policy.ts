import { asc, eq } from "drizzle-orm";
import type { DB } from "./db";
import { blockedWords } from "./schema";

export const MAX_BLOCKED_WORD_LENGTH = 80;

const MARK_RE = /\p{M}/u;
const LETTER_OR_NUMBER_RE = /[\p{L}\p{N}]/u;
const UNICODE_SYMBOL_RE = /\p{S}/u;
const UNSAFE_CONTROL_RE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]/u;
const EXTENDED_PICTOGRAPHIC_RE = /\p{Extended_Pictographic}/u;
const REGIONAL_INDICATOR_RE = /\p{Regional_Indicator}/u;
const EMOJI_MODIFIER_RE = /\p{Emoji_Modifier}/u;

// Each character maps to the ASCII letters it can plausibly impersonate. A set
// is used for ambiguous shapes such as 1/!/|, which may stand in for i or l.
const LOOKALIKES: Record<string, readonly string[]> = {
	"0": ["o"],
	"1": ["i", "l"],
	"2": ["z"],
	"3": ["e"],
	"4": ["a"],
	"5": ["s"],
	"6": ["g"],
	"7": ["t"],
	"8": ["b"],
	"9": ["g", "q"],
	"!": ["i", "l"],
	$: ["s"],
	"+": ["t"],
	"@": ["a"],
	"|": ["i", "l"],
	// Common Greek homoglyphs.
	α: ["a"],
	β: ["b"],
	ϲ: ["c"],
	ε: ["e"],
	η: ["h"],
	ι: ["i"],
	κ: ["k"],
	μ: ["m"],
	ν: ["v"],
	ο: ["o"],
	ρ: ["p"],
	τ: ["t"],
	υ: ["y"],
	χ: ["x"],
	// Common Cyrillic homoglyphs.
	а: ["a"],
	в: ["b"],
	с: ["c"],
	ԁ: ["d"],
	е: ["e"],
	ԛ: ["q"],
	һ: ["h"],
	і: ["i"],
	ј: ["j"],
	к: ["k"],
	ⅼ: ["l"],
	м: ["m"],
	о: ["o"],
	р: ["p"],
	ѕ: ["s"],
	т: ["t"],
	у: ["y"],
	х: ["x"],
	ԝ: ["w"],
	// NFKD does not expand these Latin ligatures/letters in JavaScript.
	æ: ["ae"],
	œ: ["oe"],
	ß: ["ss"],
};

function isEmojiSymbol(character: string): boolean {
	return (
		EXTENDED_PICTOGRAPHIC_RE.test(character) ||
		REGIONAL_INDICATOR_RE.test(character) ||
		EMOJI_MODIFIER_RE.test(character)
	);
}

function isEmojiFormatCharacter(codePoint: number): boolean {
	return codePoint === 0x200d || (codePoint >= 0xe0020 && codePoint <= 0xe007f);
}

/** Returns false for unsafe controls and non-ASCII Unicode symbols, except emoji. */
export function hasOnlyAllowedUnicode(value: string): boolean {
	for (const character of value) {
		const codePoint = character.codePointAt(0) ?? 0;
		if (codePoint < 0x80) {
			if (UNSAFE_CONTROL_RE.test(character) && !"\t\n\r".includes(character)) {
				return false;
			}
			continue;
		}
		if (
			UNSAFE_CONTROL_RE.test(character) &&
			!isEmojiFormatCharacter(codePoint)
		) {
			return false;
		}
		if (UNICODE_SYMBOL_RE.test(character) && !isEmojiSymbol(character)) {
			return false;
		}
	}
	return true;
}

function visualUnits(value: string): string[][] {
	const units: string[][] = [];
	for (const character of value.normalize("NFKD").toLowerCase()) {
		if (MARK_RE.test(character)) continue;
		const mapped = LOOKALIKES[character];
		if (mapped) {
			// Multi-letter expansions are unambiguous and become separate units.
			if (mapped.length === 1 && mapped[0].length > 1) {
				for (const expanded of mapped[0]) units.push([expanded]);
			} else {
				units.push([...mapped]);
			}
			continue;
		}
		if (LETTER_OR_NUMBER_RE.test(character)) units.push([character]);
	}
	return units;
}

export function normalizeBlockedWord(value: string): string {
	return visualUnits(value)
		.map(([first]) => first)
		.join("");
}

export function containsBlockedWord(
	value: string,
	normalizedWord: string,
): boolean {
	const expected = Array.from(normalizedWord);
	if (expected.length === 0) return false;
	const units = visualUnits(value);
	for (let start = 0; start <= units.length - expected.length; start++) {
		if (
			expected.every((character, index) =>
				units[start + index].includes(character),
			)
		) {
			return true;
		}
	}
	return false;
}

export function getBlockedWords(db: DB) {
	return db.select().from(blockedWords).orderBy(asc(blockedWords.word)).all();
}

export type AddBlockedWordResult = { ok: true } | { ok: false; error: string };

export function addBlockedWord(
	db: DB,
	wordInput: string,
	createdBy: string,
): AddBlockedWordResult {
	const word = wordInput.trim();
	if (!word) return { ok: false, error: "Enter a word to block" };
	if (word.length > MAX_BLOCKED_WORD_LENGTH) {
		return {
			ok: false,
			error: `Blocked words must be ${MAX_BLOCKED_WORD_LENGTH} characters or fewer`,
		};
	}
	if (!hasOnlyAllowedUnicode(word)) {
		return {
			ok: false,
			error: "Unsupported Unicode symbols are not allowed; emoji are okay",
		};
	}
	const normalized = normalizeBlockedWord(word);
	if (!normalized) {
		return { ok: false, error: "Enter at least one letter or number" };
	}

	try {
		db.insert(blockedWords)
			.values({
				id: crypto.randomUUID(),
				word,
				normalized,
				createdBy,
			})
			.run();
	} catch (error) {
		if (String(error).includes("UNIQUE constraint failed")) {
			return {
				ok: false,
				error: "That word or an equivalent is already blocked",
			};
		}
		throw error;
	}
	return { ok: true };
}

export function removeBlockedWord(db: DB, id: string): void {
	db.delete(blockedWords).where(eq(blockedWords.id, id)).run();
}

export function validateNewFormContent(
	db: DB,
	values: Array<string | null | undefined>,
): string | null {
	const content = values.filter((value): value is string => Boolean(value));
	if (content.some((value) => !hasOnlyAllowedUnicode(value))) {
		return "Unsupported Unicode symbols are not allowed in forms; emoji are okay";
	}
	const words = db
		.select({ normalized: blockedWords.normalized })
		.from(blockedWords)
		.all();
	if (
		words.some(({ normalized }) =>
			content.some((value) => containsBlockedWord(value, normalized)),
		)
	) {
		return "This form includes a word that is not allowed";
	}
	return null;
}
