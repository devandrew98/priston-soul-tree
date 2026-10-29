-- Quest Tracker: novo bônus de EXP "Catch-Up EXP", de porcentagem digitada pelo jogador (igual ao Soul Tree).
-- Começa em 0%: cada jogador escolhe a própria porcentagem no painel "Bônus de EXP ativos". Rode uma vez; é seguro rodar de novo.
insert into public.exp_bonuses (id, name, kind, percent, applies_to, sort, builtin) values
  ('catch_up', 'Catch-Up EXP', 'manual', 0, '{}', 5, true)
on conflict (id) do nothing;
