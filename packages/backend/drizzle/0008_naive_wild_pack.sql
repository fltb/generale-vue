ALTER TABLE `custom_maps` ADD `game_type` text DEFAULT 'generale' NOT NULL;--> statement-breakpoint
UPDATE `custom_maps` SET `game_type` = 'generale' WHERE `game_type` IS NULL;
