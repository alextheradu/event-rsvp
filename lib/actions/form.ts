"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "../auth";
import { deps } from "../deps";
import {
	type EventFormat,
	EventValidationError,
	validateEventDetails,
} from "../event-time";
import {
	createForm,
	deleteForm,
	getFormById,
	SLACK_CHANNEL_RE,
	updateForm,
} from "../forms";
import { createCampaign } from "../notifications";
import {
	countConfirmed,
	countWaitlisted,
	fillAvailableCapacity,
} from "../rsvp";
import { users } from "../schema";
export interface ActionState {
	error?: string;
}

function str(data: FormData, key: string): string | null {
	const value = String(data.get(key) ?? "").trim();
	return value === "" ? null : value;
}

function numberOrNull(data: FormData, key: string): number | null {
	const value = str(data, key);
	return value === null ? null : Number(value);
}

function eventDetails(data: FormData, allowLegacyEmpty = false) {
	return validateEventDetails(
		{
			startLocal: str(data, "startLocal"),
			endLocal: str(data, "endLocal"),
			timezone: str(data, "timezone"),
			eventFormat: str(data, "eventFormat") as EventFormat | null,
			capacity: numberOrNull(data, "capacity"),
			attendeeNotes: str(data, "attendeeNotes"),
			locationDisplay: str(data, "locationDisplay"),
			locationLatitude: numberOrNull(data, "locationLatitude"),
			locationLongitude: numberOrNull(data, "locationLongitude"),
			locationProvider: str(data, "locationProvider"),
			locationPlaceId: str(data, "locationPlaceId"),
			onlineUrl: str(data, "onlineUrl"),
		},
		{ allowLegacyEmpty },
	);
}

export async function createFormAction(
	_prev: ActionState,
	data: FormData,
): Promise<ActionState> {
	const user = await getSession();
	if (!user) redirect("/auth/login?return=/new");

	// Read eligibility from the database, not the session. The session JWT lives up
	// to 7 days, so trusting it would let someone an admin just blocked keep creating
	// forms until it expires. `createRsvp` already reads from the row for the same
	// reason; this keeps the two consistent.
	const row = deps.db.select().from(users).where(eq(users.id, user.id)).get();
	if (!deps.allowIneligible && !row?.isAllowed) {
		return { error: "Your account is not eligible for YSWS programs" };
	}

	let details: ReturnType<typeof eventDetails>;
	try {
		details = eventDetails(data);
	} catch (error) {
		return {
			error:
				error instanceof EventValidationError
					? error.message
					: "Invalid event details",
		};
	}

	const result = await createForm(deps.db, user.id, {
		title: String(data.get("title") ?? ""),
		slug: String(data.get("slug") ?? ""),
		description: str(data, "description"),
		website: str(data, "website"),
		slackChannelId: str(data, "slackChannelId"),
		feedbackEnabled: false,
		eventDetails: details,
	});

	if (!result.ok) return { error: result.error };
	redirect(`/${result.slug}/manage`);
}

export async function updateFormAction(
	_prev: ActionState,
	data: FormData,
): Promise<ActionState> {
	const user = await getSession();
	if (!user) redirect("/auth/login");

	const id = String(data.get("id") ?? "");
	const form = getFormById(deps.db, id);
	if (!form || (form.creatorId !== user.id && !isAdmin(user))) {
		return { error: "Not found" };
	}

	const slackChannelId = str(data, "slackChannelId");
	if (slackChannelId && !SLACK_CHANNEL_RE.test(slackChannelId)) {
		return { error: "Invalid Slack channel ID" };
	}

	let details: ReturnType<typeof eventDetails>;
	try {
		details = eventDetails(data, form.startAt === null);
	} catch (error) {
		return {
			error:
				error instanceof EventValidationError
					? error.message
					: "Invalid event details",
		};
	}

	const materialChanged = [
		form.startAt?.getTime() ?? null,
		form.endAt?.getTime() ?? null,
		form.timezone,
		form.eventFormat,
		form.locationDisplay,
		form.onlineUrl,
	].some(
		(value, index) =>
			value !==
			[
				details.startAt?.getTime() ?? null,
				details.endAt?.getTime() ?? null,
				details.timezone,
				details.eventFormat,
				details.locationDisplay,
				details.onlineUrl,
			][index],
	);
	const attendeeCount =
		countConfirmed(deps.db, id) + countWaitlisted(deps.db, id);
	if (materialChanged && attendeeCount > 0 && !data.has("confirmChanges")) {
		return {
			error:
				"This changes important event details. Confirm the attendee-impact warning and save again.",
		};
	}

	updateForm(
		deps.db,
		id,
		{
			isOpen: data.has("isOpen"),
			isPublic: data.has("isPublic"),
			requiresVerification: data.has("requiresVerification"),
			feedbackEnabled: form.feedbackEnabled,
			description: str(data, "description"),
			website: str(data, "website"),
			slackChannelId,
			...details,
		},
		user.id,
	);
	fillAvailableCapacity(deps, id);
	if (materialChanged && attendeeCount > 0 && data.has("notifyAttendees")) {
		for (const audience of ["confirmed", "waitlisted"] as const) {
			createCampaign(deps.db, {
				formId: id,
				creatorId: user.id,
				kind: "event_updated",
				audience,
				template:
					"{event_name} was updated. Review the current details here: {event_link}",
				isOperational: true,
				scheduledAt: new Date(),
			});
		}
	}

	revalidatePath(`/${form.slug}`);
	revalidatePath(`/${form.slug}/manage`);
	return {};
}

export async function deleteFormAction(id: string): Promise<void> {
	const user = await getSession();
	if (!user) redirect("/auth/login");

	const form = getFormById(deps.db, id);
	if (!form || (form.creatorId !== user.id && !isAdmin(user))) return;

	const slug = form.slug;
	deleteForm(deps.db, id);
	// Revalidate the deleted form's own routes too, not just the dashboard —
	// otherwise those paths keep serving cached content for a form that is gone.
	revalidatePath("/");
	revalidatePath(`/${slug}`);
	revalidatePath(`/${slug}/manage`);
	revalidatePath(`/${slug}/stats`);
	redirect("/");
}
