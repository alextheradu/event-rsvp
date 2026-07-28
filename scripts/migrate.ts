import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const dbPath = process.env.DATABASE_URL || "./data/rsvp.db";
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

migrate(drizzle(sqlite), {
	migrationsFolder: resolve(process.cwd(), "drizzle"),
});

sqlite.close();
console.log("Migrations applied.");
