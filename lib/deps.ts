import { db } from "./db";
import type { Deps } from "./rsvp";
import { slack } from "./slack";

export const deps: Deps = {
	db,
	slack,
	allowIneligible: process.env.NODE_ENV !== "production",
};
