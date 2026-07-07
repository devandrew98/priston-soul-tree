-- Fase 6 — rode este trecho no SQL Editor (New query -> colar -> Run).
-- Cria notificações automaticamente (via triggers, com segurança) e liga o
-- Realtime na tabela de notificações.

-- New chat message -> notify the OTHER participant.
create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recipient uuid;
  sender_nick text;
begin
  select case when c.buyer_id = new.sender_id then c.seller_id else c.buyer_id end
    into recipient
    from public.conversations c
    where c.id = new.conversation_id;
  if recipient is null or recipient = new.sender_id then return new; end if;
  select nick into sender_nick from public.profiles where id = new.sender_id;
  insert into public.notifications (user_id, type, params, link)
  values (
    recipient, 'message',
    jsonb_build_object('nick', coalesce(sender_nick, '?')),
    jsonb_build_object('kind', 'messages')
  );
  return new;
end;
$$;
drop trigger if exists on_message_insert on public.messages;
create trigger on_message_insert after insert on public.messages
  for each row execute function public.notify_new_message();

-- New review -> notify the reviewed seller.
create or replace function public.notify_new_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, params, link)
  values (
    new.seller_id, 'review',
    jsonb_build_object('stars', new.stars),
    jsonb_build_object('kind', 'seller', 'id', new.seller_id::text)
  );
  return new;
end;
$$;
drop trigger if exists on_review_insert on public.reviews;
create trigger on_review_insert after insert on public.reviews
  for each row execute function public.notify_new_review();

-- Stream notifications to their owner in real time (RLS-filtered).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
