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

export const metadata: Metadata = {
	title: "RSVP",
	description: "Quick RSVPs for YSWSes",
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
