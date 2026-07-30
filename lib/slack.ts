export interface SlackProfile {
	displayName: string;
	avatarUrl: string | null;
}

export type SlackResult<T = undefined> =
	| { ok: true; value: T }
	| {
			ok: false;
			error: string;
			retryAfterSeconds?: number;
			retryable: boolean;
	  };

export interface SlackPort {
	dm(slackId: string, text: string): Promise<boolean>;
	inviteToChannel(channelId: string, slackId: string): Promise<boolean>;
	getProfile(slackId: string): Promise<SlackProfile | null>;
	dmDetailed?(
		slackId: string,
		text: string,
	): Promise<SlackResult<{ channelId: string }>>;
	inviteToChannelDetailed?(
		channelId: string,
		slackId: string,
	): Promise<SlackResult>;
}

export function createSlackClient(
	token: string | undefined = process.env.SLACK_BOT_TOKEN,
	fetchImpl: typeof fetch = fetch,
): SlackPort {
	async function callDetailed(
		method: string,
		body?: Record<string, unknown>,
	): Promise<SlackResult<Record<string, unknown>>> {
		if (!token) {
			return { ok: false, error: "not_configured", retryable: false };
		}

		const params = new URLSearchParams();
		for (const [k, v] of Object.entries(body ?? {})) params.set(k, String(v));

		try {
			const res = await fetchImpl(`https://slack.com/api/${method}`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: params.toString(),
			});
			const data = (await res.json()) as Record<string, unknown>;
			if (!data.ok) {
				const error =
					typeof data.error === "string" ? data.error : `http_${res.status}`;
				if (error === "already_in_channel") {
					return { ok: true, value: data };
				}
				const retryAfter = res.headers.get("retry-after");
				return {
					ok: false,
					error,
					retryable:
						res.status === 429 ||
						res.status >= 500 ||
						["ratelimited", "internal_error", "fatal_error"].includes(error),
					...(retryAfter
						? { retryAfterSeconds: Number.parseInt(retryAfter, 10) }
						: {}),
				};
			}
			return { ok: true, value: data };
		} catch {
			return { ok: false, error: "network_error", retryable: true };
		}
	}

	async function call(method: string, body?: Record<string, unknown>) {
		const result = await callDetailed(method, body);
		return result.ok ? result.value : null;
	}

	return {
		async getProfile(slackId) {
			const data = await call("users.info", { user: slackId });
			const user = data?.user as
				| { name?: string; profile?: Record<string, string> }
				| undefined;
			if (!user) return null;
			const profile = user.profile ?? {};
			return {
				displayName:
					profile.display_name || profile.real_name || user.name || slackId,
				avatarUrl: profile.image_192 || profile.image_72 || null,
			};
		},

		async inviteToChannel(channelId, slackId) {
			const result = await this.inviteToChannelDetailed?.(channelId, slackId);
			return result?.ok ?? false;
		},

		async inviteToChannelDetailed(channelId, slackId) {
			await callDetailed("conversations.join", { channel: channelId });
			const result = await callDetailed("conversations.invite", {
				channel: channelId,
				users: slackId,
			});
			return result.ok ? { ok: true, value: undefined } : result;
		},

		async dm(slackId, text) {
			const result = await this.dmDetailed?.(slackId, text);
			return result?.ok ?? false;
		},

		async dmDetailed(slackId, text) {
			const opened = await callDetailed("conversations.open", {
				users: slackId,
			});
			if (!opened.ok) return opened;
			const channel = opened.value.channel as { id?: string } | undefined;
			if (!channel?.id) {
				return { ok: false, error: "dm_channel_missing", retryable: false };
			}
			const posted = await callDetailed("chat.postMessage", {
				channel: channel.id,
				text,
			});
			return posted.ok
				? { ok: true, value: { channelId: channel.id } }
				: posted;
		},
	};
}

export const slack: SlackPort = createSlackClient();
