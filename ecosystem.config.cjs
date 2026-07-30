module.exports = {
	apps: [
		{
			name: "rsvp-web",
			script: "node_modules/next/dist/bin/next",
			args: "start -H 0.0.0.0 -p 4321",
			node_args: "--env-file-if-exists=.env",
			cwd: __dirname,
			env: {
				NODE_ENV: "production",
			},
			autorestart: true,
			max_restarts: 10,
		},
		{
			name: "rsvp-bot",
			script: "node_modules/tsx/dist/cli.mjs",
			args: "worker/slack-bot.ts",
			node_args: "--env-file-if-exists=.env",
			cwd: __dirname,
			env: {
				NODE_ENV: "production",
			},
			autorestart: true,
			max_restarts: 10,
		},
	],
};
