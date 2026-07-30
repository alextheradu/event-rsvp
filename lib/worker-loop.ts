import {
	enqueueDueChannelRechecks,
	processNextChannelAccess,
} from "./channel-access";
import type { DB } from "./db";
import { processNextNotification } from "./notifications";
import type { SlackPort } from "./slack";
import type { VerificationPort } from "./verification";

export interface WorkerLoop {
	stop(): Promise<void>;
}

export function startWorkerLoop(
	db: DB,
	slack: SlackPort,
	verification: VerificationPort,
	options: { pollMs?: number; workerId?: string } = {},
): WorkerLoop {
	const pollMs = options.pollMs ?? 1_000;
	const workerId = options.workerId ?? `worker-${crypto.randomUUID()}`;
	let stopped = false;
	let active: Promise<void> | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const tick = async () => {
		if (stopped || active) return;
		active = (async () => {
			enqueueDueChannelRechecks(db);
			await processNextChannelAccess(db, slack, verification, workerId);
			await processNextNotification(db, slack, workerId);
		})().finally(() => {
			active = null;
			if (!stopped) timer = setTimeout(tick, pollMs);
		});
		await active;
	};
	timer = setTimeout(tick, 0);

	return {
		async stop() {
			stopped = true;
			if (timer) clearTimeout(timer);
			if (active) await active;
		},
	};
}
