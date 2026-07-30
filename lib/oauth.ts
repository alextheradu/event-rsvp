/**
 * Resolve the public origin for OAuth redirects.
 *
 * This MUST be byte-identical in two places — the `authorize` redirect and the
 * `token` exchange — or the provider rejects the exchange. We prefer
 * PUBLIC_URL when configured, but fall back to the forwarded host/proto from the
 * incoming request so production redirects stay on the public origin.
 */
function normalizeOrigin(value: string | undefined): string | null {
	if (!value) return null;
	return value.split(",")[0].trim().replace(/\/$/, "");
}

export function getPublicOrigin(
	request: Request | undefined,
	env: NodeJS.ProcessEnv = process.env,
): string {
	const configured = normalizeOrigin(env.PUBLIC_URL);
	if (configured) return configured;

	if (request) {
		const forwardedProto = request.headers
			.get("x-forwarded-proto")
			?.split(",")[0]
			?.trim();
		const forwardedHost = request.headers
			.get("x-forwarded-host")
			?.split(",")[0]
			?.trim();
		const host = forwardedHost ?? request.headers.get("host");
		if (host) {
			const proto =
				forwardedProto ?? new URL(request.url).protocol.replace(/:$/, "");
			return `${proto}://${host}`;
		}
	}

	return "http://localhost:4321";
}

export function buildOauthRedirectUri(
	request: Request | undefined,
	env: NodeJS.ProcessEnv = process.env,
): string {
	return `${getPublicOrigin(request, env)}/oauth/callback`;
}

export const OAUTH_REDIRECT_URI = buildOauthRedirectUri(undefined);
