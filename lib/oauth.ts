/**
 * The OAuth redirect URI, derived from PUBLIC_URL rather than the incoming request.
 *
 * This MUST be byte-identical in two places — the `authorize` redirect and the
 * `token` exchange — or the provider rejects the exchange. Hence one constant.
 *
 * Deriving it from `request.url` (the obvious approach) is wrong in both real
 * deployments: on localhost it produces an origin that was never registered, and
 * behind a reverse proxy it produces the *internal* origin rather than the public
 * one. Both surface as "The requested redirect uri is malformed or doesn't match
 * client redirect URI" at the provider, before any of our code runs.
 *
 * Whatever this resolves to must be registered with Hack Club Auth exactly.
 */
const publicUrl = (process.env.PUBLIC_URL ?? "http://localhost:4321")
	.split(",")[0]
	.trim()
	.replace(/\/$/, "");

export const OAUTH_REDIRECT_URI = `${publicUrl}/oauth/callback`;
