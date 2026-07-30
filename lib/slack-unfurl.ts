export function createPublicFormLinkMatcher(
	publicOrigins: readonly string[],
): (rawUrl: string) => string | null {
	const allowedHosts = new Set(
		publicOrigins.map((origin) => new URL(origin).host),
	);

	return (rawUrl) => {
		let url: URL;
		try {
			url = new URL(rawUrl);
		} catch {
			return null;
		}

		if (
			(url.protocol !== "http:" && url.protocol !== "https:") ||
			url.username ||
			url.password ||
			!allowedHosts.has(url.host)
		) {
			return null;
		}

		return url.pathname.match(/^\/([\w-]+)\/?$/)?.[1] ?? null;
	};
}
