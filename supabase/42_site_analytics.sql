-- Estatísticas do site (painel de administrador > Estatísticas).
-- Cada abertura de página (kind 'view') e cada clique medido (kind 'event') vira uma linha ANÔNIMA:
-- sem IP, sem nome, sem e-mail. O visitante é só um código aleatório guardado no navegador.
-- Quem grava: a função track_hit (qualquer pessoa, só consegue ACRESCENTAR uma linha validada).
-- Quem lê: a função analytics_report (só o administrador). A tabela em si fica fechada.
-- É seguro rodar de novo.

create table if not exists public.site_hits (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  kind    text not null check (kind in ('view', 'event')),
  path    text,
  name    text,
  country text,
  device  text,
  lang    text,
  ref     text,
  visitor text
);
create index if not exists site_hits_at_idx on public.site_hits (at desc);
create index if not exists site_hits_kind_at_idx on public.site_hits (kind, at desc);

alter table public.site_hits enable row level security;
revoke all on table public.site_hits from anon, authenticated;

create or replace function public.track_hit(
  p_kind text, p_path text default null, p_name text default null, p_country text default null,
  p_device text default null, p_lang text default null, p_ref text default null, p_visitor text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('view', 'event') then return; end if;
  insert into public.site_hits (kind, path, name, country, device, lang, ref, visitor)
  values (
    p_kind,
    left(p_path, 120),
    left(p_name, 80),
    case when p_country ~ '^[A-Za-z]{2}$' then upper(p_country) end,
    case when p_device in ('mobile', 'desktop') then p_device end,
    case when p_lang in ('pt', 'en') then p_lang end,
    left(p_ref, 80),
    left(p_visitor, 40)
  );
end $$;
grant execute on function public.track_hit(text, text, text, text, text, text, text, text) to anon, authenticated;

-- Relatório completo para o painel (só administrador). Dias contados no horário de Brasília.
create or replace function public.analytics_report(p_days int default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 400)));
  tz constant text := 'America/Sao_Paulo';
  result jsonb;
begin
  if not public.is_admin() then raise exception 'apenas o administrador'; end if;

  select jsonb_build_object(
    'days', greatest(1, least(coalesce(p_days, 30), 400)),
    'first_hit', (select min(at) from public.site_hits),
    'totals', (select jsonb_build_object('views', count(*), 'visitors', count(distinct visitor))
               from public.site_hits where kind = 'view' and at >= since),
    'today', (select jsonb_build_object('views', count(*), 'visitors', count(distinct visitor))
              from public.site_hits where kind = 'view' and (at at time zone tz)::date = (now() at time zone tz)::date),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('d', d, 'views', v, 'visitors', u) order by d)
              from (select (at at time zone tz)::date as d, count(*) as v, count(distinct visitor) as u
                    from public.site_hits where kind = 'view' and at >= since group by 1) x), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'views', v, 'visitors', u) order by v desc)
              from (select coalesce(path, '/') as k, count(*) as v, count(distinct visitor) as u
                    from public.site_hits where kind = 'view' and at >= since group by 1 order by 2 desc limit 30) x), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'views', v, 'visitors', u) order by v desc)
              from (select coalesce(country, '??') as k, count(*) as v, count(distinct visitor) as u
                    from public.site_hits where kind = 'view' and at >= since group by 1 order by 2 desc limit 30) x), '[]'::jsonb),
    'refs', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'views', v, 'visitors', u) order by v desc)
              from (select coalesce(nullif(ref, ''), '') as k, count(*) as v, count(distinct visitor) as u
                    from public.site_hits where kind = 'view' and at >= since group by 1 order by 2 desc limit 20) x), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'views', v, 'visitors', u) order by v desc)
              from (select coalesce(device, '?') as k, count(*) as v, count(distinct visitor) as u
                    from public.site_hits where kind = 'view' and at >= since group by 1) x), '[]'::jsonb),
    'langs', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'views', v, 'visitors', u) order by v desc)
              from (select coalesce(lang, '?') as k, count(*) as v, count(distinct visitor) as u
                    from public.site_hits where kind = 'view' and at >= since group by 1) x), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'views', v, 'visitors', u) order by v desc)
              from (select coalesce(name, '?') as k, count(*) as v, count(distinct visitor) as u
                    from public.site_hits where kind = 'event' and at >= since group by 1 order by 2 desc limit 30) x), '[]'::jsonb),
    -- hora UTC; o painel converte para o fuso de quem está olhando
    'hours', coalesce((select jsonb_agg(jsonb_build_object('h', h, 'views', v) order by h)
              from (select extract(hour from at at time zone 'UTC')::int as h, count(*) as v
                    from public.site_hits where kind = 'view' and at >= since group by 1) x), '[]'::jsonb)
  ) into result;

  return result;
end $$;
revoke all on function public.analytics_report(int) from public, anon;
grant execute on function public.analytics_report(int) to authenticated;

-- Conferência: deve listar as duas funções e a tabela (0 linhas até o site começar a medir).
select (select count(*) from public.site_hits) as linhas,
       (select count(*) from pg_proc where proname in ('track_hit', 'analytics_report')) as funcoes;
