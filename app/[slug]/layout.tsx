import type { ReactNode } from "react";

// `Base.astro` passed `minimal` here to hide the nav. A nested layout cannot remove
// a parent layout's output, so the root layout keeps rendering `Nav` and this layout
// only tightens the container. If the nav ever needs to disappear on this route, the
// fix is a `app/(with-nav)/` route group that moves `Nav` out of the root layout.
//
// This layout is shared by the public RSVP card, stats, and the whole manage/*
// subtree — it must not force vertical centering, or full-width management pages
// get squeezed toward the middle of the viewport. Pages that want the centered
// "card" look (the public RSVP page) opt in themselves.
export default function SlugLayout({ children }: { children: ReactNode }) {
	return <div className="py-8">{children}</div>;
}
