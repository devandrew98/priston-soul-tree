-- Fase 8 — rode este trecho no SQL Editor (New query -> colar -> Run).
-- Registra uma venda automaticamente quando um anúncio é marcado como "vendido".
-- A tabela public.sales alimenta o histórico de preços e as estatísticas.

create or replace function public.record_sale()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'sold' and (old.status is distinct from 'sold') then
    insert into public.sales (listing_id, category, name, price, currency)
    values (new.id, new.category, new.name, new.price, new.currency);
  end if;
  return new;
end;
$$;

drop trigger if exists on_listing_sold on public.listings;
create trigger on_listing_sold after update on public.listings
  for each row execute function public.record_sale();
