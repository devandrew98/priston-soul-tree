-- Fase 13 — moderação de usuários: motivo do banimento. Rode no SQL Editor -> Run.
alter table public.profiles add column if not exists ban_reason text;
