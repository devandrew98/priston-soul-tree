-- Free-text "what's new" notes shown next to the Home download button,
-- edited manually from Admin -> Download alongside the release link.
alter table public.app_downloads add column if not exists notes text;
