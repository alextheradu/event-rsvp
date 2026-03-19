// @ts-check

import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
	output: "server",
	adapter: node({ mode: "standalone" }),
	security: { checkOrigin: false, allowedDomains: [{}] },
	vite: {
		plugins: [tailwindcss()],
		ssr: {
			external: ["bun:sqlite"],
		},
	},
});
