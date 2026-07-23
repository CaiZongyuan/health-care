CREATE TABLE `ai_summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer NOT NULL,
	`trigger` text DEFAULT 'manual' NOT NULL,
	`content` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `medications` ADD `time` text;