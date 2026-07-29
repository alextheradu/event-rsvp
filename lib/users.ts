import { eq } from "drizzle-orm";
import type { DB } from "./db";
import { users } from "./schema";
import type { SessionUser } from "./session";
import type { SlackPort } from "./slack";

export type EligibilityCheck = (slackId: string) => Promise<boolean>;

export const checkHackClubEligibility: EligibilityCheck = async (slackId) => {
	const res = await fetch(
		`https://identity.hackclub.com/api/external/check?slack_id=${slackId}`,
	)
		.then((r) => r.json())
		.catch(() => null);
	return res?.result === "verified_eligible";
};

export interface OAuthIdentity {
	hackclubId: string;
	slackId: string | null;
	name: string;
	avatarUrl: string | null;
	yswsEligible: boolean;
}

export async function upsertOAuthUser(
	db: DB,
	identity: OAuthIdentity,
): Promise<SessionUser> {
	const existing =
		(identity.slackId
			? db.select().from(users).where(eq(users.slackId, identity.slackId)).get()
			: undefined) ??
		db
			.select()
			.from(users)
			.where(eq(users.hackclubId, identity.hackclubId))
			.get();

	if (existing) {
		db.update(users)
			.set({
				name: identity.name,
				avatarUrl: identity.avatarUrl,
				slackId: identity.slackId,
				hackclubId: identity.hackclubId,
			})
			.where(eq(users.id, existing.id))
			.run();

		return {
			id: existing.id,
			name: identity.name,
			email: existing.email,
			avatarUrl: identity.avatarUrl,
			isAllowed: existing.isAllowed,
			slackId: identity.slackId,
		};
	}

	const id = crypto.randomUUID();
	db.insert(users)
		.values({
			id,
			hackclubId: identity.hackclubId,
			name: identity.name,
			email: "",
			avatarUrl: identity.avatarUrl,
			slackId: identity.slackId,
			isAllowed: identity.yswsEligible,
		})
		.run();

	return {
		id,
		name: identity.name,
		email: "",
		avatarUrl: identity.avatarUrl,
		isAllowed: identity.yswsEligible,
		slackId: identity.slackId,
	};
}

export async function resolveSlackUser(
	db: DB,
	slack: SlackPort,
	slackId: string,
	checkEligibility: EligibilityCheck = checkHackClubEligibility,
): Promise<{ id: string; isAllowed: boolean } | null> {
	const existing = db
		.select()
		.from(users)
		.where(eq(users.slackId, slackId))
		.get();
	if (existing) return { id: existing.id, isAllowed: existing.isAllowed };

	if (!(await checkEligibility(slackId))) return null;

	const profile = await slack.getProfile(slackId);
	const id = crypto.randomUUID();

	db.insert(users)
		.values({
			id,
			hackclubId: `slack_${slackId}`,
			name: profile?.displayName ?? slackId,
			email: "",
			avatarUrl: profile?.avatarUrl ?? null,
			slackId,
			isAllowed: true,
		})
		.run();

	return { id, isAllowed: true };
}
