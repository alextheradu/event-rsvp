"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
	{ label: "Overview", segment: "" },
	{ label: "Roster", segment: "/roster" },
	{ label: "Messages", segment: "/notifications" },
	{ label: "Feedback", segment: "/feedback" },
] as const;

export default function ManageNav({ slug }: { slug: string }) {
	const pathname = usePathname();
	const base = `/${slug}/manage`;
	return (
		<nav
			aria-label="Event management"
			className="-mb-px flex gap-1 overflow-x-auto"
		>
			{tabs.map(({ label, segment }) => {
				const href = `${base}${segment}`;
				const active =
					segment === ""
						? pathname === base
						: pathname === href || pathname.startsWith(`${href}/`);
				return (
					<Link
						key={href}
						href={href}
						aria-current={active ? "page" : undefined}
						className={`relative shrink-0 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
							active ? "text-white" : "text-zinc-500 hover:text-zinc-200"
						}`}
					>
						{label}
						{active && (
							<span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
						)}
					</Link>
				);
			})}
		</nav>
	);
}
