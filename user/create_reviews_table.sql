-- Run this script in the Supabase SQL Editor

-- 1. Create the reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  item_id UUID,
  vendor_id UUID,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- 2. Add Row Level Security (RLS) policies
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read reviews
CREATE POLICY "Reviews are viewable by everyone." 
  ON public.reviews FOR SELECT 
  USING (true);

-- Allow authenticated users to insert their own reviews
CREATE POLICY "Users can insert their own reviews." 
  ON public.reviews FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Optional: If you want users to be able to update/delete their own reviews
CREATE POLICY "Users can update their own reviews." 
  ON public.reviews FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews." 
  ON public.reviews FOR DELETE 
  USING (auth.uid() = user_id);
