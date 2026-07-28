import { describe, expect, it } from "vitest";
import { forms, users } from "./schema";
import { createTestDb } from "./test-db";

describe("migrations", () => {
	it("creates every table the schema declares", () => {
		const db = createTestDb();
		expect(db.select().from(users).all()).toEqual([]);
		expect(db.select().from(forms).all()).toEqual([]);
	});

	it("round-trips a user with a timestamp", () => {
		const db = createTestDb();
		db.insert(users)
			.values({ id: "u1", hackclubId: "h1", name: "Ada", email: "" })
			.run();
		const row = db.select().from(users).get();
		expect(row?.name).toBe("Ada");
		expect(row?.isAllowed).toBe(false);
		expect(row?.createdAt).toBeInstanceOf(Date);
	});
});
