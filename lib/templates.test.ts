import { describe, expect, it } from "vitest";
import { renderTemplate, validateTemplate } from "./templates";

const context = {
	firstName: "Ada & Co",
	eventName: "<Build>",
	eventDate: "August 1",
	eventTime: "1:00 PM",
	timezone: "America/New_York",
	location: "HQ",
	hostName: "Grace",
	eventLink: "https://events.example/build",
};

describe("notification templates", () => {
	it("rejects unknown and malformed variables", () => {
		expect(() => validateTemplate("hi {frist_name}")).toThrow(
			"Unknown template variable",
		);
		expect(() => validateTemplate("hi {first_name")).toThrow("Malformed");
	});

	it("escapes interpolated Slack values", () => {
		expect(renderTemplate("hi {first_name}: {event_name}", context)).toBe(
			"hi Ada &amp; Co: &lt;Build&gt;",
		);
	});

	it("allows feedback links only in feedback templates", () => {
		expect(() => validateTemplate("{feedback_link}")).toThrow();
		expect(validateTemplate("{feedback_link}", { feedback: true })).toBe(
			"{feedback_link}",
		);
	});
});
