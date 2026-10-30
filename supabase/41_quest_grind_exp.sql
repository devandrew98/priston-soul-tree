-- Quest Tracker: EXP de Grind típica de uma quest (opcional).
-- É a EXP que se ganha matando mobs durante a quest, medida em jogo pelo administrador. Vazia = ninguém mediu.
-- O site só mostra esse valor à parte; ele nunca entra nas contas do planejador. Rode uma vez no SQL Editor.
alter table public.quests add column if not exists grind_exp bigint check (grind_exp is null or grind_exp >= 0);
