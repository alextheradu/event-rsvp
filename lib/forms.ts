import { count, eq } from "drizzle-orm";
import type { DB } from "./db";
import { feedback, forms, rsvps } from "./schema";

export type Form = typeof forms.$inferSelect;

export const MAX_FORMS_PER_USER = 3;
export const SLUG_RE = /^[a-z0-9-]+$/;
export const SLACK_CHANNEL_RE = /^[A-Z][A-Z0-9]{6,12}$/;

export const RESERVED_SLUGS = new Set([
	"new",
	"auth",
	"api",
	"admin",
	"login",
	"logout",
	"callback",
	"dashboard",
]);

export interface FormInput {
	title: string;
	slug: string;
	description: string | null;
	website: string | null;
	slackChannelId: string | null;
	feedbackEnabled: boolean;
}

export interface FormSettings {
	isOpen: boolean;
	isPublic: boolean;
	feedbackEnabled: boolean;
	description: string | null;
	website: string | null;
	slackChannelId: string | null;
}

export type CreateFormResult =
	| { ok: true; slug: string }
	| { ok: false; error: string };

export function getFormBySlug(db: DB, slug: string): Form | undefined {
	return db.select().from(forms).where(eq(forms.slug, slug)).get();
}

export function getFormById(db: DB, id: string): Form | undefined {
	return db.select().from(forms).where(eq(forms.id, id)).get();
}

export function countFormsByCreator(db: DB, creatorId: string): number {
	return (
		db
			.select({ value: count() })
			.from(forms)
			.where(eq(forms.creatorId, creatorId))
			.get()?.value ?? 0
	);
}

export async function createForm(
	db: DB,
	creatorId: string,
	input: FormInput,
): Promise<CreateFormResult> {
	const title = input.title.trim();
	const slug = input.slug.toLowerCase().trim();

	if (!title || !slug)
		return { ok: false, error: "Title and URL are required" };
	if (!SLUG_RE.test(slug)) {
		return {
			ok: false,
			error: "URL can only contain lowercase letters, numbers, and hyphens",
		};
	}
	if (RESERVED_SLUGS.has(slug))
		return { ok: false, error: "That URL is reserved" };
	if (input.slackChannelId && !SLACK_CHANNEL_RE.test(input.slackChannelId)) {
		return { ok: false, error: "Invalid Slack channel ID" };
	}
	if (countFormsByCreator(db, creatorId) >= MAX_FORMS_PER_USER) {
		return {
			ok: false,
			error: `You can create up to ${MAX_FORMS_PER_USER} forms`,
		};
	}
	if (getFormBySlug(db, slug)) {
		return { ok: false, error: "That URL is already taken" };
	}

	try {
		db.insert(forms)
			.values({
				id: crypto.randomUUID(),
				slug,
				title,
				description: input.description,
				website: input.website,
				slackChannelId: input.slackChannelId,
				feedbackEnabled: input.feedbackEnabled,
				creatorId,
			})
			.run();
	} catch (err) {
		// The pre-check above handles the common case; this catches the race where
		// another request inserted the same slug in between.
		if (String(err).includes("UNIQUE constraint failed: forms.slug")) {
			return { ok: false, error: "That URL is already taken" };
		}
		throw err;
	}

	return { ok: true, slug };
}

export function updateForm(db: DB, id: string, settings: FormSettings): void {
	db.update(forms).set(settings).where(eq(forms.id, id)).run();
}

export function deleteForm(db: DB, id: string): void {
	db.delete(feedback).where(eq(feedback.formId, id)).run();
	db.delete(rsvps).where(eq(rsvps.formId, id)).run();
	db.delete(forms).where(eq(forms.id, id)).run();
}
