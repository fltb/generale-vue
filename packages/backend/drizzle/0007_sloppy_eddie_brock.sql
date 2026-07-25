CREATE TABLE `bomberman_replay_participants` (
	`replay_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`replay_id`, `user_id`),
	FOREIGN KEY (`replay_id`) REFERENCES `bomberman_replays`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bomberman_replay_rounds` (
	`replay_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`round_number` integer NOT NULL,
	`attempt` integer NOT NULL,
	`ticks` integer NOT NULL,
	`payload_blob` text NOT NULL,
	PRIMARY KEY(`replay_id`, `sequence`),
	FOREIGN KEY (`replay_id`) REFERENCES `bomberman_replays`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bomberman_replays` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`status` text DEFAULT 'recording' NOT NULL,
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`expires_at` integer NOT NULL,
	`engine_version` integer NOT NULL,
	`format` text NOT NULL,
	`config_json` text,
	`winner_json` text,
	`result_json` text,
	`error_message` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bomberman_replays_match_id_unique` ON `bomberman_replays` (`match_id`);