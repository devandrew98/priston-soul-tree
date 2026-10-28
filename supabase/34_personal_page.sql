-- Página pessoal (pristonzone.com/pessoalhadder): o texto do guia fica aqui e é editado dentro da própria página.
-- Todos podem LER; só o administrador (is_admin) escreve, e isso é garantido aqui no banco (RLS), não na tela.
-- As marcações de "feito" de cada visitante ficam só no navegador dele (não vão para o banco).
-- Rode uma vez no SQL Editor do Supabase. Enquanto nada for salvo, a página mostra o texto original que já vem no site.

create table if not exists public.personal_pages (
  slug       text primary key check (slug ~ '^[a-z0-9_-]{1,40}$'),
  content    jsonb not null check (jsonb_typeof(content) = 'object' and octet_length(content::text) < 200000),
  updated_at timestamptz not null default now()
);

create or replace function public.personal_pages_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists personal_pages_touch_trg on public.personal_pages;
create trigger personal_pages_touch_trg before update on public.personal_pages for each row execute function public.personal_pages_touch();

alter table public.personal_pages enable row level security;

drop policy if exists personal_pages_read on public.personal_pages;
create policy personal_pages_read on public.personal_pages for select using (true);

drop policy if exists personal_pages_admin on public.personal_pages;
create policy personal_pages_admin on public.personal_pages for all using (public.is_admin()) with check (public.is_admin());
