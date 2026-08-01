const MARK_RE = /\p{M}/u;
const LETTER_OR_NUMBER_RE = /[\p{L}\p{N}]/u;

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

function visualUnits(value: string): string[][] {
	const units: string[][] = [];
	for (const character of value.normalize("NFKD").toLowerCase()) {
		if (MARK_RE.test(character)) continue;
		const mapped = LOOKALIKES[character];
		if (mapped) {
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
