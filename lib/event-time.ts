import { Temporal } from "@js-temporal/polyfill";

export type EventFormat = "in_person" | "online" | "tbd";

export interface EventDetailsInput {
	startLocal: string | null;
	endLocal: string | null;
	timezone: string | null;
	eventFormat: EventFormat | null;
	capacity: number | null;
	attendeeNotes: string | null;
	locationDisplay: string | null;
	locationLatitude: number | null;
	locationLongitude: number | null;
	locationProvider: string | null;
	locationPlaceId: string | null;
	onlineUrl: string | null;
}

export interface ParsedEventDetails
	extends Omit<EventDetailsInput, "startLocal" | "endLocal"> {
	startAt: Date | null;
	endAt: Date | null;
}

export class EventValidationError extends Error {}

function optionalText(value: string | null, max: number, label: string) {
	const normalized = value?.trim() || null;
	if (normalized && normalized.length > max) {
		throw new EventValidationError(`${label} is too long`);
	}
	return normalized;
}

export function parseEventWindow(
	startLocal: string | null,
	endLocal: string | null,
	timezone: string | null,
): { startAt: Date | null; endAt: Date | null; timezone: string | null } {
	// Browsers still submit the auto-detected timezone when both optional date
	// fields are blank. Treat that as an omitted schedule instead of a partial one.
	if (!startLocal && !endLocal) {
		return { startAt: null, endAt: null, timezone: null };
	}
	if (!startLocal || !endLocal || !timezone) {
		throw new EventValidationError("Start, end, and timezone are required");
	}
	try {
		const zone = new Intl.DateTimeFormat("en-US", {
			timeZone: timezone,
		}).resolvedOptions().timeZone;
		const startPlain = Temporal.PlainDateTime.from(startLocal);
		const endPlain = Temporal.PlainDateTime.from(endLocal);
		const start = startPlain.toZonedDateTime(zone, {
			disambiguation: "reject",
		});
		const end = endPlain.toZonedDateTime(zone, { disambiguation: "reject" });
		if (Temporal.ZonedDateTime.compare(end, start) <= 0) {
			throw new EventValidationError("Event end must be after its start");
		}
		return {
			startAt: new Date(start.epochMilliseconds),
			endAt: new Date(end.epochMilliseconds),
			timezone: zone,
		};
	} catch (error) {
		if (error instanceof EventValidationError) throw error;
		throw new EventValidationError(
			"Date, time, or timezone is invalid or falls in a daylight-saving transition",
		);
	}
}

export function validateEventDetails(
	input: EventDetailsInput,
	options: { allowLegacyEmpty?: boolean } = {},
): ParsedEventDetails {
	const window = parseEventWindow(
		input.startLocal,
		input.endLocal,
		input.timezone,
	);
	if (!input.eventFormat && !options.allowLegacyEmpty) {
		throw new EventValidationError("Event format is required");
	}
	if (
		input.capacity !== null &&
		(!Number.isInteger(input.capacity) ||
			input.capacity < 1 ||
			input.capacity > 10_000)
	) {
		throw new EventValidationError("Capacity must be between 1 and 10,000");
	}

	const locationDisplay = optionalText(input.locationDisplay, 300, "Location");
	const attendeeNotes = optionalText(
		input.attendeeNotes,
		2_000,
		"Attendee notes",
	);
	const coordinates = [input.locationLatitude, input.locationLongitude];
	if (coordinates.some((value) => value !== null && !Number.isFinite(value))) {
		throw new EventValidationError("Location coordinates are invalid");
	}
	if (
		(input.locationLatitude !== null &&
			(input.locationLatitude < -90 || input.locationLatitude > 90)) ||
		(input.locationLongitude !== null &&
			(input.locationLongitude < -180 || input.locationLongitude > 180))
	) {
		throw new EventValidationError("Location coordinates are invalid");
	}
	if (
		(input.locationLatitude === null) !==
		(input.locationLongitude === null)
	) {
		throw new EventValidationError("Both location coordinates are required");
	}

	let onlineUrl = optionalText(input.onlineUrl, 2_000, "Online URL");
	if (onlineUrl) {
		try {
			const parsed = new URL(onlineUrl);
			if (parsed.protocol !== "https:") throw new Error();
			onlineUrl = parsed.toString();
		} catch {
			throw new EventValidationError("Online URL must use HTTPS");
		}
	}

	if (input.eventFormat === "in_person" && !locationDisplay) {
		throw new EventValidationError("In-person events require a location");
	}
	if (input.eventFormat === "online" && !onlineUrl) {
		throw new EventValidationError("Online events require an HTTPS URL");
	}
	if (input.eventFormat === "tbd" && (locationDisplay || onlineUrl)) {
		throw new EventValidationError(
			"TBD events cannot have a location or online URL",
		);
	}
	if (input.eventFormat === "in_person") onlineUrl = null;

	return {
		...window,
		eventFormat: input.eventFormat,
		capacity: input.capacity,
		attendeeNotes,
		locationDisplay: input.eventFormat === "in_person" ? locationDisplay : null,
		locationLatitude:
			input.eventFormat === "in_person" ? input.locationLatitude : null,
		locationLongitude:
			input.eventFormat === "in_person" ? input.locationLongitude : null,
		locationProvider:
			input.eventFormat === "in_person" ? input.locationProvider : null,
		locationPlaceId:
			input.eventFormat === "in_person" ? input.locationPlaceId : null,
		onlineUrl: input.eventFormat === "online" ? onlineUrl : null,
	};
}

export function toLocalDateTime(date: Date | null, timezone: string | null) {
	if (!date || !timezone) return "";
	return Temporal.Instant.fromEpochMilliseconds(date.getTime())
		.toZonedDateTimeISO(timezone)
		.toPlainDateTime()
		.toString({ smallestUnit: "minute" });
}
