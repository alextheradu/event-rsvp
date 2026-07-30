import type { NextConfig } from "next";

const allowedOrigins = (process.env.PUBLIC_URL ?? "")
	.split(",")
	.map((u) =>
		u
			.trim()
			.replace(/^https?:\/\//, "")
			.replace(/\/$/, ""),
	)
	.filter(Boolean);

const nextConfig: NextConfig = {
	serverExternalPackages: ["better-sqlite3"],
	experimental: {
		serverActions: {
			allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : undefined,
		},
	},
};

export default nextConfig;
