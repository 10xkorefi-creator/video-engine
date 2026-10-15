-- The only table for the reel pipeline: one row per reel (blog x angle).
-- "Which blogs are used" = select distinct blog_url from reel_jobs.
create table if not exists public.reel_jobs (
  id             bigint generated always as identity primary key,
  blog_url       text        not null,
  angle          text        not null,                 -- 'A', 'B' or 'custom-...'
  status         text        not null default 'queued'
                 check (status in ('queued', 'rendering', 'ready', 'approved', 'rejected', 'failed', 'published')),
  title          text,
  script         text,
  caption        text,                                 -- description incl. hashtags
  hashtags       text[],
  video_url      text,
  duration_s     numeric(6, 2),
  cost_usd       numeric(8, 5),
  render_seconds integer,
  failed_step    text,                                 -- fetch_blog | script | fact_check | tts | timing | assets | compose | render | verify | upload
  error          text,
  reviewed_by    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (blog_url, angle)
);

-- Only the service role (reel-engine, n8n) touches this table.
alter table public.reel_jobs enable row level security;

comment on table public.reel_jobs is 'Blog -> Shorts reel pipeline: one row per rendered reel (status, script, output URL).';
