import { describe, expect, it } from "vitest";
import { getFormBySlug } from "./forms";
import { countRsvps } from "./rsvp";
import { forms, rsvps, users } from "./schema";
import { createTestDb } from "./test-db";

// Characterization test: both functions already exist and work. This pins the
// contract `/api/stats` is built on so a later refactor of either one cannot
// silently change what the public endpoint reports.
describe("stats count", () => {
	it("counts rsvps for a slug", () => {
		const db = createTestDb();
		db.insert(users)
			.values({ id: "u1", hackclubId: "h1", name: "Ada", email: "" })
			.run();
		db.insert(forms)
			.values({ id: "f1", slug: "meetup", title: "Meetup", creatorId: "u1" })
			.run();
		db.insert(rsvps).values({ id: "r1", formId: "f1", userId: "u1" }).run();

		const form = getFormBySlug(db, "meetup");
		expect(form).toBeDefined();
		// biome-ignore lint/style/noNonNullAssertion: form is asserted above
		expect(countRsvps(db, form!.id)).toBe(1);
	});

	it("returns undefined for an unknown slug", () => {
		const db = createTestDb();
		expect(getFormBySlug(db, "nope")).toBeUndefined();
	});
});
