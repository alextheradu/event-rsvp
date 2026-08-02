import { describe, expect, it } from "vitest";
import {
	EventValidationError,
	parseEventWindow,
	validateEventDetails,
} from "./event-time";

describe("event time", () => {
	it("stores local times as UTC", () => {
		const result = parseEventWindow(
			"2026-08-01T12:00",
			"2026-08-01T14:00",
			"America/New_York",
		);
		expect(result.startAt?.toISOString()).toBe("2026-08-01T16:00:00.000Z");
	});

	it("allows the schedule to be omitted when the browser supplies a timezone", () => {
		const result = validateEventDetails({
			startLocal: null,
			endLocal: null,
			timezone: "America/New_York",
			eventFormat: "tbd",
			capacity: null,
			attendeeNotes: null,
			locationDisplay: null,
			locationLatitude: null,
			locationLongitude: null,
			locationProvider: null,
			locationPlaceId: null,
			onlineUrl: null,
		});

		expect(result.startAt).toBeNull();
		expect(result.endAt).toBeNull();
		expect(result.timezone).toBeNull();
	});

	it("rejects a partially entered schedule", () => {
		expect(() =>
			parseEventWindow("2026-08-01T12:00", null, "America/New_York"),
		).toThrow("Start, end, and timezone are required");
	});

	it("rejects DST gaps and ambiguous local times", () => {
		expect(() =>
			parseEventWindow(
				"2026-03-08T02:30",
				"2026-03-08T04:00",
				"America/New_York",
			),
		).toThrow(EventValidationError);
		expect(() =>
			parseEventWindow(
				"2026-11-01T01:30",
				"2026-11-01T03:00",
				"America/New_York",
			),
		).toThrow(EventValidationError);
	});

	it("validates format-specific fields", () => {
		expect(() =>
			validateEventDetails({
				startLocal: "2026-08-01T12:00",
				endLocal: "2026-08-01T13:00",
				timezone: "UTC",
				eventFormat: "online",
				capacity: null,
				attendeeNotes: null,
				locationDisplay: null,
				locationLatitude: null,
				locationLongitude: null,
				locationProvider: null,
				locationPlaceId: null,
				onlineUrl: "http://example.com",
			}),
		).toThrow("HTTPS");
	});
});
