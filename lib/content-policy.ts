import { asc, eq } from "drizzle-orm";
import {
	containsBlockedWord,
	normalizeBlockedWord,
} from "./content-normalization";
import type { DB } from "./db";
import { blockedWords } from "./schema";

export {
	containsBlockedWord,
	normalizeBlockedWord,
} from "./content-normalization";

export const MAX_BLOCKED_WORD_LENGTH = 80;

const UNICODE_SYMBOL_RE = /\p{S}/u;
const UNSAFE_CONTROL_RE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]/u;
const EXTENDED_PICTOGRAPHIC_RE = /\p{Extended_Pictographic}/u;
const REGIONAL_INDICATOR_RE = /\p{Regional_Indicator}/u;
const EMOJI_MODIFIER_RE = /\p{Emoji_Modifier}/u;

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
