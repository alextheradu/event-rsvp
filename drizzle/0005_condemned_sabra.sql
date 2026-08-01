CREATE TABLE `blocked_words` (
	`id` text PRIMARY KEY NOT NULL,
	`word` text NOT NULL,
	`normalized` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blocked_words_normalized_unique` ON `blocked_words` (`normalized`);