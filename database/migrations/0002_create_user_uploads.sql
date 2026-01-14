-- Migration: Create user_uploads table
-- This table stores links to images uploaded by users to Vercel Blob or other storage providers

CREATE TABLE IF NOT EXISTS user_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  file_path TEXT,
  quality_score INTEGER,
  mime_type VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add index for efficient querying of user's uploads
CREATE INDEX IF NOT EXISTS idx_user_uploads_user_id ON user_uploads(user_id);
-- Add index for sorting by creation date
CREATE INDEX IF NOT EXISTS idx_user_uploads_created_at ON user_uploads(created_at);
