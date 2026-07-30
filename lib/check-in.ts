import { eq } from "drizzle-orm";
import type { DB } from "./db";
import { eventChanges, forms, rsvps } from "./schema";

export function setCheckedIn(
	db: DB,
	rsvpId: string,
	actorId: string,
	checkedIn: boolean,
) {
	return db.transaction((tx) => {
		const row = tx
			.select({ rsvp: rsvps, form: forms })
			.from(rsvps)
			.innerJoin(forms, eq(rsvps.formId, forms.id))
			.where(eq(rsvps.id, rsvpId))
			.get();
		if (row?.rsvp.status !== "confirmed" || row.form.cancelledAt) {
			return { ok: false as const, error: "Attendee cannot be checked in" };
		}
		const next = checkedIn ? new Date() : null;
		if (Boolean(row.rsvp.checkedInAt) === checkedIn) {
			return { ok: true as const };
		}
		tx.update(rsvps)
			.set({ checkedInAt: next, checkedInBy: checkedIn ? actorId : null })
			.where(eq(rsvps.id, rsvpId))
			.run();
		tx.insert(eventChanges)
			.values({
				id: crypto.randomUUID(),
				formId: row.form.id,
				actorId,
				kind: checkedIn ? "attendee_checked_in" : "attendee_check_in_undone",
				beforeJson: JSON.stringify({ rsvpId, checkedIn: !checkedIn }),
				afterJson: JSON.stringify({ rsvpId, checkedIn }),
			})
			.run();
		return { ok: true as const };
	});
}
