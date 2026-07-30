CREATE TABLE `channel_access_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`rsvp_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`lease_owner` text,
	`leased_at` integer,
	`verification_status` text,
	`verification_checked_at` integer,
	`slack_error` text,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`rsvp_id`) REFERENCES `rsvps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `channel_access_due_idx` ON `channel_access_attempts` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `channel_access_active_idx` ON `channel_access_attempts` (`rsvp_id`,`kind`) WHERE "channel_access_attempts"."status" in ('queued', 'leased', 'retrying');--> statement-breakpoint
CREATE TABLE `event_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`form_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`kind` text NOT NULL,
	`before_json` text NOT NULL,
	`after_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `event_changes_form_idx` ON `event_changes` (`form_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `feedback_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`response_id` text NOT NULL,
	`question_id` text NOT NULL,
	`value_json` text NOT NULL,
	FOREIGN KEY (`response_id`) REFERENCES `feedback_responses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`question_id`) REFERENCES `feedback_questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_answer_response_question` ON `feedback_answers` (`response_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `feedback_forms` (
	`id` text PRIMARY KEY NOT NULL,
	`form_id` text NOT NULL,
	`title` text NOT NULL,
	`dm_template` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`closed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_forms_form_unique` ON `feedback_forms` (`form_id`);--> statement-breakpoint
CREATE TABLE `feedback_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`feedback_form_id` text NOT NULL,
	`rsvp_id` text NOT NULL,
	`sent_at` integer,
	`opened_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`feedback_form_id`) REFERENCES `feedback_forms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rsvp_id`) REFERENCES `rsvps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_invitation_form_rsvp` ON `feedback_invitations` (`feedback_form_id`,`rsvp_id`);--> statement-breakpoint
CREATE TABLE `feedback_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`feedback_form_id` text NOT NULL,
	`kind` text NOT NULL,
	`prompt` text NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`position` integer NOT NULL,
	`options_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`feedback_form_id`) REFERENCES `feedback_forms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_question_position` ON `feedback_questions` (`feedback_form_id`,`position`);--> statement-breakpoint
CREATE TABLE `feedback_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`invitation_id` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`invitation_id`) REFERENCES `feedback_invitations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_responses_invitation_id_unique` ON `feedback_responses` (`invitation_id`);--> statement-breakpoint
CREATE TABLE `notification_campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`form_id` text NOT NULL,
	`kind` text NOT NULL,
	`audience` text NOT NULL,
	`template` text NOT NULL,
	`is_operational` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`creator_id` text NOT NULL,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notification_campaign_form_idx` ON `notification_campaigns` (`form_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`rsvp_id` text NOT NULL,
	`user_id` text NOT NULL,
	`slack_id_snapshot` text,
	`rendered_text` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`lease_owner` text,
	`leased_at` integer,
	`slack_error` text,
	`sent_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `notification_campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rsvp_id`) REFERENCES `rsvps`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_delivery_campaign_rsvp` ON `notification_deliveries` (`campaign_id`,`rsvp_id`);--> statement-breakpoint
CREATE INDEX `notification_delivery_due_idx` ON `notification_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
ALTER TABLE `forms` ADD `start_at` integer;--> statement-breakpoint
ALTER TABLE `forms` ADD `end_at` integer;--> statement-breakpoint
ALTER TABLE `forms` ADD `timezone` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `event_format` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `capacity` integer;--> statement-breakpoint
ALTER TABLE `forms` ADD `attendee_notes` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `location_display` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `location_latitude` real;--> statement-breakpoint
ALTER TABLE `forms` ADD `location_longitude` real;--> statement-breakpoint
ALTER TABLE `forms` ADD `location_provider` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `location_place_id` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `online_url` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `cancelled_at` integer;--> statement-breakpoint
ALTER TABLE `forms` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `forms` SET `updated_at` = `created_at` WHERE `updated_at` = 0;--> statement-breakpoint
CREATE INDEX `forms_start_at_idx` ON `forms` (`start_at`);--> statement-breakpoint
ALTER TABLE `rsvps` ADD `status` text DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE `rsvps` ADD `cancelled_at` integer;--> statement-breakpoint
ALTER TABLE `rsvps` ADD `checked_in_at` integer;--> statement-breakpoint
ALTER TABLE `rsvps` ADD `checked_in_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `rsvps` ADD `notifications_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `rsvps` ADD `verification_status` text;--> statement-breakpoint
ALTER TABLE `rsvps` ADD `verification_checked_at` integer;--> statement-breakpoint
ALTER TABLE `rsvps` ADD `channel_access_status` text DEFAULT 'not_requested' NOT NULL;--> statement-breakpoint
ALTER TABLE `rsvps` ADD `channel_access_updated_at` integer;--> statement-breakpoint
ALTER TABLE `rsvps` ADD `channel_access_error` text;--> statement-breakpoint
CREATE INDEX `rsvp_form_status_created_idx` ON `rsvps` (`form_id`,`status`,`created_at`);
