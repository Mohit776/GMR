-- Add partner_fcm_tokens column for partner-app-specific FCM tokens
ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_fcm_tokens text[] DEFAULT '{}'::text[];

-- Drop old version (signature change requires DROP first)
DROP FUNCTION IF EXISTS register_fcm_token(text);

-- New version: supports p_app param to route token to the right column
CREATE OR REPLACE FUNCTION register_fcm_token(p_token text, p_app text DEFAULT 'user')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_app = 'partner' THEN
    UPDATE users
    SET partner_fcm_tokens = array_append(array_remove(COALESCE(partner_fcm_tokens, '{}'), p_token), p_token)
    WHERE id = auth.uid();
  ELSE
    UPDATE users
    SET fcm_tokens = array_append(array_remove(COALESCE(fcm_tokens, '{}'), p_token), p_token)
    WHERE id = auth.uid();
  END IF;
END;
$$;
