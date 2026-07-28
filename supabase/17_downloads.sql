-- Fase 19 — download do app gerenciável pelo painel admin. SQL Editor -> Run.
-- O executável fica no Storage (não no repositório) e o admin troca pelo painel.

-- Bucket público para os instaladores. file_size_limit em 100 MB (o upload real
-- ainda depende do limite do seu PLANO Supabase — o gratuito costuma capar em 50 MB).
insert into storage.buckets (id, name, public, file_size_limit)
values ('downloads', 'downloads', true, 104857600)
on conflict (id) do update set public = true, file_size_limit = 104857600;

drop policy if exists "public read downloads" on storage.objects;
create policy "public read downloads" on storage.objects for select using (bucket_id = 'downloads');
drop policy if exists "admin write downloads" on storage.objects;
create policy "admin write downloads" on storage.objects for insert to authenticated
  with check (bucket_id = 'downloads' and public.is_admin());
drop policy if exists "admin update downloads" on storage.objects;
create policy "admin update downloads" on storage.objects for update to authenticated
  using (bucket_id = 'downloads' and public.is_admin());
drop policy if exists "admin delete downloads" on storage.objects;
create policy "admin delete downloads" on storage.objects for delete to authenticated
  using (bucket_id = 'downloads' and public.is_admin());

-- Metadados do download atual (caminho no bucket, nome do arquivo, tamanho, versão).
create table if not exists public.app_downloads (
  key        text primary key,          -- ex.: 'overlay_timer_boss'
  path       text not null,             -- caminho dentro do bucket downloads
  filename   text not null default 'download.exe',
  size       bigint,
  version    text,
  updated_at timestamptz not null default now()
);
alter table public.app_downloads enable row level security;
drop policy if exists ad_read on public.app_downloads;
create policy ad_read on public.app_downloads for select using (true);       -- todos veem
drop policy if exists ad_admin on public.app_downloads;
create policy ad_admin on public.app_downloads for all
  using (public.is_admin()) with check (public.is_admin());                   -- só admin edita
