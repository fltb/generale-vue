CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `profiles` ADD `display_name` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `avatar_thumb_url` text;--> statement-breakpoint
ALTER TABLE `verification_tokens` ADD `purpose` text DEFAULT 'register' NOT NULL;--> statement-breakpoint
ALTER TABLE `verification_tokens` ADD `new_email` text;