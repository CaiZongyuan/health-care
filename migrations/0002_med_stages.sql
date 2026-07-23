ALTER TABLE `med_log` ADD `stage` text;--> statement-breakpoint
ALTER TABLE `medications` ADD `stages` text DEFAULT '[]' NOT NULL;