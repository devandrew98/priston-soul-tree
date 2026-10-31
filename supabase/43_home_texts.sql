-- Mensagens da Home editáveis no painel de administrador (Site > Mensagens da Home).
-- 1) home_texts: o texto de boas-vindas e o texto do bloco "Apoie o PristonZONE" (Pix), em português e inglês,
--    com a escolha de em qual idioma cada mensagem aparece. Campo vazio = o site usa o texto padrão.
-- 2) news: cada aviso passa a ter "aparece em" (português, inglês ou os dois).
-- Qualquer pessoa lê; só o administrador altera. É seguro rodar de novo.

create table if not exists public.home_texts (
  key        text primary key check (key in ('welcome', 'pix')),
  title_pt   text not null default '',
  title_en   text not null default '',
  body_pt    text not null default '',
  body_en    text not null default '',
  show_pt    boolean not null default true,
  show_en    boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.home_texts enable row level security;
drop policy if exists home_texts_read on public.home_texts;
create policy home_texts_read on public.home_texts for select using (true);
drop policy if exists home_texts_write on public.home_texts;
create policy home_texts_write on public.home_texts for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.news add column if not exists show_pt boolean not null default true;
alter table public.news add column if not exists show_en boolean not null default true;

-- Conferência: a tabela existe (0 linhas = tudo no texto padrão) e os avisos ganharam as duas colunas.
select (select count(*) from public.home_texts) as textos,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'news' and column_name in ('show_pt', 'show_en')) as colunas_em_news;
