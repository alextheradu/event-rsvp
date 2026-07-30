import { describe, expect, it } from "vitest";
import { createPublicFormLinkMatcher } from "./slack-unfurl";

describe("createPublicFormLinkMatcher", () => {
	const match = createPublicFormLinkMatcher([
		"https://rsvp.example.com",
		"https://events.example.com",
	]);

	it.each([
		["https://rsvp.example.com/demo", "demo"],
		["http://rsvp.example.com/demo", "demo"],
		["https://rsvp.example.com/demo/", "demo"],
		["https://rsvp.example.com/demo?shared=slack", "demo"],
		["https://events.example.com/my-event#details", "my-event"],
	])("matches a public event link %s", (url, slug) => {
		expect(match(url)).toBe(slug);
	});

	it.each([
		"https://other.example.com/demo",
		"https://rsvp.example.com/",
		"https://rsvp.example.com/demo/manage",
		"https://user@rsvp.example.com/demo",
		"not a url",
	])("rejects a non-event link %s", (url) => {
		expect(match(url)).toBeNull();
	});
});
