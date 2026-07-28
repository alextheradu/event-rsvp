/// <reference types="astro/client" />

declare namespace App {
	interface Locals {
		user: {
			id: string;
			name: string;
			email: string;
			avatarUrl: string | null;
			isAllowed: boolean;
			slackId: string | null;
		} | null;
	}
}
