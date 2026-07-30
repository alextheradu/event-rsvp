import type { NextConfig } from "next";
import { getPublicOrigins } from "./lib/public-origin";

const { allowedHosts } = getPublicOrigins();

const nextConfig: NextConfig = {
	serverExternalPackages: ["better-sqlite3"],
	experimental: {
		serverActions: {
			allowedOrigins: [...allowedHosts],
		},
	},
	async headers() {
		return [
			{
				source: "/feedback/:path*",
				headers: [
					{ key: "Referrer-Policy", value: "no-referrer" },
					{ key: "Cache-Control", value: "private, no-store" },
					{ key: "X-Robots-Tag", value: "noindex, nofollow" },
				],
			},
		];
	},
};

export default nextConfig;
