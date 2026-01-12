/**
 * User Repository
 * Data access layer for users - only SQL queries, no business logic
 * Uses direct SQL queries for maximum reliability with Vercel Postgres
 */

import { schema } from '../db/index.js';
import { sql } from './database.js';

// Re-export types from schema for backward compatibility
export type User = typeof schema.users.$inferSelect;
export interface CreateUserData {
  clerk_id?: string;
  device_id?: string;
  email?: string;
  telegram_id?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  vk_id?: string;
  yandex_id?: string;
  password_hash?: string;
}

/**
 * Find user by Clerk ID
 */
export async function findByClerkId(clerkId: string): Promise<User | null> {
  const result = await sql<User>`
    SELECT 
      id,
      clerk_id AS "clerkId",
      device_id AS "deviceId",
      email,
      telegram_id AS "telegramId",
      first_name AS "firstName",
      last_name AS "lastName",
      username,
      photo_url AS "photoUrl",
      language_code AS "languageCode",
      vk_id AS "vkId",
      yandex_id AS "yandexId",
      password_hash AS "passwordHash",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM users
    WHERE clerk_id = ${clerkId}
    LIMIT 1
  `;
  
  return result.rows[0] || null;
}

/**
 * Find user by device ID
 */
export async function findByDeviceId(deviceId: string): Promise<User | null> {
  const result = await sql<User>`
    SELECT 
      id,
      clerk_id AS "clerkId",
      device_id AS "deviceId",
      email,
      telegram_id AS "telegramId",
      first_name AS "firstName",
      last_name AS "lastName",
      username,
      photo_url AS "photoUrl",
      language_code AS "languageCode",
      vk_id AS "vkId",
      yandex_id AS "yandexId",
      password_hash AS "passwordHash",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM users
    WHERE device_id = ${deviceId}
    LIMIT 1
  `;
  
  return result.rows[0] || null;
}

/**
 * Find user by Telegram ID
 */
export async function findByTelegramId(telegramId: string): Promise<User | null> {
  const result = await sql<User>`
    SELECT 
      id,
      clerk_id AS "clerkId",
      device_id AS "deviceId",
      email,
      telegram_id AS "telegramId",
      first_name AS "firstName",
      last_name AS "lastName",
      username,
      photo_url AS "photoUrl",
      language_code AS "languageCode",
      vk_id AS "vkId",
      yandex_id AS "yandexId",
      password_hash AS "passwordHash",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM users
    WHERE telegram_id = ${telegramId}
    LIMIT 1
  `;
  
  return result.rows[0] || null;
}

/**
 * Find user by ID
 */
export async function findById(userId: string): Promise<User | null> {
  const result = await sql<User>`
    SELECT 
      id,
      clerk_id AS "clerkId",
      device_id AS "deviceId",
      email,
      telegram_id AS "telegramId",
      first_name AS "firstName",
      last_name AS "lastName",
      username,
      photo_url AS "photoUrl",
      language_code AS "languageCode",
      vk_id AS "vkId",
      yandex_id AS "yandexId",
      password_hash AS "passwordHash",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;
  
  return result.rows[0] || null;
}

/**
 * Create a new user
 */
export async function create(userData: CreateUserData): Promise<User> {
  const result = await sql<User>`
    INSERT INTO users (
      clerk_id,
      device_id,
      email,
      telegram_id,
      first_name,
      last_name,
      username,
      photo_url,
      language_code,
      vk_id,
      yandex_id,
      password_hash
    ) VALUES (
      ${userData.clerk_id || null},
      ${userData.device_id || null},
      ${userData.email || null},
      ${userData.telegram_id || null},
      ${userData.first_name || null},
      ${userData.last_name || null},
      ${userData.username || null},
      ${userData.photo_url || null},
      ${userData.language_code || null},
      ${userData.vk_id || null},
      ${userData.yandex_id || null},
      ${userData.password_hash || null}
    )
    RETURNING 
      id,
      clerk_id AS "clerkId",
      device_id AS "deviceId",
      email,
      telegram_id AS "telegramId",
      first_name AS "firstName",
      last_name AS "lastName",
      username,
      photo_url AS "photoUrl",
      language_code AS "languageCode",
      vk_id AS "vkId",
      yandex_id AS "yandexId",
      password_hash AS "passwordHash",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;
  
  return result.rows[0];
}

/**
 * Get or create user atomically using SELECT first, then INSERT if needed
 * This prevents unnecessary UPDATE operations on every request
 * Thread-safe: multiple concurrent calls will return the same user
 * Optimized: reads first (fast), writes only when necessary
 * Priority: telegram_id > clerk_id > device_id
 */
export async function getOrCreateUser(userData: CreateUserData): Promise<User> {
  // Priority 1: Telegram ID (primary for TMA)
  if (userData.telegram_id) {
    const existing = await findByTelegramId(userData.telegram_id);
    if (existing) {
      // Update user data if new fields are provided
      if (userData.first_name || userData.last_name || userData.username || userData.photo_url || userData.language_code) {
        const updated = await sql<User>`
          UPDATE users
          SET 
            first_name = COALESCE(${userData.first_name || null}, first_name),
            last_name = COALESCE(${userData.last_name || null}, last_name),
            username = COALESCE(${userData.username || null}, username),
            photo_url = COALESCE(${userData.photo_url || null}, photo_url),
            language_code = COALESCE(${userData.language_code || null}, language_code),
            updated_at = NOW()
          WHERE telegram_id = ${userData.telegram_id}
          RETURNING 
            id,
            clerk_id AS "clerkId",
            device_id AS "deviceId",
            email,
            telegram_id AS "telegramId",
            first_name AS "firstName",
            last_name AS "lastName",
            username,
            photo_url AS "photoUrl",
            language_code AS "languageCode",
            vk_id AS "vkId",
            yandex_id AS "yandexId",
            password_hash AS "passwordHash",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `;
        if (updated.rows.length > 0) {
          return updated.rows[0];
        }
      }
      return existing;
    }
    
    // User doesn't exist, create it atomically
    try {
      const insertResult = await sql<User>`
        INSERT INTO users (
          clerk_id,
          device_id,
          email,
          telegram_id,
          first_name,
          last_name,
          username,
          photo_url,
          language_code,
          vk_id,
          yandex_id,
          password_hash
        ) VALUES (
          ${userData.clerk_id || null},
          ${userData.device_id || null},
          ${userData.email || null},
          ${userData.telegram_id},
          ${userData.first_name || null},
          ${userData.last_name || null},
          ${userData.username || null},
          ${userData.photo_url || null},
          ${userData.language_code || null},
          ${userData.vk_id || null},
          ${userData.yandex_id || null},
          ${userData.password_hash || null}
        )
        ON CONFLICT (telegram_id) DO NOTHING
        RETURNING 
          id,
          clerk_id AS "clerkId",
          device_id AS "deviceId",
          email,
          telegram_id AS "telegramId",
          first_name AS "firstName",
          last_name AS "lastName",
          username,
          photo_url AS "photoUrl",
          language_code AS "languageCode",
          vk_id AS "vkId",
          yandex_id AS "yandexId",
          password_hash AS "passwordHash",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `;
      
      // If insert succeeded, return the new user
      if (insertResult.rows.length > 0) {
        return insertResult.rows[0];
      }
      
      // Insert was skipped due to conflict (race condition), fetch existing user
      const created = await findByTelegramId(userData.telegram_id);
      if (created) {
        return created;
      }
    } catch (error) {
      // If insert fails, try one more time to find existing user
      const existing = await findByTelegramId(userData.telegram_id);
      if (existing) {
        return existing;
      }
      throw error;
    }
  }

  // Priority 2: Clerk ID (backward compatibility)
  if (userData.clerk_id) {
    const existing = await findByClerkId(userData.clerk_id);
    if (existing) {
      return existing;
    }
    
    // User doesn't exist, create it atomically
    try {
      const insertResult = await sql<User>`
        INSERT INTO users (
          clerk_id,
          device_id,
          email,
          telegram_id,
          first_name,
          last_name,
          username,
          photo_url,
          language_code,
          vk_id,
          yandex_id,
          password_hash
        ) VALUES (
          ${userData.clerk_id},
          ${userData.device_id || null},
          ${userData.email || null},
          ${userData.telegram_id || null},
          ${userData.first_name || null},
          ${userData.last_name || null},
          ${userData.username || null},
          ${userData.photo_url || null},
          ${userData.language_code || null},
          ${userData.vk_id || null},
          ${userData.yandex_id || null},
          ${userData.password_hash || null}
        )
        ON CONFLICT (clerk_id) DO NOTHING
        RETURNING 
          id,
          clerk_id AS "clerkId",
          device_id AS "deviceId",
          email,
          telegram_id AS "telegramId",
          first_name AS "firstName",
          last_name AS "lastName",
          username,
          photo_url AS "photoUrl",
          language_code AS "languageCode",
          vk_id AS "vkId",
          yandex_id AS "yandexId",
          password_hash AS "passwordHash",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `;
      
      if (insertResult.rows.length > 0) {
        return insertResult.rows[0];
      }
      
      const created = await findByClerkId(userData.clerk_id);
      if (created) {
        return created;
      }
    } catch (error) {
      const existing = await findByClerkId(userData.clerk_id);
      if (existing) {
        return existing;
      }
      throw error;
    }
  }

  // Priority 3: Device ID (fallback for anonymous users)
  if (userData.device_id) {
    const existing = await findByDeviceId(userData.device_id);
    if (existing) {
      return existing;
    }
    
    // User doesn't exist, create it atomically
    try {
      const insertResult = await sql<User>`
        INSERT INTO users (
          clerk_id,
          device_id,
          email,
          telegram_id,
          first_name,
          last_name,
          username,
          photo_url,
          language_code,
          vk_id,
          yandex_id,
          password_hash
        ) VALUES (
          ${userData.clerk_id || null},
          ${userData.device_id},
          ${userData.email || null},
          ${userData.telegram_id || null},
          ${userData.first_name || null},
          ${userData.last_name || null},
          ${userData.username || null},
          ${userData.photo_url || null},
          ${userData.language_code || null},
          ${userData.vk_id || null},
          ${userData.yandex_id || null},
          ${userData.password_hash || null}
        )
        ON CONFLICT (device_id) DO NOTHING
        RETURNING 
          id,
          clerk_id AS "clerkId",
          device_id AS "deviceId",
          email,
          telegram_id AS "telegramId",
          first_name AS "firstName",
          last_name AS "lastName",
          username,
          photo_url AS "photoUrl",
          language_code AS "languageCode",
          vk_id AS "vkId",
          yandex_id AS "yandexId",
          password_hash AS "passwordHash",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `;
      
      if (insertResult.rows.length > 0) {
        return insertResult.rows[0];
      }
      
      const created = await findByDeviceId(userData.device_id);
      if (created) {
        return created;
      }
    } catch (error) {
      const existing = await findByDeviceId(userData.device_id);
      if (existing) {
        return existing;
      }
      throw error;
    }
  }

  // If we get here, no valid identifier was provided
  throw new Error('Either telegram_id, clerk_id, or device_id must be provided');
}

