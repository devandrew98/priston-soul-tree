-- Fase 11 — categorias de reputação editáveis + cargo manual por membro.
-- Rode no SQL Editor (New query -> colar -> Run).

-- Categorias (tiers). `base` controla o "tipo" visual (bronze/prata/ouro/...).
create table if not exists public.rep_tiers (
  key        text primary key,
  label      text not null,
  base       text not null default 'bronze' check (base in ('bronze','silver','gold','diamond','legendary')),
  icon       text not null default '🥉',
  color      text not null default '#cd7f32',
  min_sold   int  not null default 0,   -- itens vendidos p/ alcançar (modo automático)
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);

alter table public.rep_tiers enable row level security;
drop policy if exists rep_tiers_read on public.rep_tiers;
create policy rep_tiers_read on public.rep_tiers for select using (true);          -- todos veem
drop policy if exists rep_tiers_admin on public.rep_tiers;
create policy rep_tiers_admin on public.rep_tiers for all
  using (public.is_admin()) with check (public.is_admin());                         -- só admin edita

-- Semear as 5 categorias atuais (idempotente).
insert into public.rep_tiers (key,label,base,icon,color,min_sold,sort) values
  ('bronze',    'Hopy',        'bronze',    '🥉', '#cd7f32', 0,   0),
  ('silver',    'Bargon',      'silver',    '🥈', '#c0c0c0', 25,  1),
  ('gold',      'Head Cutter', 'gold',      '🥇', '#e6b93b', 100, 2),
  ('diamond',   'Groqueste',   'diamond',   '💎', '#5ad6d0', 300, 3),
  ('legendary', 'Babel',       'legendary', '👑', '#e0663b', 800, 4)
on conflict (key) do nothing;

-- Cargo manual: quando preenchido, força a categoria do membro (ignora o cálculo
-- automático por itens vendidos). NULL = automático.
alter table public.profiles add column if not exists rep_tier_override text;
