# PristonZONE — Documentação geral do projeto

> Documento de leitura. Explica, em português claro, tudo o que o projeto tem
> hoje: as seções do site, as tecnologias, o banco de dados (Supabase),
> segurança dos cadastros, e o que já foi construído até aqui.
> Atualizado em 2026-07-08.

---

## 1. O que é o PristonZONE

É um **site de ferramentas e comunidade para o jogo Priston Tale EU**, no ar em
**https://pristonzone.com**. Reúne várias ferramentas numa só plataforma, todas
**bilíngues (Português / Inglês)** e com visual no tema do jogo.

Seções (abas no topo do site):

| Aba | O que faz |
|---|---|
| 🏠 **Home** | Página inicial, com notícias/eventos gerenciados pelo admin. |
| 🕐 **Timer Boss** | Cronômetro dos bosses: mostra em quanto tempo cada boss nasce, com alertas de voz (10/5/2 min antes) e favoritos. |
| 🔥 **Timer Fury** | Cronômetro do evento Fury. |
| 🎯 **SoD** | Ferramenta do SoD. |
| 🏰 **Marketplace** | Mercado de itens do servidor: anunciar, pesquisar, negociar, avaliar vendedores, chat, estatísticas de preço. |
| 🌳 **Árvore de Souls** | Planejador de builds (Soul Tree) + **Gerador de IA** que monta a melhor build possível. |
| 📺 **Streamers** | Lista de streamers, com detecção automática de quem está ao vivo (Twitch/YouTube). |

---

## 2. Tecnologias usadas

- **Front-end (o site em si):** React 18 + TypeScript, empacotado com **Vite**.
  É um site **SPA** (single-page application): tudo roda no navegador do usuário.
- **Hospedagem / publicação:** **Vercel** (ligada ao GitHub — cada envio de
  código publica o site automaticamente).
- **Back-end / banco de dados:** **Supabase** (detalhado abaixo).
- **Testes:** Vitest (27 testes automatizados do motor de IA).
- **Repositório de código:** GitHub (`devandrew98/priston-soul-tree`).

Não existe "servidor próprio" nosso rodando 24h: o site é estático (Vercel) e
todo o dado dinâmico (contas, anúncios, mensagens) vive no Supabase.

---

## 3. Qual banco de dados estamos usando

**O banco de dados é o Supabase, que por baixo é um PostgreSQL** (um dos bancos
de dados relacionais mais robustos e usados do mundo).

O Supabase é uma plataforma que entrega, num pacote só:

- **PostgreSQL** — o banco de dados onde ficam guardadas todas as tabelas
  (perfis, anúncios, vendas, mensagens, avaliações, etc.).
- **Autenticação (Auth)** — o sistema de contas (cadastro, login, senha).
- **Storage** — armazenamento de arquivos (imagens de item e avatares).
- **Realtime** — atualização ao vivo (o chat e as notificações chegam na hora).
- **Edge Functions** — pequenos códigos no servidor do Supabase (ex.: detectar
  streamers ao vivo).

### Principais tabelas (o "coração" dos dados)

- `profiles` — perfil público de cada usuário (nick, classe, level, clã, avatar,
  selos, se é admin/colaborador).
- `listings` — os **anúncios** do marketplace (nome, imagem, preço, categoria,
  descrição, **status: available / reserved / sold**, datas, etc.).
- `sales` — registro das **vendas concluídas** (alimenta o histórico de preços
  e as estatísticas).
- `favorites`, `fav_sellers`, `wishlist` — favoritos e lista de desejos de cada
  usuário.
- `conversations`, `messages` — o chat entre comprador e vendedor.
- `reviews` — avaliações/reputação dos vendedores.
- `reports` — denúncias (fila do painel admin).
- `notifications` — notificações de cada usuário.
- `news`, `streamers`, `rep_tiers`, `market_categories`, `guide_categories` —
  conteúdos gerenciados pelo painel admin.

---

## 4. Segurança dos cadastros (como as contas são protegidas)

Essa é a parte mais importante e o Supabase cuida dela de forma profissional:

### 4.1. Senhas — nós NUNCA vemos nem guardamos a senha

- Quando alguém se cadastra, a senha vai **direto para o sistema de Auth do
  Supabase**, que a guarda **criptografada com hash (bcrypt)** numa área
  interna (`auth.users`) à qual **o nosso código não tem acesso**.
- Ou seja: nem você, nem eu, nem o nosso código consegue ler a senha de ninguém.
  Só existe o "resumo" criptografado, que não dá pra reverter.

### 4.2. Formas de entrar

- **E-mail + senha** (com confirmação de e-mail e recuperação de senha por
  link — o famoso "esqueci minha senha").
- **Login com Google** (OAuth) — o usuário entra com a conta Google, sem criar
  senha nova.

### 4.3. RLS — Row Level Security (a trava de verdade)

Esse é o ponto-chave da segurança. **Toda tabela tem "políticas" (RLS)** que
definem, linha por linha, quem pode ler e quem pode escrever. Exemplos reais do
nosso banco:

- `profiles`: qualquer um pode **ler** um perfil (é público), mas só o próprio
  dono pode **editar** o seu.
- `listings` (anúncios): um anúncio é visível quando não foi removido; mas
  **só o dono (ou um admin) pode editar/apagar** o próprio anúncio.
- `favorites`, `wishlist`, `notifications`, `conversations`: **só o próprio
  usuário** acessa os seus (ninguém vê os favoritos ou as mensagens de outro).
- Tabelas de administração (denúncias, notícias, categorias): **só quem é admin**
  pode mexer (uma função `is_admin()` verifica isso no banco).

**Por que isso é seguro mesmo com a "chave pública" no site?** O site carrega
uma chave chamada *anon key*, que é **feita para ser pública** — ela sozinha não
dá poder nenhum. Quem realmente decide o que cada pessoa pode fazer é o **RLS**,
que roda dentro do banco e não pode ser burlado pelo navegador. Mesmo que alguém
pegue a chave pública, continua só conseguindo fazer aquilo que as políticas
permitem para o usuário logado.

### 4.4. Anti-fraude

O banco tem **gatilhos (triggers)** que limitam abusos automaticamente:
- limite de anúncios ativos por vendedor;
- limite de velocidade de criação de anúncios (anti-spam);
- registro de todas as ações do admin (`admin_logs`).

### 4.5. Imagens

Ficam no **Storage do Supabase**, em pastas (`avatars`, `item-images`). Leitura
é pública (pra todo mundo ver as imagens dos itens), mas **só usuário logado
consegue enviar** arquivo, e cada um na sua pasta.

---

## 5. A Árvore de Souls e o motor de IA

O planejador de builds tem um **motor de otimização matemática** (em
`src/engine/`, TypeScript puro, roda em segundo plano no navegador). Ele:

- entende as regras do jogo (nodes, raridades, compatibilidades, PvP
  ofensivo/defensivo, tetos de **nível 201 / 217 pontos de fusão**);
- **gera e compara milhares de builds por segundo** (usa vários núcleos do
  processador via Web Workers), com controle de tempo e detecção de "platô";
- **preenche todo node aberto** com a soul mais útil (objetivo → sobrevivência
  → qualquer stat), pra não desperdiçar pontos;
- **aprende**: guarda a melhor build já encontrada pra cada objetivo e usa como
  ponto de partida nas próximas buscas;
- **explica** o resultado e dá recomendações (a IA não inventa a build — quem
  decide é a matemática; a IA interpreta o objetivo e explica).

Detalhes técnicos completos ficam no arquivo `PROJECT_STATE.md`.

---

## 6. O Marketplace

Mercado completo de itens do servidor:

- **Anunciar** item (com imagem, preço, categoria, raridade, descrição).
- **Pesquisar e filtrar** (por nome, categoria, raridade, preço, level).
- **Perfil do vendedor** com reputação, avaliações, selos e itens à venda.
- **Chat** em tempo real entre comprador e vendedor.
- **Estatísticas de preço** (mínimo/médio/máximo, histórico, tendência).
- **Favoritos e lista de desejos.**
- **Painel do vendedor** ("Meu Painel") com anúncios ativos, vendidos,
  favoritos e desejos.
- **Painel admin** (moderação de anúncios/usuários, notícias, categorias,
  denúncias, streamers).

### 6.1. "Marcar como Vendido" (comportamento atual, revisado nesta sessão)

Quando o vendedor marca um item como vendido:

- O anúncio **não é apagado** — só muda o status para **Vendido** (guarda todas
  as informações e as datas).
- Some **do Marketplace público, da loja pública do vendedor e das pesquisas /
  filtros** (todas as consultas passam a considerar só anúncios **ativos**).
- Fica **só na área privada do dono**, na aba **"Vendidos"** do Meu Painel.
- O dono consegue **abrir o anúncio completo** (imagens, nome, descrição, preço,
  categoria, todos os dados, **data de criação e data da venda**), em modo
  **somente-leitura** (não dá pra editar nem republicar).
- Se **outra pessoa** tentar abrir um item vendido (por um link antigo), vê
  "**Este anúncio não está mais disponível**" — nunca o conteúdo.
- Ao marcar como vendido, a tela **atualiza na hora**, sem recarregar.
- **Bônus:** clicar na imagem do item no anúncio agora **amplia a imagem real**
  em tela cheia (lightbox), pra ver melhor.

> Observação técnica honesta: os itens vendidos ficam ocultos para os outros
> usuários **na interface**. Se um dia você quiser deixar isso "à prova de
> tudo" também no nível do banco (impedir até um acesso técnico via API), existe
> um ajuste de 1 linha na regra de segurança (RLS) do Supabase — mas isso
> mexeria no Supabase, então deixei de fora conforme você pediu. É só avisar.

---

## 7. Como o site é publicado

- O código fica no **GitHub**.
- A **Vercel** está ligada ao GitHub: todo envio de código na branch principal
  (`main`) **publica o site automaticamente** em pristonzone.com.
- O detalhamento de como testar uma versão **antes** de publicar (ambiente de
  preview) está no arquivo `VERSIONING.md`.

---

## 8. Resumo — o que já temos hoje

✅ Site bilíngue (PT/EN) com 7 seções.
✅ Cronômetros de Boss e Fury, com alertas de voz e favoritos.
✅ Árvore de Souls com planejador manual + **gerador de IA** com busca profunda,
   preenchimento automático, aprendizado e explicações.
✅ Marketplace completo: anúncios, pesquisa, perfil de vendedor, chat em tempo
   real, estatísticas de preço, favoritos, avaliações, painel do vendedor e
   painel de administração/moderação.
✅ Contas reais com **Supabase Auth** (e-mail/senha + Google), recuperação de
   senha e segurança por **RLS** em todas as tabelas.
✅ Banco de dados **PostgreSQL (via Supabase)**.
✅ Publicação automática pela **Vercel**.
✅ 27 testes automatizados no motor de IA.

Documentos irmãos deste:
- `PROJECT_STATE.md` — estado técnico detalhado do motor de IA / Árvore.
- `VERSIONING.md` — como testar antes de publicar (preview/staging).
- `MARKETPLACE_BACKEND.md` — notas do back-end do marketplace.
