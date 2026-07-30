import { count, eq, min } from "drizzle-orm";
import { db } from "../lib/db";
import { channelAccessAttempts, notificationDeliveries } from "../lib/schema";

for (const [name, table] of [
	["notifications", notificationDeliveries],
	["channel-access", channelAccessAttempts],
] as const) {
	const rows = db
		.select({ status: table.status, total: count() })
		.from(table)
		.groupBy(table.status)
		.all();
	const oldest = db
		.select({ at: min(table.nextAttemptAt) })
		.from(table)
		.where(eq(table.status, "queued"))
		.get()?.at;
	console.log(
		JSON.stringify({
			queue: name,
			statuses: Object.fromEntries(rows.map((row) => [row.status, row.total])),
			oldestDueAt: oldest ?? null,
		}),
	);
}
