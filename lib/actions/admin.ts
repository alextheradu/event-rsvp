"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession, isAdmin } from "../auth";
import { addBlockedWord, removeBlockedWord } from "../content-policy";
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

export interface BlockedWordActionState {
	error?: string;
	success?: string;
}

export async function addBlockedWordAction(
	_prev: BlockedWordActionState,
	data: FormData,
): Promise<BlockedWordActionState> {
	const user = await getSession();
	if (!isAdmin(user) || !user) return { error: "Not authorized" };

	const word = String(data.get("word") ?? "").trim();
	const result = addBlockedWord(deps.db, word, user.id);
	if (!result.ok) return { error: result.error };
	revalidatePath("/admin");
	return { success: `Added “${word}”` };
}

export async function removeBlockedWordAction(id: string): Promise<void> {
	const user = await getSession();
	if (!isAdmin(user)) return;
	removeBlockedWord(deps.db, id);
	revalidatePath("/admin");
}
