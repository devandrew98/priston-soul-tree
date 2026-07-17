-- Fase 18 — contato do vendedor pelo WhatsApp. SQL Editor -> Run.
-- Privacidade: o NÚMERO nunca fica na tabela pública `listings` (que é lida com
-- select *). Só um booleano `whatsapp_enabled` fica público (para a UI saber se
-- mostra o botão). O número vive em tabelas protegidas (só o dono lê/escreve) e
-- é entregue ao comprador apenas via a função RPC `whatsapp_contact`, depois de
-- validar tudo e registrar o interesse.

-- Flag público no anúncio.
alter table public.listings add column if not exists whatsapp_enabled boolean not null default false;

-- Número por anúncio (protegido — só o vendedor dono).
create table if not exists public.listing_whatsapp (
  listing_id   uuid primary key references public.listings(id) on delete cascade,
  number       text not null,               -- só dígitos nacionais, ex.: 11999999999
  country_code text not null default '55',
  consent      boolean not null default false,
  consent_date timestamptz,
  updated_at   timestamptz not null default now()
);
alter table public.listing_whatsapp enable row level security;
drop policy if exists lw_owner_all on public.listing_whatsapp;
create policy lw_owner_all on public.listing_whatsapp for all
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));

-- Número padrão do perfil (protegido — só o dono).
create table if not exists public.user_whatsapp (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  number       text not null,
  country_code text not null default '55',
  verified     boolean not null default false,
  consent      boolean not null default false,
  updated_at   timestamptz not null default now()
);
alter table public.user_whatsapp enable row level security;
drop policy if exists uw_owner_all on public.user_whatsapp;
create policy uw_owner_all on public.user_whatsapp for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Registro de interesse. O comprador vê os seus; o vendedor vê os dos seus anúncios.
create table if not exists public.interests (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id   uuid not null references public.profiles(id) on delete cascade,
  seller_id  uuid not null references public.profiles(id) on delete cascade,
  reason     text not null default 'buy',
  message    text not null default '',
  channel    text not null default 'whatsapp',
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id)   -- interesses repetidos não duplicam registros
);
create index if not exists interests_seller_idx on public.interests(seller_id, created_at desc);
create index if not exists interests_buyer_idx on public.interests(buyer_id, created_at desc);
alter table public.interests enable row level security;
drop policy if exists interests_read on public.interests;
create policy interests_read on public.interests for select
  using (buyer_id = auth.uid() or seller_id = auth.uid());
-- Sem policy de INSERT: clientes não inserem direto; só via a RPC (security definer).

-- RPC: valida tudo, registra o interesse e devolve o número completo do vendedor.
create or replace function public.whatsapp_contact(p_listing_id uuid, p_reason text, p_message text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record; w record; uid uuid := auth.uid(); recent int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into l from public.listings where id = p_listing_id;
  if not found or l.removed then raise exception 'unavailable'; end if;
  if l.status = 'sold' then raise exception 'sold'; end if;
  if l.seller_id = uid then raise exception 'own_listing'; end if;
  if not l.whatsapp_enabled then raise exception 'no_whatsapp'; end if;
  if exists (select 1 from public.profiles p where p.id = uid and p.banned) then raise exception 'blocked'; end if;
  select * into w from public.listing_whatsapp where listing_id = p_listing_id;
  if not found or w.number is null or length(w.number) < 8 or not w.consent then raise exception 'no_whatsapp'; end if;
  -- limite anti-spam: no máx 20 contatos por hora por comprador.
  select count(*) into recent from public.interests where buyer_id = uid and created_at > now() - interval '1 hour';
  if recent >= 20 then raise exception 'limit_rate_contacts'; end if;
  insert into public.interests (listing_id, buyer_id, seller_id, reason, message)
  values (p_listing_id, uid, l.seller_id, coalesce(nullif(p_reason,''),'buy'), coalesce(p_message,''))
  on conflict (listing_id, buyer_id) do update set reason = excluded.reason, message = excluded.message, created_at = now();
  return jsonb_build_object('number', w.country_code || w.number);
end;
$$;
grant execute on function public.whatsapp_contact(uuid, text, text) to authenticated;
