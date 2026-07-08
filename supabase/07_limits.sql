-- Fase 9 — limites antifraude / antispam. Rode no SQL Editor (New query -> colar -> Run).
-- Toda a checagem é server-side (triggers) para não poder ser burlada pelo cliente.
-- As mensagens de erro (limit_*) são mapeadas para textos amigáveis no frontend.

-- 1) Anúncios: teto de anúncios ativos por conta + limite de criação por hora.
create or replace function public.enforce_listing_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare active_count int; recent_count int;
begin
  select count(*) into active_count from public.listings
    where seller_id = new.seller_id and removed = false and status in ('available','reserved');
  if active_count >= 30 then
    raise exception 'limit_active_listings';
  end if;
  select count(*) into recent_count from public.listings
    where seller_id = new.seller_id and created_at > now() - interval '1 hour';
  if recent_count >= 15 then
    raise exception 'limit_rate_listings';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_listing_limits on public.listings;
create trigger trg_listing_limits before insert on public.listings
  for each row execute function public.enforce_listing_limits();

-- 2) Mensagens: no máximo 20 por minuto por remetente (anti-flood no chat).
create or replace function public.enforce_message_rate()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  select count(*) into recent from public.messages
    where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if recent >= 20 then
    raise exception 'limit_rate_messages';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_message_rate on public.messages;
create trigger trg_message_rate before insert on public.messages
  for each row execute function public.enforce_message_rate();

-- 3) Denúncias: no máximo 10 por hora por usuário + impede denúncia duplicada em aberto.
create or replace function public.enforce_report_rate()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  select count(*) into recent from public.reports
    where reporter_id = new.reporter_id and created_at > now() - interval '1 hour';
  if recent >= 10 then
    raise exception 'limit_rate_reports';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_report_rate on public.reports;
create trigger trg_report_rate before insert on public.reports
  for each row execute function public.enforce_report_rate();

create unique index if not exists reports_unique_open
  on public.reports (reporter_id, target_type, target_id) where status = 'open';
