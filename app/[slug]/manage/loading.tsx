export default function Loading() {
	return (
		<div className="animate-pulse space-y-6">
			<div className="h-24 rounded-2xl bg-zinc-900/65 ring-1 ring-inset ring-zinc-800/80" />
			<div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-zinc-800/80 lg:grid-cols-4">
				{["confirmed", "waitlisted", "checked-in", "access"].map((key) => (
					<div key={key} className="h-20 bg-zinc-900/90" />
				))}
			</div>
			<div className="h-64 rounded-2xl bg-zinc-900/65 ring-1 ring-inset ring-zinc-800/80" />
		</div>
	);
}
