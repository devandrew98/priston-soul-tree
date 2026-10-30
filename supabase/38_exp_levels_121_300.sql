-- Tabela de EXP do Quest Tracker: levels 121 a 300.
-- Informação do dono do site: do level 121 ao 300 o EXP é o mesmo, 82.451.913.432 por level.
-- A tabela guarda o EXP TOTAL ao chegar no level (modo "acumulada no início"), então cada level soma 82.451.913.432 ao anterior,
-- a partir do level 120 (1.484.134.441.788): level 121 = level 120 + 82.451.913.432, level 122 = level 121 + 82.451.913.432, e assim por diante.
-- Rode DEPOIS do 37 (que cria os levels 1 a 120). É seguro rodar de novo.

do $$
begin
  if not exists (select 1 from public.exp_levels where level = 120) then
    raise exception 'O level 120 não está na tabela de EXP: rode antes o 37_quest_official_data.sql';
  end if;
end $$;

insert into public.exp_levels (level, value)
select l, (select value from public.exp_levels where level = 120) + 82451913432::bigint * (l - 120)
from generate_series(121, 300) as l
on conflict (level) do update set value = excluded.value, active = true;

-- Conferência: deve mostrar 300 linhas a partir do 1 até o 300 (sem buracos) e a diferença constante de 82451913432 entre os levels 121 e 300.
select count(*) as levels, min(level) as primeiro, max(level) as ultimo,
       (select value from public.exp_levels where level = 300) - (select value from public.exp_levels where level = 121) as diferenca_121_a_300,
       82451913432::bigint * 179 as esperado
from public.exp_levels;
