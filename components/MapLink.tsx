"use client";

import type { MouseEvent } from "react";

export default function MapLink({
	display,
	latitude,
	longitude,
}: {
	display: string;
	latitude: number | null;
	longitude: number | null;
}) {
	const query =
		latitude !== null && longitude !== null
			? `${latitude},${longitude}`
			: display;
	const fallback = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
	function openNative(event: MouseEvent<HTMLAnchorElement>) {
		if (!/iPhone|iPad|Macintosh/i.test(navigator.userAgent)) return;
		event.preventDefault();
		window.location.href = `https://maps.apple.com/?daddr=${encodeURIComponent(query)}`;
	}
	return (
		<a
			href={fallback}
			onClick={openNative}
			target="_blank"
			rel="noopener noreferrer"
			className="text-primary hover:underline"
		>
			{display}
		</a>
	);
}
