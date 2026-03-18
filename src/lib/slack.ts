async function slackApi(method: string, body?: Record<string, unknown>) {
	const botToken = import.meta.env.SLACK_BOT_TOKEN;
	if (!botToken) return null;

	const params = new URLSearchParams();
	if (body) {
		for (const [k, v] of Object.entries(body)) params.set(k, String(v));
	}

	const res = await fetch(`https://slack.com/api/${method}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${botToken}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: params.toString(),
	});

	const data = await res.json();
	if (!data.ok) {
		console.error(`Slack API ${method} failed:`, data.error);
		return null;
	}
	return data;
}

export async function getSlackUser(slackId: string): Promise<{
	displayName: string;
	avatarUrl: string;
} | null> {
	const data = await slackApi("users.info", { user: slackId });
	if (!data?.user) return null;

	const profile = data.user.profile;
	return {
		displayName: profile.display_name || profile.real_name || data.user.name,
		avatarUrl: profile.image_192 || profile.image_72 || null,
	};
}

export async function inviteToChannel(
	channelId: string,
	slackId: string,
): Promise<boolean> {
	const data = await slackApi("conversations.invite", {
		channel: channelId,
		users: slackId,
	});
	return data !== null;
}
