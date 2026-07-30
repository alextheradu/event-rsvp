export interface PublicOrigins {
	primary: string;
	all: readonly string[];
	allowedHosts: readonly string[];
}

function normalizeOrigin(raw: string): string {
	const value = raw.trim();
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`Invalid PUBLIC_URL origin: ${value}`);
	}
	if (
		(url.protocol !== "http:" && url.protocol !== "https:") ||
		url.username ||
		url.password ||
		url.pathname !== "/" ||
		url.search ||
		url.hash
	) {
		throw new Error(`Invalid PUBLIC_URL origin: ${value}`);
	}
	return url.origin;
}

export function resolvePublicOrigins(
	value: string | undefined,
	nodeEnv: string | undefined = process.env.NODE_ENV,
): PublicOrigins {
	const raw = value
		?.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
	if (!raw?.length) {
		if (nodeEnv === "production") {
			throw new Error("PUBLIC_URL must contain at least one explicit origin");
		}
		return {
			primary: "http://localhost:4321",
			all: ["http://localhost:4321"],
			allowedHosts: ["localhost:4321"],
		};
	}

	const all = [...new Set(raw.map(normalizeOrigin))];
	return {
		primary: all[0],
		all,
		allowedHosts: all.map((origin) => new URL(origin).host),
	};
}

export function getPublicOrigins(
	env: Partial<
		Pick<NodeJS.ProcessEnv, "PUBLIC_URL" | "NODE_ENV">
	> = process.env,
): PublicOrigins {
	return resolvePublicOrigins(env.PUBLIC_URL, env.NODE_ENV);
}

export function getPublicOrigin(
	env: Partial<
		Pick<NodeJS.ProcessEnv, "PUBLIC_URL" | "NODE_ENV">
	> = process.env,
): string {
	return getPublicOrigins(env).primary;
}
