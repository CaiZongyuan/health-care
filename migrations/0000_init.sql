CREATE TABLE `bp_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`measured_at` integer NOT NULL,
	`is_morning` integer DEFAULT false NOT NULL,
	`sys` integer NOT NULL,
	`dia` integer NOT NULL,
	`hr` integer,
	`spo2` integer,
	`symptoms` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `med_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`med_id` integer NOT NULL,
	`taken_date` text NOT NULL,
	`taken_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `medications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`dosage` text DEFAULT '' NOT NULL,
	`time_of_day` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
