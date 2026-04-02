-- Copy any useful display_name values to alias (only for Contributors)
UPDATE chat_users 
SET alias = display_name 
WHERE alias IS NULL 
  AND display_name IS NOT NULL 
  AND display_name NOT ILIKE '0x%'
  AND (role = 'contributor' OR role = 'admin' OR role = 'master-admin');

-- Drop the display_name column
ALTER TABLE chat_users 
DROP COLUMN IF EXISTS display_name;
