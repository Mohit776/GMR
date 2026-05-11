-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add-city-to-users.sql
-- Purpose:   Add city column to users table for guide city-based lookup
-- Run in:    Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Add city to users (guides fill this during onboarding)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS city text;

UPDATE public.users
SET city = nullif(split_part(coalesce(profile_data->>'city', profile_data->>'location', ''), ',', 1), '')
WHERE role = 'guide'
  AND (city IS NULL OR city = '');

-- Index for fast city-based guide lookup
CREATE INDEX IF NOT EXISTS users_city_role_idx
  ON public.users(city, role)
  WHERE role = 'guide';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
