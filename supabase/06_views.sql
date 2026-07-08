-- Fase 8.1 — contagem de visualizações. Rode no SQL Editor (New query -> colar -> Run).
-- Incremento atômico (evita corrida) e via SECURITY DEFINER para dispensar policy de UPDATE.

create or replace function public.increment_listing_views(lid uuid)
returns void language sql security definer set search_path = public as $$
  update public.listings set views = views + 1 where id = lid and removed = false;
$$;

grant execute on function public.increment_listing_views(uuid) to anon, authenticated;
