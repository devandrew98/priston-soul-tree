-- Fase 5 — rode este trecho no SQL Editor (New query -> colar -> Run).
-- 1) Permite marcar mensagens como lidas (participantes da conversa).
-- 2) Liga o Realtime na tabela de mensagens (chat ao vivo).

-- read receipts: participants may update messages in their conversations
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);

-- add the messages table to the realtime publication (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
