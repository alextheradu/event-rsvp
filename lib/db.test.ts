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

	it("upgrades Phase 1 data without losing RSVPs or legacy feedback", () => {
		const sqlite = new Database(":memory:");
		sqlite.pragma("foreign_keys = ON");
		const runMigration = (name: string) => {
			const sql = readFileSync(resolve(process.cwd(), "drizzle", name), "utf8");
			for (const statement of sql.split("--> statement-breakpoint")) {
				if (statement.trim()) sqlite.exec(statement);
			}
		};
		runMigration("0000_outstanding_lyja.sql");
		runMigration("0001_volatile_genesis.sql");
		runMigration("0002_add_website.sql");
		sqlite
			.prepare(
				"INSERT INTO users (id,hackclub_id,name,email,is_allowed,created_at) VALUES (?,?,?,?,?,?)",
			)
			.run("u1", "h1", "Ada", "", 1, 100);
		sqlite
			.prepare(
				"INSERT INTO users (id,hackclub_id,name,email,is_allowed,created_at) VALUES (?,?,?,?,?,?)",
			)
			.run("u2", "h2", "Guest", "", 1, 101);
		sqlite
			.prepare(
				"INSERT INTO forms (id,slug,title,creator_id,created_at) VALUES (?,?,?,?,?)",
			)
			.run("form", "event", "Event", "u1", 110);
		sqlite
			.prepare(
				"INSERT INTO rsvps (id,form_id,user_id,created_at) VALUES (?,?,?,?)",
			)
			.run("rsvp", "form", "u2", 120);
		sqlite
			.prepare(
				"INSERT INTO feedback (id,form_id,user_id,content,created_at) VALUES (?,?,?,?,?)",
			)
			.run("feedback", "form", "u2", "Great", 130);

		runMigration("0003_conscious_gressill.sql");
		runMigration("0004_verification-preference.sql");

		expect(
			sqlite.prepare("SELECT status FROM rsvps WHERE id='rsvp'").get(),
		).toEqual({ status: "confirmed" });
		expect(
			sqlite.prepare("SELECT content FROM feedback WHERE id='feedback'").get(),
		).toEqual({ content: "Great" });
		expect(
			sqlite.prepare("SELECT updated_at FROM forms WHERE id='form'").get(),
		).toEqual({ updated_at: 110 });
		expect(
			sqlite
				.prepare("SELECT requires_verification FROM forms WHERE id='form'")
				.get(),
		).toEqual({ requires_verification: 1 });
	});
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
