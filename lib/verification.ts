export type VerificationStatus =
	| "needs_submission"
	| "pending"
	| "verified_eligible"
	| "verified_but_over_18"
	| "rejected"
	| "not_found"
	| "unavailable";

export interface VerificationResult {
	status: VerificationStatus;
	checkedAt: Date;
}

export interface VerificationPort {
	checkSlackId(slackId: string): Promise<VerificationResult>;
}

const KNOWN = new Set<VerificationStatus>([
	"needs_submission",
	"pending",
	"verified_eligible",
	"verified_but_over_18",
	"rejected",
	"not_found",
]);

export function createHackClubVerification(
	fetchImpl: typeof fetch = fetch,
): VerificationPort {
	return {
		async checkSlackId(slackId) {
			const checkedAt = new Date();
			try {
				const url = new URL("https://auth.hackclub.com/api/external/check");
				url.searchParams.set("slack_id", slackId);
				const response = await fetchImpl(url, {
					signal: AbortSignal.timeout(5_000),
				});
				if (!response.ok) return { status: "unavailable", checkedAt };
				const body = (await response.json()) as { result?: unknown };
				return {
					status:
						typeof body.result === "string" &&
						KNOWN.has(body.result as VerificationStatus)
							? (body.result as VerificationStatus)
							: "unavailable",
					checkedAt,
				};
			} catch {
				return { status: "unavailable", checkedAt };
			}
		},
	};
}

export const hackClubVerification = createHackClubVerification();
