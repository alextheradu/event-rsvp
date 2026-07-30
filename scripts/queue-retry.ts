import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { notificationDeliveries } from "../lib/schema";

const id = process.argv[2];
if (!id) throw new Error("Usage: npm run queue:retry -- <delivery-id>");
const delivery = db
	.select()
	.from(notificationDeliveries)
	.where(eq(notificationDeliveries.id, id))
	.get();
if (!delivery) throw new Error("Delivery not found");
if (!["failed", "retrying"].includes(delivery.status)) {
	throw new Error(`Refusing to retry delivery in ${delivery.status} state`);
}
db.update(notificationDeliveries)
	.set({
		status: "queued",
		nextAttemptAt: new Date(),
		leaseOwner: null,
		leasedAt: null,
		completedAt: null,
	})
	.where(eq(notificationDeliveries.id, id))
	.run();
console.log(`Queued delivery ${id}`);
