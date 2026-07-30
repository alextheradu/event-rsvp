import { getPublicOrigin } from "./public-origin";

export function buildOauthRedirectUri(
	env: Partial<
		Pick<NodeJS.ProcessEnv, "PUBLIC_URL" | "NODE_ENV">
	> = process.env,
): string {
	return `${getPublicOrigin(env)}/oauth/callback`;
}

export { getPublicOrigin } from "./public-origin";
export const OAUTH_REDIRECT_URI = buildOauthRedirectUri();
