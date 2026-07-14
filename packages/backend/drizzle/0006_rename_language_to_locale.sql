-- Rename user_settings key 'language' to 'locale' for consistency with GlobalSettings type
UPDATE `user_settings` SET `key` = 'locale' WHERE `key` = 'language';
