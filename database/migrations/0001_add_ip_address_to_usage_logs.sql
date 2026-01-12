-- Migration: Add ip_address column to usage_logs table
-- This enables IP-based rate limiting to prevent users from bypassing limits
-- by clearing browser storage (localStorage/cookies)

-- Add ip_address column (nullable to support existing records)
ALTER TABLE usage_logs 
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

-- Add index for IP-based queries (IPv6 can be up to 45 chars)
CREATE INDEX IF NOT EXISTS idx_usage_logs_ip_address ON usage_logs(ip_address);

-- Add composite index for efficient rate limit queries (user_id + ip_address + action + created_at)
CREATE INDEX IF NOT EXISTS idx_usage_logs_rate_limit ON usage_logs(user_id, ip_address, action, created_at);

