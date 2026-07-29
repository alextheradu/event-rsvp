export interface SlackProfile {
	displayName: string;
	avatarUrl: string | null;
}

export interface SlackPort {
	dm(slackId: string, text: string): Promise<boolean>;
	inviteToChannel(channelId: string, slackId: string): Promise<boolean>;
	getProfile(slackId: string): Promise<SlackProfile | null>;
}

export function createSlackClient(
	token: string | undefined = process.env.SLACK_BOT_TOKEN,
	fetchImpl: typeof fetch = fetch,
): SlackPort {
	async function call(
		method: string,
		body?: Record<string, unknown>,
	): Promise<Record<string, unknown> | null> {
		if (!token) return null;

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
				console.error(`slack: ${method} failed:`, data.error);
				return null;
			}
			return data;
		} catch (err) {
			console.error(`slack: ${method} threw:`, err);
			return null;
		}
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
			await call("conversations.join", { channel: channelId });
			const data = await call("conversations.invite", {
				channel: channelId,
				users: slackId,
			});
			return data !== null;
		},

		async dm(slackId, text) {
			const opened = await call("conversations.open", { users: slackId });
			const channel = opened?.channel as { id?: string } | undefined;
			if (!channel?.id) return false;
			const posted = await call("chat.postMessage", {
				channel: channel.id,
				text,
			});
			return posted !== null;
		},
	};
}

export const slack: SlackPort = createSlackClient();
