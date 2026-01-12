-- Migration: 0002_add_telegram_user_fields
-- Description: Добавляет поля для хранения данных пользователей Telegram (firstName, lastName, username, photoUrl, languageCode)
-- Date: 2024-12-19

-- Добавление полей для Telegram пользователей
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS username VARCHAR(255),
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS language_code VARCHAR(10);

-- Обновление constraint для поддержки telegram_id как основного идентификатора
-- Удаляем старый constraint если он существует
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_identity_check;

-- Создаем новый constraint, который позволяет telegram_id, clerk_id или device_id
ALTER TABLE users 
  ADD CONSTRAINT users_identity_check 
  CHECK (
    telegram_id IS NOT NULL OR 
    clerk_id IS NOT NULL OR 
    device_id IS NOT NULL
  );
