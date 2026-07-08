-- Fase 15 — notícias/eventos bilíngues (PT/EN). Rode no SQL Editor -> Run.
-- Adiciona colunas separadas por idioma e migra o conteúdo já cadastrado.

alter table public.news add column if not exists title_pt text not null default '';
alter table public.news add column if not exists title_en text not null default '';
alter table public.news add column if not exists body_pt  text not null default '';
alter table public.news add column if not exists body_en  text not null default '';

-- Preenche as novas colunas com o texto que já existia (mesmo valor nos dois
-- idiomas até o admin editar cada um separadamente).
update public.news set title_pt = title, title_en = title where title_pt = '' and title is not null;
update public.news set body_pt = body, body_en = body where body_pt = '' and body is not null;

alter table public.news drop column if exists title;
alter table public.news drop column if exists body;
