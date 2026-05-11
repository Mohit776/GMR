ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fcm_tokens text[] DEFAULT '{}';

CREATE OR REPLACE FUNCTION register_fcm_token(token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET fcm_tokens = array_append(array_remove(COALESCE(fcm_tokens, '{}'), token), token)
  WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION unregister_fcm_token(token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET fcm_tokens = array_remove(COALESCE(fcm_tokens, '{}'), token)
  WHERE id = auth.uid();
END;
$$;
