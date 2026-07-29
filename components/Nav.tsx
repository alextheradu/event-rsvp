import Link from "next/link";
import type { SessionUser } from "@/lib/session";

export default function Nav({ user }: { user: SessionUser | null }) {
	const eligible =
		!user || process.env.NODE_ENV !== "production" || user.isAllowed;

	return (
		<nav className="border-b border-zinc-800/60 px-4 py-3">
			<div className="max-w-2xl mx-auto flex items-center justify-between">
				<Link
					href="/"
					className="text-base font-semibold tracking-tight hover:text-zinc-300 transition-colors"
				>
					RSVP
				</Link>
				<div className="flex items-center gap-4">
					{user ? (
						<>
							{eligible ? (
								<Link
									href="/new"
									className="text-sm bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-dark transition-colors font-medium"
								>
									New form
								</Link>
							) : (
								<span className="text-sm bg-zinc-800 text-zinc-600 px-3 py-1.5 rounded-lg cursor-not-allowed">
									New form
								</span>
							)}
							<div className="flex items-center gap-2.5">
								{user.avatarUrl ? (
									<img
										src={user.avatarUrl}
										alt=""
										className="w-6 h-6 rounded-full"
									/>
								) : (
									<div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[11px] text-zinc-500 font-medium">
										{user.name.charAt(0).toUpperCase()}
									</div>
								)}
								<span className="text-sm text-zinc-400 hidden sm:inline max-w-30 truncate">
									{user.name}
								</span>
								<a
									href="/auth/logout"
									className="text-sm text-zinc-600 hover:text-zinc-300 transition-colors"
								>
									Sign out
								</a>
							</div>
						</>
					) : (
						<a
							href="/auth/login"
							className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
						>
							Sign in
						</a>
					)}
				</div>
			</div>
		</nav>
	);
}
