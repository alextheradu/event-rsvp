/**
 * Reduce an attacker-influenced `?return=` value to a same-origin relative path.
 *
 * Allowlist, not denylist: the value must be a single-slash-prefixed relative path,
 * and anything else becomes "/". Backslashes are rejected because some user agents
 * normalise `\` to `/`, which turns `/\evil.com` into a protocol-relative URL.
 *
 * Apply this at both ends of the OAuth round trip — when the value enters the
 * `oauth_state` cookie, and again when it comes back out — because the cookie is
 * itself attacker-influenced input.
 */
export function safeReturnTo(value: string | null | undefined): string {
	if (!value) return "/";
	// `new URL()` strips tab, CR, and LF while parsing (WHATWG URL spec), so a value
	// that looks like a safe relative path here can become protocol-relative at the
	// sink: "/\n/evil.com" parses to "//evil.com" -> the attacker's origin. Validating
	// the raw string is not the same as validating what the sink consumes.
	// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
	if (/[\x00-\x1f\x7f]/.test(value)) return "/";
	if (!value.startsWith("/")) return "/";
	if (value.startsWith("//")) return "/";
	if (value.includes("\\")) return "/";
	return value;
}
