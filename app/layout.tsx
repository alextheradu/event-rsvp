import type { ReactNode } from "react";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body className="bg-zinc-950 text-zinc-100 min-h-screen antialiased">
				{children}
			</body>
		</html>
	);
}
