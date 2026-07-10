-- Fase 17 — localização da loja in-game do anúncio. SQL Editor -> Run.
-- Opcional: quando o vendedor marca a loja no mapa (Ricarten/Pillai), guardamos
-- a cidade e a posição relativa (x,y em 0..1) do PIN. A coordenada A1..J10 é
-- derivada da posição no frontend.
alter table public.listings add column if not exists shop_city text
  check (shop_city is null or shop_city in ('ricarten','pillai'));
alter table public.listings add column if not exists shop_x real;
alter table public.listings add column if not exists shop_y real;
