export default function Loading() {
	return (
		<div className="mx-auto w-full max-w-2xl animate-pulse space-y-4 py-8">
			<div className="h-4 w-24 rounded bg-zinc-800" />
			<div className="h-7 w-2/3 rounded bg-zinc-800" />
			<div className="h-4 w-full rounded bg-zinc-800" />
			<div className="h-4 w-1/2 rounded bg-zinc-800" />
		</div>
	);
}
