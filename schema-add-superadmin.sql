-- Add super admin column to users table
-- Only super admins can approve artists and manage the platform

ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT 0;

-- Create index for super admin lookups
CREATE INDEX IF NOT EXISTS idx_users_super_admin ON users(is_super_admin);

-- Update the first user (you) to be super admin
-- This will only work if there's exactly one user
UPDATE users 
SET is_super_admin = 1 
WHERE id = (
    SELECT id FROM users 
    ORDER BY created_at ASC 
    LIMIT 1
);