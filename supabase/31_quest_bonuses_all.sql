-- Regra dos bônus de EXP confirmada: somatória e válida para TODAS as categorias de quests.
--
-- Nos bônus iniciais, "applies_to" vazio significa "todas as categorias". A fórmula aditiva já é o padrão em quest_settings
-- (combine_mode = 'additive'), então só as categorias precisavam mudar. Rode uma vez no SQL Editor do Supabase.

update public.exp_bonuses set applies_to = '{}' where builtin;
update public.quest_settings set combine_mode = 'additive' where id = 1;
