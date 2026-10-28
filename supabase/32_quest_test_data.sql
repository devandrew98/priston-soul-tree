-- DADOS FICTÍCIOS DE TESTE do Quest Tracker. NÃO SÃO VALORES DO JOGO.
--
-- Uma tabela de EXP inventada (levels 1 a 130, formato "EXP necessária para sair do level") e 10 quests marcadas com
-- "[TESTE]" e IDs "TESTE-nnn", para experimentar o Quest Tracker. Nada aqui sobrescreve dados que já existam
-- (on conflict do nothing). Rode DEPOIS do 30 e do 31.
--
-- Para APAGAR tudo isto antes de importar os dados oficiais, rode o bloco "LIMPEZA" no fim do arquivo.

-- Tabela de EXP inventada: o level L precisa de 20.000 x 1,1^(L-1) de EXP (ex.: level 69 ~ 13 milhões).
insert into public.exp_levels (level, value)
select l, round(20000 * power(1.1, l - 1))::bigint
from generate_series(1, 130) as l
on conflict (level) do nothing;

insert into public.quests (id, name, category_id, min_level, max_level, map, npc, description, objectives, base_exp, prerequisites, repeat_type, repeat_interval_hours) values
  ('TESTE-001', '[TESTE] Primeiros passos',          'normal',     60, null, 'Mapa de teste', 'NPC de teste', 'Quest fictícia para testar o Quest Tracker.',
    '[{"kind":"monster","name":"Monstro de teste","qty":20}]', 1000000, '{}', 'once', null),
  ('TESTE-002', '[TESTE] Continuação dos passos',    'normal',     62, null, 'Mapa de teste', 'NPC de teste', 'Exige a quest TESTE-001 concluída.',
    '[{"kind":"monster","name":"Monstro de teste","qty":30}]', 1500000, '{TESTE-001}', 'once', null),
  ('TESTE-003', '[TESTE] Limpeza da caverna',        'normal',     65, null, 'Caverna de teste', 'NPC de teste', 'Quest fictícia com monstros e item.',
    '[{"kind":"monster","name":"Morcego de teste","qty":30},{"kind":"item","name":"Presa de teste","qty":5}]', 2500000, '{}', 'once', null),
  ('TESTE-004', '[TESTE] Caçada ao chefe da caverna','boss',       68, null, 'Caverna de teste', 'NPC de teste', 'Quest de boss fictícia.',
    '[{"kind":"boss","name":"Chefe de teste","qty":1}]', 5000000, '{}', 'once', null),
  ('TESTE-005', '[TESTE] Entrega diária',            'daily',      60, null, 'Mapa de teste', 'NPC de teste', 'Quest diária fictícia (volta a ficar disponível 24 h depois).',
    '[{"kind":"item","name":"Caixa de teste","qty":1}]', 500000, '{}', 'daily', null),
  ('TESTE-006', '[TESTE] Coleta repetível',          'repeatable', 64, null, 'Mapa de teste', 'NPC de teste', 'Quest repetível fictícia, sem espera.',
    '[{"kind":"item","name":"Erva de teste","qty":10}]', 750000, '{}', 'repeatable', null),
  ('TESTE-007', '[TESTE] Missão a cada 3 dias',      'special',    66, null, 'Mapa de teste', 'NPC de teste', 'Quest especial fictícia, com intervalo de 72 horas.',
    '[{"kind":"other","name":"Falar com o NPC de teste","qty":null}]', 3000000, '{}', 'interval', 72),
  ('TESTE-008', '[TESTE] Quest de nível alto',       'normal',     90, null, 'Mapa de teste', 'NPC de teste', 'Só aparece como "bloqueada" para quem tem level menor que 90.',
    '[{"kind":"monster","name":"Monstro forte de teste","qty":50}]', 20000000, '{}', 'once', null),
  ('TESTE-009', '[TESTE] Boss de nível alto',        'boss',       95, null, 'Mapa de teste', 'NPC de teste', 'Exige a quest TESTE-008 concluída.',
    '[{"kind":"boss","name":"Chefe forte de teste","qty":1}]', 40000000, '{TESTE-008}', 'once', null),
  ('TESTE-010', '[TESTE] Quest até o level 70',      'normal',     60, 70,   'Mapa de teste', 'NPC de teste', 'Só pode ser feita até o level 70 (testa o level máximo).',
    '[{"kind":"monster","name":"Monstro de teste","qty":15}]', 800000, '{}', 'once', null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------------------------
-- LIMPEZA (rode isto, sozinho, quando quiser tirar os dados de teste antes de importar os oficiais):
--
--   delete from public.quests where id like 'TESTE-%';
--   delete from public.exp_levels;   -- só se a tabela de EXP atual for a de teste; depois importe a oficial pelo painel
-- ---------------------------------------------------------------------------------------------------------------
