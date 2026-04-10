-- Create clubhousechats table (lowercase for Supabase REST API compatibility)
CREATE TABLE IF NOT EXISTS public.clubhousechats (
  id BIGSERIAL PRIMARY KEY,
  team TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  username TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message TEXT NOT NULL,
  thumbsUp INT4 DEFAULT 0,
  thumbsDown INT4 DEFAULT 0
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clubhousechats_team ON public.clubhousechats(team);
CREATE INDEX IF NOT EXISTS idx_clubhousechats_created_at ON public.clubhousechats(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.clubhousechats ENABLE ROW LEVEL SECURITY;

-- Policy: Allow SELECT for all authenticated users
CREATE POLICY "Allow SELECT chats for authenticated users"
ON public.clubhousechats
FOR SELECT
USING (true);

-- Policy: Allow INSERT for authenticated users
CREATE POLICY "Allow INSERT chats for authenticated users"
ON public.clubhousechats
FOR INSERT
WITH CHECK (true);

-- Policy: Allow UPDATE of thumbsUp and thumbsDown for authenticated users
CREATE POLICY "Allow UPDATE thumbs for authenticated users"
ON public.clubhousechats
FOR UPDATE
USING (true)
WITH CHECK (true);
