import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import { getSession } from "@/lib/auth";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-jakarta",
});

// `metadataBase` lets Next resolve relative og:url values against the real public
// origin. Without it, og:url is omitted and Slack unfurls degrade.
const publicUrl = (process.env.PUBLIC_URL ?? "http://localhost:4321")
	.split(",")[0]
	.trim()
	.replace(/\/$/, "");

export const metadata: Metadata = {
	metadataBase: new URL(publicUrl),
	title: "RSVP",
	description: "Quick RSVPs for YSWSes",
	// Slack link unfurling reads these. Posting an RSVP link in Slack is this app's
	// primary distribution channel, so dropping them would degrade the main path
	// people use to find an event — while looking perfectly fine locally.
	openGraph: {
		title: "RSVP",
		description: "Quick RSVPs for YSWSes",
		type: "website",
		url: "/",
	},
	twitter: {
		card: "summary",
		title: "RSVP",
		description: "Quick RSVPs for YSWSes",
	},
};

export default async function RootLayout({
	children,
}: {
	children: ReactNode;
}) {
	const user = await getSession();

	return (
		<html lang="en" className={jakarta.variable}>
			<body className="bg-zinc-950 text-zinc-100 min-h-screen font-sans antialiased">
				<Nav user={user} />
				<main className="max-w-3xl mx-auto px-4 py-12">{children}</main>
			</body>
		</html>
	);
}
