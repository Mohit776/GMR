-- Fix: rename RPC parameter from 'token' to 'p_token' to match what the mobile apps send.
-- The apps call: supabase.rpc('register_fcm_token', { p_token: '...' })
-- But the previous migration used 'token' as the parameter name, so the RPC silently ignored it.
-- PostgreSQL cannot rename params via CREATE OR REPLACE, so we must DROP first.

DROP FUNCTION IF EXISTS register_fcm_token(text);
DROP FUNCTION IF EXISTS unregister_fcm_token(text);

CREATE OR REPLACE FUNCTION register_fcm_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET fcm_tokens = array_append(array_remove(COALESCE(fcm_tokens, '{}'), p_token), p_token)
  WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION unregister_fcm_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET fcm_tokens = array_remove(COALESCE(fcm_tokens, '{}'), p_token)
  WHERE id = auth.uid();
END;
$$;
