"use client";

import { useTransition } from "react";
import { retryDeliveryAction } from "@/lib/actions/notifications";

export default function RetryDeliveryButton({
	deliveryId,
}: {
	deliveryId: string;
}) {
	const [pending, start] = useTransition();
	return (
		<button
			type="button"
			disabled={pending}
			onClick={() =>
				start(async () => {
					await retryDeliveryAction(deliveryId);
				})
			}
			className="text-xs text-primary"
		>
			{pending ? "Retrying…" : "Retry"}
		</button>
	);
}
