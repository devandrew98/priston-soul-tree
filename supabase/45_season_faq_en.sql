-- Página /season em inglês: acrescenta os campos em inglês e coloca a tradução do FAQ oficial.
-- Quem acessa o site em inglês vê o texto em inglês; se um campo em inglês estiver vazio, aparece o texto em português.
-- A tradução só entra nos tópicos que ainda não têm inglês (casando pela pergunta em português), então não sobrescreve
-- nada que você já tenha escrito. Gerado por scripts/season/content_en.cjs. É seguro rodar de novo.

alter table public.season_page add column if not exists title_en text not null default '';
alter table public.season_page add column if not exists intro_en text not null default '';
alter table public.season_faq  add column if not exists section_en  text not null default '';
alter table public.season_faq  add column if not exists question_en text not null default '';
alter table public.season_faq  add column if not exists answer_en   text not null default '';

update public.season_page
   set title_en = $q$Official FAQ — PristonTale EU Season$q$, intro_en = $q$Everything you need to know about the PristonTale EU season server.$q$
 where id = 1 and title_en = '' and intro_en = '' and title = $q$FAQ Oficial — Temporada PristonTale EU$q$;

update public.season_faq f
   set section_en = v.section_en, question_en = v.question_en, answer_en = v.answer_en
  from (values
  ($q$O que é o servidor de temporada?$q$, $q$1. GENERAL INFORMATION$q$, $q$What is the season server?$q$, $q$The PristonTale EU season server is an independent server that runs alongside the main server, Babel.

Everyone starts a new journey here on equal terms: level 1 characters, with no equipment, gold, souls or other previously accumulated resources.

It is a chance to start over, explore the season's content, compete on equal starting conditions and develop your character from scratch.$q$),
  ($q$Por que existe um servidor de temporada?$q$, $q$1. GENERAL INFORMATION$q$, $q$Why is there a season server?$q$, $q$The season server was created to allow major updates to be implemented and evaluated before they reach the main server, Babel.

During the season, players will be able to try out new systems, content, mechanics and balance changes.

This lets the team follow how the new features work, identify possible problems and make the necessary adjustments before their final integration into Babel.

**Important:** the season server is not just a testing environment. It offers a complete progression experience, with characters and achievements that will be preserved after it ends.$q$),
  ($q$Quanto tempo dura uma temporada?$q$, $q$1. GENERAL INFORMATION$q$, $q$How long does a season last?$q$, $q$The season will last 2 months.

At the end of this period, the season server will be merged with the main server, Babel.$q$),
  ($q$O que acontece com o Babel durante a temporada?$q$, $q$1. GENERAL INFORMATION$q$, $q$What happens to Babel during the season?$q$, $q$Babel will keep running normally throughout the whole period.

Players can keep using their existing characters, equipment and resources without having to take part in the season.

Each player is free to choose which server they want to play on.$q$),
  ($q$Sou obrigado a participar da temporada?$q$, $q$1. GENERAL INFORMATION$q$, $q$Do I have to take part in the season?$q$, $q$No. Participation is entirely optional.

You can keep playing on Babel as usual, without creating a character on the season server.$q$),
  ($q$Preciso criar um personagem novo para jogar na temporada?$q$, $q$2. CHARACTERS AND PROGRESSION$q$, $q$Do I need to create a new character to play in the season?$q$, $q$Yes. All players will start with new characters, at level 1.$q$),
  ($q$O que acontece com meu personagem quando a temporada termina?$q$, $q$2. CHARACTERS AND PROGRESSION$q$, $q$What happens to my character when the season ends?$q$, $q$At the end of the season, your character will be migrated to the main server, Babel.

The migration will preserve your progress, including level, equipment, souls, inventory and items stored in the chest, according to the season's transfer rules.

This means the time you invested in developing your character will not be lost.$q$),
  ($q$Posso jogar no Babel e na temporada ao mesmo tempo?$q$, $q$2. CHARACTERS AND PROGRESSION$q$, $q$Can I play on Babel and in the season at the same time?$q$, $q$Both servers will be available during the season.

You can choose which one you want to play on, keeping independent progressions until the merge.$q$),
  ($q$A temporada terá conteúdos exclusivos?$q$, $q$3. CONTENT AND UPDATES$q$, $q$Will the season have exclusive content?$q$, $q$The season server will be used to present and evaluate new content, systems and updates before they are integrated into Babel.

The specific new features of each season will be officially announced by the team.$q$),
  ($q$Quais as recompensas da temporada?$q$, $q$3. CONTENT AND UPDATES$q$, $q$What are the season rewards?$q$, $q$The season rewards, as well as the goals and requirements needed to earn them, will be announced on the official PristonTale EU channels.$q$),
  ($q$Todas as atualizações da temporada chegarão ao Babel?$q$, $q$3. CONTENT AND UPDATES$q$, $q$Will all the season's updates reach Babel?$q$, $q$The goal is for the updates developed and validated during the season to be incorporated into Babel after it ends.

However, systems that show problems or need improvements may receive adjustments before the final integration.$q$),
  ($q$O que significa a fusão da temporada com o Babel?$q$, $q$4. SERVER MERGE$q$, $q$What does merging the season with Babel mean?$q$, $q$The merge is the process of integrating the characters, and their respective progress, into the main server.

When the season ends, the characters developed in it will become part of Babel, together with the characters that already existed on the server.$q$),
  ($q$O servidor de temporada continuará disponível depois da fusão?$q$, $q$4. SERVER MERGE$q$, $q$Will the season server remain available after the merge?$q$, $q$No. When the season ends, the seasonal server will be shut down and its progress will be integrated into Babel.$q$),
  ($q$O que acontecerá com os personagens que já existem no Babel?$q$, $q$4. SERVER MERGE$q$, $q$What will happen to the characters that already exist on Babel?$q$, $q$The characters that already exist on Babel will keep their progress as normal.

The purpose of the merge is to bring in the season's characters, without resetting the characters that already belong to the main server.$q$),
  ($q$Preciso solicitar manualmente a transferência do meu personagem?$q$, $q$4. SERVER MERGE$q$, $q$Do I have to request the transfer of my character manually?$q$, $q$No, the transfer is done automatically by the team at the end of the season.$q$),
  ($q$Sou um jogador novo. Vale a pena começar pela temporada?$q$, $q$5. FREQUENTLY ASKED QUESTIONS$q$, $q$I'm a new player. Is it worth starting with the season?$q$, $q$Yes! The season is an excellent opportunity to start your journey in PristonTale EU.

Since everyone starts at level 1, new players and veterans begin on equal terms of progression, with no equipment or resources accumulated in previous seasons. It is very easy to find parties and to level up more effectively.$q$),
  ($q$Se eu começar a jogar depois do início da temporada, ainda poderei participar?$q$, $q$5. FREQUENTLY ASKED QUESTIONS$q$, $q$If I start playing after the season has begun, can I still take part?$q$, $q$Yes. The server will remain available throughout the season.

However, players who start later will have less time to reach the season's goals and objectives.$q$),
  ($q$O que acontece se eu parar de jogar antes do final da temporada?$q$, $q$5. FREQUENTLY ASKED QUESTIONS$q$, $q$What happens if I stop playing before the end of the season?$q$, $q$Your character will keep existing on the season server until it closes.

At the end, it will be included in the migration process to Babel, according to the established rules.$q$),
  ($q$Onde serão divulgadas as novidades e informações oficiais?$q$, $q$5. FREQUENTLY ASKED QUESTIONS$q$, $q$Where will news and official information be announced?$q$, $q$Information about updates, events, changes and the server merge will be announced on the official PristonTale EU channels.$q$)
  ) as v(question_pt, section_en, question_en, answer_en)
 where f.question = v.question_pt and f.question_en = '' and f.answer_en = '';

-- Conferência: quantos tópicos já têm inglês (deve ser 19 se você não mexeu nas perguntas em português).
select (select count(*) from public.season_faq where question_en <> '') as topicos_em_ingles,
       (select count(*) from public.season_faq) as topicos;
