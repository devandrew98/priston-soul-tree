-- Diário de Dor: sessões de fisioterapia (liberação miofascial e manipulação).
-- Rode uma vez no SQL Editor do Supabase. Só libera o novo tipo de registro 'physio'; nada mais muda.
alter table public.dor_records drop constraint if exists dor_records_kind_check;
alter table public.dor_records add constraint dor_records_kind_check
  check (kind in ('settings','crisis','intensity','symptom','med','med_admin','therapy','sleep','nopain','alert_rule','physio'));

create or replace function public.dor_validate(k text, d jsonb) returns void language plpgsql immutable as $$
begin
  if k = 'intensity' then
    if jsonb_typeof(d->'value') <> 'number' or (d->>'value')::numeric not between 0 and 10 or (d->>'value')::numeric <> round((d->>'value')::numeric) then
      raise exception 'intensidade deve ser inteira de 0 a 10'; end if;
  elsif k = 'crisis' then
    if (d->>'start') is null then raise exception 'crise sem início'; end if;
    if (d->>'end') is not null and (d->>'end')::timestamptz <= (d->>'start')::timestamptz then
      raise exception 'o término deve ser depois do início'; end if;
  elsif k = 'med_admin' then
    if (d->>'at') is null then raise exception 'administração sem horário'; end if;
    if jsonb_typeof(d->'quantity') <> 'number' or (d->>'quantity')::numeric <= 0 then raise exception 'quantidade inválida'; end if;
  elsif k = 'sleep' then
    if (d->>'date') is null then raise exception 'sono sem data'; end if;
    if d ? 'hours' and jsonb_typeof(d->'hours') = 'number' and (d->>'hours')::numeric not between 0 and 24 then raise exception 'horas de sono inválidas'; end if;
  elsif k = 'nopain' then
    if (d->>'date') is null then raise exception 'dia sem data'; end if;
  elsif k = 'physio' then
    if (d->>'at') is null then raise exception 'sessão sem data'; end if;
  end if;
end $$;
revoke all on function public.dor_validate(text, jsonb) from public, anon, authenticated;
