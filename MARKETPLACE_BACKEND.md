# Marketplace — Backend real (Supabase)

Este documento descreve como sair do modo **demo (mock)** para o backend **real**.

## Stack escolhida
- **Frontend**: o site atual (Vite + React) na **Vercel** — sem reescrever.
- **Banco + Auth + Storage + Realtime**: **Supabase** (Postgres).
- **Cache**: **Upstash Redis** (já usado no projeto).
- **API privilegiada** (admin, agregações, vendas): funções serverless em `api/`.
- **Segurança**: Row Level Security (RLS) — cada usuário só altera o que é dele.

Enquanto as variáveis do Supabase **não** estiverem definidas, o Marketplace
continua funcionando 100% no modo demo com dados locais. Nada quebra.

---

## O que VOCÊ precisa fazer (uma vez)

1. **Criar o projeto Supabase** — https://supabase.com → New project. Guarde a
   senha do banco. Escolha a região mais próxima (ex.: South America / São Paulo).

2. **Rodar o schema** — no painel: **SQL Editor → New query**, cole todo o
   conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique **Run**.
   Isso cria as tabelas, as políticas de RLS e os buckets de imagem.

3. **Pegar as chaves** — **Settings → API**:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` → `VITE_SUPABASE_ANON_KEY` (pode ir para o navegador)
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ **segredo**, só no servidor)

4. **Local** — crie um arquivo `.env.local` na raiz (não vai pro git) com:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

5. **Vercel** — em **Project Settings → Environment Variables**, adicione as
   mesmas quatro variáveis (Production + Preview) e faça um redeploy.

6. **Definir o admin** — depois de criar sua conta pelo site, rode no SQL editor:
   ```sql
   update public.profiles set is_admin = true, is_contributor = true
   where nick = 'SEU_NICK';
   ```

Quando terminar os passos 1–5, me avise (ou cole a `VITE_SUPABASE_URL`) que eu
ligo o app ao backend, fase por fase.

---

## Roadmap (fases)

Cada fase é entregável e testável de forma isolada; o app segue no ar entre elas.

- [x] **Fase 0 — Fundação** *(feito)*: schema + RLS + buckets, cliente Supabase
  com fallback para mock, variáveis de ambiente e este guia.
- [ ] **Fase 1 — Auth real**: cadastro/login por e‑mail+senha (Supabase Auth),
  criação do `profile` (nick/classe/clã/avatar), upload de avatar no Storage.
- [ ] **Fase 2 — Anúncios reais**: criar/editar/remover anúncios no banco, upload
  da imagem do item para o Storage; a Vitrine passa a ler do Postgres.
- [ ] **Fase 3 — Busca e filtros no servidor**: pesquisa por índice (trigram) +
  filtros/ordenar via query, com cache no Upstash.
- [ ] **Fase 4 — Favoritos, wishlist, reputação**: tudo persistido por usuário.
- [ ] **Fase 5 — Chat em tempo real**: conversas + mensagens via Supabase Realtime.
- [ ] **Fase 6 — Notificações**: eventos reais (novo interessado, venda, etc.).
- [ ] **Fase 7 — Admin + moderação**: ações privilegiadas via `api/` (service role),
  denúncias, logs, colaboradores, notificação global.
- [ ] **Fase 8 — Estatísticas e histórico de preços**: a partir da tabela `sales`.
- [ ] **Fase 9 — Antifraude/limites**: rate‑limit (Upstash), captcha, limites de
  anúncios por conta.

## Notas de arquitetura
- O front consome o Supabase direto (com RLS) para a maioria das leituras/escritas.
  Só o que precisa de privilégio (moderação, gravar vendas, agregações caras) passa
  pelas funções em `api/` usando a `service_role`.
- A camada de dados do front já é isolada (`src/lib/market/*`), então a troca do
  mock pelo Supabase é incremental — componente por componente.
