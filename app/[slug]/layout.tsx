import type { ReactNode } from "react";

// `Base.astro` passed `minimal` here to hide the nav. A nested layout cannot remove
// a parent layout's output, so the root layout keeps rendering `Nav` and this layout
// only tightens the container. If the nav ever needs to disappear on this route, the
// fix is a `app/(with-nav)/` route group that moves `Nav` out of the root layout.
export default function SlugLayout({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-[80vh] flex items-center justify-center py-8">
			{children}
		</div>
	);
}
