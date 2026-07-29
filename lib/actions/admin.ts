"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession, isAdmin } from "../auth";
import { deps } from "../deps";
import { users } from "../schema";

export async function toggleUserAllowedAction(
	userId: string,
	isAllowed: boolean,
): Promise<void> {
	const user = await getSession();
	if (!isAdmin(user)) return;

	deps.db.update(users).set({ isAllowed }).where(eq(users.id, userId)).run();
	revalidatePath("/admin");
}
