-- Página privada /season (FAQ da temporada), editável no painel de administrador (Site > Temporada).
-- 1) season_page: o título e o texto de abertura da página (uma única linha).
-- 2) season_faq: os tópicos (seção + pergunta + resposta com formatação), na ordem escolhida; "visible" esconde um tópico sem apagá-lo.
-- Qualquer pessoa lê (a página não tem link no site: só entra quem recebe o endereço); só o administrador altera.
-- Tópicos escondidos só o administrador enxerga. O conteúdo inicial é o FAQ oficial que você enviou e só entra se ainda não
-- existir nada. Gerado por scripts/season/content.cjs. É seguro rodar de novo.

create table if not exists public.season_page (
  id         int primary key default 1 check (id = 1),
  title      text not null default 'Temporada',
  intro      text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.season_faq (
  id         uuid primary key default gen_random_uuid(),
  position   int  not null default 0,
  section    text not null default '',
  question   text not null,
  answer     text not null default '',
  visible    boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.season_faq add column if not exists section text not null default '';
create index if not exists season_faq_position_idx on public.season_faq (position);

alter table public.season_page enable row level security;
drop policy if exists season_page_read on public.season_page;
create policy season_page_read on public.season_page for select using (true);
drop policy if exists season_page_write on public.season_page;
create policy season_page_write on public.season_page for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.season_faq enable row level security;
drop policy if exists season_faq_read on public.season_faq;
create policy season_faq_read on public.season_faq for select using (visible or public.is_admin());
drop policy if exists season_faq_write on public.season_faq;
create policy season_faq_write on public.season_faq for all
  using (public.is_admin()) with check (public.is_admin());

-- Conteúdo inicial: só entra se a página e os tópicos ainda estiverem vazios.
insert into public.season_page (id, title, intro)
values (1, $q$FAQ Oficial — Temporada PristonTale EU$q$, $q$Tudo o que você precisa saber sobre o servidor de temporada do PristonTale EU.$q$)
on conflict (id) do nothing;

insert into public.season_faq (position, section, question, answer)
select * from (values
  (1, $q$1. INFORMAÇÕES GERAIS$q$, $q$O que é o servidor de temporada?$q$, $q$O servidor de temporada do PristonTale EU é um servidor independente que funciona simultaneamente ao servidor principal, Babel.

Nele, todos os jogadores começam uma nova jornada em condições iguais: personagens no nível 1, sem equipamentos, gold, souls ou outros recursos acumulados anteriormente.

É uma oportunidade de recomeçar, explorar os conteúdos da temporada, competir em igualdade de condições iniciais e desenvolver seu personagem desde o início.$q$),
  (2, $q$1. INFORMAÇÕES GERAIS$q$, $q$Por que existe um servidor de temporada?$q$, $q$O servidor de temporada foi criado para permitir a implementação e avaliação de grandes atualizações antes de sua chegada ao servidor principal, Babel.

Durante a temporada, os jogadores poderão experimentar novos sistemas, conteúdos, mecânicas e alterações de balanceamento.

Isso permite que a equipe acompanhe o funcionamento das novidades, identifique possíveis problemas e realize os ajustes necessários antes da integração definitiva ao Babel.

**Importante:** o servidor de temporada não é apenas um ambiente de testes. Ele oferece uma experiência completa de progressão, com personagens e conquistas que serão preservados após seu encerramento.$q$),
  (3, $q$1. INFORMAÇÕES GERAIS$q$, $q$Quanto tempo dura uma temporada?$q$, $q$A temporada terá duração de 2 meses.

Ao término desse período, ocorrerá a fusão do servidor de temporada com o servidor principal, Babel.$q$),
  (4, $q$1. INFORMAÇÕES GERAIS$q$, $q$O que acontece com o Babel durante a temporada?$q$, $q$O Babel continuará funcionando normalmente durante todo o período.

Os jogadores poderão continuar utilizando seus personagens, equipamentos e recursos existentes, sem precisar participar da temporada.

Cada jogador poderá escolher livremente em qual servidor deseja jogar.$q$),
  (5, $q$1. INFORMAÇÕES GERAIS$q$, $q$Sou obrigado a participar da temporada?$q$, $q$Não. A participação é totalmente opcional.

Você poderá continuar jogando no Babel normalmente, sem precisar criar um personagem no servidor de temporada.$q$),
  (6, $q$2. PERSONAGENS E PROGRESSÃO$q$, $q$Preciso criar um personagem novo para jogar na temporada?$q$, $q$Sim. Todos os jogadores começarão com personagens novos, no nível 1.$q$),
  (7, $q$2. PERSONAGENS E PROGRESSÃO$q$, $q$O que acontece com meu personagem quando a temporada termina?$q$, $q$Ao final da temporada, seu personagem será migrado para o servidor principal, Babel.

A migração preservará seu progresso, incluindo nível, equipamentos, souls, inventário e itens armazenados no baú, conforme as regras de transferência da temporada.

Isso significa que o tempo investido no desenvolvimento do seu personagem não será perdido.$q$),
  (8, $q$2. PERSONAGENS E PROGRESSÃO$q$, $q$Posso jogar no Babel e na temporada ao mesmo tempo?$q$, $q$Os dois servidores estarão disponíveis durante a temporada.

Você poderá escolher em qual deles deseja jogar, mantendo progressões independentes até a fusão.$q$),
  (9, $q$3. CONTEÚDOS E ATUALIZAÇÕES$q$, $q$A temporada terá conteúdos exclusivos?$q$, $q$O servidor de temporada será utilizado para apresentar e avaliar novos conteúdos, sistemas e atualizações antes de sua integração ao Babel.

As novidades específicas de cada temporada serão divulgadas oficialmente pela equipe.$q$),
  (10, $q$3. CONTEÚDOS E ATUALIZAÇÕES$q$, $q$Quais as recompensas da temporada?$q$, $q$As premiações da temporada, assim como os objetivos e requisitos necessários para conquistá-las, serão divulgados nos canais oficiais do PristonTale EU.$q$),
  (11, $q$3. CONTEÚDOS E ATUALIZAÇÕES$q$, $q$Todas as atualizações da temporada chegarão ao Babel?$q$, $q$O objetivo é que as atualizações desenvolvidas e validadas durante a temporada sejam incorporadas ao Babel após seu encerramento.

Entretanto, sistemas que apresentem problemas ou necessitem de melhorias poderão receber ajustes antes da integração definitiva.$q$),
  (12, $q$4. FUSÃO DOS SERVIDORES$q$, $q$O que significa a fusão da temporada com o Babel?$q$, $q$A fusão é o processo de integração dos personagens e de seus respectivos progressos ao servidor principal.

Quando a temporada terminar, os personagens desenvolvidos nela passarão a fazer parte do Babel, juntamente com os personagens que já existiam no servidor.$q$),
  (13, $q$4. FUSÃO DOS SERVIDORES$q$, $q$O servidor de temporada continuará disponível depois da fusão?$q$, $q$Não. Ao término da temporada, o servidor sazonal será encerrado e seu progresso será integrado ao Babel.$q$),
  (14, $q$4. FUSÃO DOS SERVIDORES$q$, $q$O que acontecerá com os personagens que já existem no Babel?$q$, $q$Os personagens existentes no Babel continuarão com seu progresso normalmente.

A fusão tem como objetivo incorporar os personagens da temporada, sem reiniciar os personagens que já pertencem ao servidor principal.$q$),
  (15, $q$4. FUSÃO DOS SERVIDORES$q$, $q$Preciso solicitar manualmente a transferência do meu personagem?$q$, $q$Não, a transferência é feita de forma automática pela equipe ao final da temporada.$q$),
  (16, $q$5. DÚVIDAS FREQUENTES$q$, $q$Sou um jogador novo. Vale a pena começar pela temporada?$q$, $q$Sim! A temporada é uma excelente oportunidade para começar sua jornada no PristonTale EU.

Como todos iniciam no nível 1, novos jogadores e veteranos começam em condições iguais de progressão, sem equipamentos ou recursos acumulados de temporadas anteriores. Muito fácil de encontrar partys e upar de forma mais efetiva.$q$),
  (17, $q$5. DÚVIDAS FREQUENTES$q$, $q$Se eu começar a jogar depois do início da temporada, ainda poderei participar?$q$, $q$Sim. O servidor permanecerá disponível durante o período da temporada.

Entretanto, os jogadores que começarem mais tarde terão menos tempo para alcançar as metas e objetivos da temporada.$q$),
  (18, $q$5. DÚVIDAS FREQUENTES$q$, $q$O que acontece se eu parar de jogar antes do final da temporada?$q$, $q$Seu personagem continuará existindo no servidor de temporada até seu encerramento.

Ao término, ele será incluído no processo de migração para o Babel, conforme as regras estabelecidas.$q$),
  (19, $q$5. DÚVIDAS FREQUENTES$q$, $q$Onde serão divulgadas as novidades e informações oficiais?$q$, $q$As informações sobre atualizações, eventos, mudanças e a fusão dos servidores serão divulgadas nos canais oficiais do PristonTale EU.$q$)
) as v(position, section, question, answer)
where not exists (select 1 from public.season_faq);

-- Conferência: 1 página e 19 tópicos.
select (select count(*) from public.season_page) as pagina, (select count(*) from public.season_faq) as topicos;
