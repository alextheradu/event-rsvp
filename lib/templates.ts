import type { Form } from "./forms";

export const TEMPLATE_VARIABLES = [
	"first_name",
	"event_name",
	"event_date",
	"event_time",
	"timezone",
	"location",
	"host_name",
	"event_link",
	"feedback_link",
] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

const VARIABLE = /\{([a-z_]+)\}/g;

export function validateTemplate(
	template: string,
	options: { feedback?: boolean } = {},
) {
	if (!template.trim()) throw new Error("Message cannot be empty");
	if (template.length > 2_000) throw new Error("Message is too long");
	for (const match of template.matchAll(VARIABLE)) {
		const name = match[1] as TemplateVariable;
		if (
			!TEMPLATE_VARIABLES.includes(name) ||
			(name === "feedback_link" && !options.feedback)
		) {
			throw new Error(`Unknown template variable: {${match[1]}}`);
		}
	}
	const withoutKnown = template.replace(VARIABLE, "");
	if (/[{}]/.test(withoutKnown)) throw new Error("Malformed template variable");
	return template;
}

export function escapeSlack(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

export interface TemplateContext {
	firstName: string;
	eventName: string;
	eventDate: string;
	eventTime: string;
	timezone: string;
	location: string;
	hostName: string;
	eventLink: string;
	feedbackLink?: string;
}

export function renderTemplate(
	template: string,
	context: TemplateContext,
	options: { feedback?: boolean } = {},
) {
	validateTemplate(template, options);
	const values: Record<TemplateVariable, string> = {
		first_name: context.firstName || "there",
		event_name: context.eventName,
		event_date: context.eventDate || "TBD",
		event_time: context.eventTime || "TBD",
		timezone: context.timezone || "TBD",
		location: context.location || "TBD",
		host_name: context.hostName,
		event_link: context.eventLink,
		feedback_link: context.feedbackLink ?? "TBD",
	};
	const rendered = template.replace(
		VARIABLE,
		(_whole, name: TemplateVariable) => escapeSlack(values[name]),
	);
	if (rendered.length > 4_000) throw new Error("Rendered message is too long");
	return rendered;
}

export function eventTemplateValues(
	form: Form,
	hostName: string,
	attendeeName: string,
	eventLink: string,
	feedbackLink?: string,
): TemplateContext {
	const formatter = form.timezone
		? new Intl.DateTimeFormat("en-US", {
				timeZone: form.timezone,
				dateStyle: "long",
			})
		: null;
	const timeFormatter = form.timezone
		? new Intl.DateTimeFormat("en-US", {
				timeZone: form.timezone,
				timeStyle: "short",
			})
		: null;
	return {
		firstName: attendeeName.trim().split(/\s+/)[0] || "there",
		eventName: form.title,
		eventDate:
			form.startAt && formatter ? formatter.format(form.startAt) : "TBD",
		eventTime:
			form.startAt && timeFormatter
				? timeFormatter.format(form.startAt)
				: "TBD",
		timezone: form.timezone ?? "TBD",
		location:
			form.eventFormat === "online"
				? (form.onlineUrl ?? "TBD")
				: (form.locationDisplay ?? "TBD"),
		hostName,
		eventLink,
		feedbackLink,
	};
}
