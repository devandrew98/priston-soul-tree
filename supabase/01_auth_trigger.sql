-- Fase 1 — rode este trecho no SQL Editor (New query → colar → Run).
-- Cria o perfil do jogador automaticamente quando ele se cadastra.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nick, char_class, clan, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nick', ''), split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data->>'char_class', ''), 'Fighter'),
    coalesce(nullif(new.raw_user_meta_data->>'clan', ''), '—'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
