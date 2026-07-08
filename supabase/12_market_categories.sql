-- Fase 14 — categorias (tipos de item) do marketplace editáveis. SQL Editor -> Run.
create table if not exists public.market_categories (
  key       text primary key,
  icon      text not null default '📦',
  label_pt  text not null,
  label_en  text not null,
  subs      text[] not null default '{}',
  sort      int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.market_categories enable row level security;
drop policy if exists market_categories_read on public.market_categories;
create policy market_categories_read on public.market_categories for select using (true);   -- todos veem
drop policy if exists market_categories_admin on public.market_categories;
create policy market_categories_admin on public.market_categories for all
  using (public.is_admin()) with check (public.is_admin());                                    -- só admin edita

-- Semear as categorias atuais (idempotente).
insert into public.market_categories (key,icon,label_pt,label_en,subs,sort) values
  ('weapons','⚔️','Armas','Weapons', array['Espadas','Machados','Arcos','Garras','Adagas','Martelos','Lanças','Fantasmas','Foices','Varinhas','Cajados'], 0),
  ('armors','🛡️','Armaduras','Armors', array['Armaduras','Roupões','Orbes','Escudos','Botas','Luvas','Braceletes'], 1),
  ('jewels','💍','Jóias','Jewelry', array['Anéis','Amuletos'], 2),
  ('sheltoms','💠','Sheltoms','Sheltoms', array[]::text[], 3),
  ('souls','✨','Souls','Souls', array[]::text[], 4),
  ('pets','🐾','Pets','Pets', array[]::text[], 5),
  ('premium','👑','Premiums','Premiums', array[]::text[], 6)
on conflict (key) do nothing;
