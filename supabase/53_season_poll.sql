-- Enquete do aviso da Home: "Com qual classe você vai jogar a temporada 13?"
-- Um voto por computador: o navegador guarda um código aleatório (o mesmo da estatística anônima) e o banco aceita 1 voto por código.
-- Como o código some se a pessoa limpar os dados do navegador, há também um limite por rede (5 votos por IP e enquete),
-- que barra quem fica votando de novo, sem barrar uma casa/lan house inteira. O IP não é guardado: só um resumo (hash) dele.
-- Tabela FECHADA: tudo passa por funções que validam os campos.
--   poll_vote(enquete, código, classe) -> registra o voto (se já votou, mantém o primeiro) e devolve o resultado
--   poll_results(enquete, código)      -> resultado por classe + qual foi o voto desse código
-- É seguro rodar de novo.

create table if not exists public.poll_votes (
  poll       text not null check (char_length(poll) between 1 and 40),
  voter      text not null check (char_length(voter) between 8 and 64),
  class      text not null check (class in ('fighter','archer','mechanician','assassin','pikeman','knight','shaman','priestess','magician','atalanta')),
  ip_hash    text,
  created_at timestamptz not null default now(),
  primary key (poll, voter)
);
create index if not exists poll_votes_ip_idx on public.poll_votes (poll, ip_hash);

alter table public.poll_votes enable row level security;
revoke all on table public.poll_votes from anon, authenticated;

create or replace function public.poll_results(p_poll text, p_voter text default '')
returns table (class text, votes bigint, mine boolean)
language sql security definer set search_path = public stable as $$
  select c.class,
         (select count(*) from public.poll_votes v where v.poll = p_poll and v.class = c.class),
         exists (select 1 from public.poll_votes v where v.poll = p_poll and v.voter = p_voter and v.class = c.class)
  from (values ('fighter'),('archer'),('mechanician'),('assassin'),('pikeman'),('knight'),('shaman'),('priestess'),('magician'),('atalanta')) as c(class);
$$;

create or replace function public.poll_vote(p_poll text, p_voter text, p_class text)
returns table (class text, votes bigint, mine boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_ip text;
  v_hash text;
begin
  if p_poll is null or char_length(p_poll) not between 1 and 40 then raise exception 'enquete inválida'; end if;
  if p_voter is null or char_length(p_voter) not between 8 and 64 then raise exception 'votante inválido'; end if;
  if p_class is null or p_class not in ('fighter','archer','mechanician','assassin','pikeman','knight','shaman','priestess','magician','atalanta') then
    raise exception 'classe inválida';
  end if;

  if not exists (select 1 from public.poll_votes v where v.poll = p_poll and v.voter = p_voter) then
    begin
      v_ip := btrim(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1));
    exception when others then
      v_ip := '';
    end;
    v_hash := case when coalesce(v_ip, '') = '' then null else md5(p_poll || ':' || v_ip) end;

    if v_hash is not null and (select count(*) from public.poll_votes v where v.poll = p_poll and v.ip_hash = v_hash) >= 5 then
      raise exception 'limite de votos desta rede atingido';
    end if;
    if (select count(*) from public.poll_votes v where v.created_at > now() - interval '1 minute') >= 300 then
      raise exception 'muitos votos ao mesmo tempo, tente de novo em instantes';
    end if;

    insert into public.poll_votes (poll, voter, class, ip_hash) values (p_poll, p_voter, p_class, v_hash)
    on conflict (poll, voter) do nothing;
  end if;

  return query select * from public.poll_results(p_poll, p_voter);
end $$;

grant execute on function public.poll_results(text, text) to anon, authenticated;
grant execute on function public.poll_vote(text, text, text) to anon, authenticated;

-- Conferência: a tabela existe e começa vazia (0 votos).
select count(*) as votos from public.poll_votes;
