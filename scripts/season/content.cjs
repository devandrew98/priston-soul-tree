// The first content of the /season page (the official FAQ the site owner sent). It is only the starting text:
// after it is loaded, everything is edited in the admin panel (Site > Temporada).
// Run from the project root to rewrite supabase/44_season_faq.sql: node scripts/season/content.cjs
// Answers use the site's rich text: a blank line starts a new paragraph, **bold**, __underline__, "- " bullets.

const PAGE = {
  title: 'FAQ Oficial — Temporada PristonTale EU',
  intro: 'Tudo o que você precisa saber sobre o servidor de temporada do PristonTale EU.',
};

const SECTIONS = [
  {
    title: '1. INFORMAÇÕES GERAIS',
    items: [
      ['O que é o servidor de temporada?', [
        'O servidor de temporada do PristonTale EU é um servidor independente que funciona simultaneamente ao servidor principal, Babel.',
        'Nele, todos os jogadores começam uma nova jornada em condições iguais: personagens no nível 1, sem equipamentos, gold, souls ou outros recursos acumulados anteriormente.',
        'É uma oportunidade de recomeçar, explorar os conteúdos da temporada, competir em igualdade de condições iniciais e desenvolver seu personagem desde o início.',
      ]],
      ['Por que existe um servidor de temporada?', [
        'O servidor de temporada foi criado para permitir a implementação e avaliação de grandes atualizações antes de sua chegada ao servidor principal, Babel.',
        'Durante a temporada, os jogadores poderão experimentar novos sistemas, conteúdos, mecânicas e alterações de balanceamento.',
        'Isso permite que a equipe acompanhe o funcionamento das novidades, identifique possíveis problemas e realize os ajustes necessários antes da integração definitiva ao Babel.',
        '**Importante:** o servidor de temporada não é apenas um ambiente de testes. Ele oferece uma experiência completa de progressão, com personagens e conquistas que serão preservados após seu encerramento.',
      ]],
      ['Quanto tempo dura uma temporada?', [
        'A temporada terá duração de 2 meses.',
        'Ao término desse período, ocorrerá a fusão do servidor de temporada com o servidor principal, Babel.',
      ]],
      ['O que acontece com o Babel durante a temporada?', [
        'O Babel continuará funcionando normalmente durante todo o período.',
        'Os jogadores poderão continuar utilizando seus personagens, equipamentos e recursos existentes, sem precisar participar da temporada.',
        'Cada jogador poderá escolher livremente em qual servidor deseja jogar.',
      ]],
      ['Sou obrigado a participar da temporada?', [
        'Não. A participação é totalmente opcional.',
        'Você poderá continuar jogando no Babel normalmente, sem precisar criar um personagem no servidor de temporada.',
      ]],
    ],
  },
  {
    title: '2. PERSONAGENS E PROGRESSÃO',
    items: [
      ['Preciso criar um personagem novo para jogar na temporada?', [
        'Sim. Todos os jogadores começarão com personagens novos, no nível 1.',
      ]],
      ['O que acontece com meu personagem quando a temporada termina?', [
        'Ao final da temporada, seu personagem será migrado para o servidor principal, Babel.',
        'A migração preservará seu progresso, incluindo nível, equipamentos, souls, inventário e itens armazenados no baú, conforme as regras de transferência da temporada.',
        'Isso significa que o tempo investido no desenvolvimento do seu personagem não será perdido.',
      ]],
      ['Posso jogar no Babel e na temporada ao mesmo tempo?', [
        'Os dois servidores estarão disponíveis durante a temporada.',
        'Você poderá escolher em qual deles deseja jogar, mantendo progressões independentes até a fusão.',
      ]],
    ],
  },
  {
    title: '3. CONTEÚDOS E ATUALIZAÇÕES',
    items: [
      ['A temporada terá conteúdos exclusivos?', [
        'O servidor de temporada será utilizado para apresentar e avaliar novos conteúdos, sistemas e atualizações antes de sua integração ao Babel.',
        'As novidades específicas de cada temporada serão divulgadas oficialmente pela equipe.',
      ]],
      ['Quais as recompensas da temporada?', [
        'As premiações da temporada, assim como os objetivos e requisitos necessários para conquistá-las, serão divulgados nos canais oficiais do PristonTale EU.',
      ]],
      ['Todas as atualizações da temporada chegarão ao Babel?', [
        'O objetivo é que as atualizações desenvolvidas e validadas durante a temporada sejam incorporadas ao Babel após seu encerramento.',
        'Entretanto, sistemas que apresentem problemas ou necessitem de melhorias poderão receber ajustes antes da integração definitiva.',
      ]],
    ],
  },
  {
    title: '4. FUSÃO DOS SERVIDORES',
    items: [
      ['O que significa a fusão da temporada com o Babel?', [
        'A fusão é o processo de integração dos personagens e de seus respectivos progressos ao servidor principal.',
        'Quando a temporada terminar, os personagens desenvolvidos nela passarão a fazer parte do Babel, juntamente com os personagens que já existiam no servidor.',
      ]],
      ['O servidor de temporada continuará disponível depois da fusão?', [
        'Não. Ao término da temporada, o servidor sazonal será encerrado e seu progresso será integrado ao Babel.',
      ]],
      ['O que acontecerá com os personagens que já existem no Babel?', [
        'Os personagens existentes no Babel continuarão com seu progresso normalmente.',
        'A fusão tem como objetivo incorporar os personagens da temporada, sem reiniciar os personagens que já pertencem ao servidor principal.',
      ]],
      ['Preciso solicitar manualmente a transferência do meu personagem?', [
        'Não, a transferência é feita de forma automática pela equipe ao final da temporada.',
      ]],
    ],
  },
  {
    title: '5. DÚVIDAS FREQUENTES',
    items: [
      ['Sou um jogador novo. Vale a pena começar pela temporada?', [
        'Sim! A temporada é uma excelente oportunidade para começar sua jornada no PristonTale EU.',
        'Como todos iniciam no nível 1, novos jogadores e veteranos começam em condições iguais de progressão, sem equipamentos ou recursos acumulados de temporadas anteriores. Muito fácil de encontrar partys e upar de forma mais efetiva.',
      ]],
      ['Se eu começar a jogar depois do início da temporada, ainda poderei participar?', [
        'Sim. O servidor permanecerá disponível durante o período da temporada.',
        'Entretanto, os jogadores que começarem mais tarde terão menos tempo para alcançar as metas e objetivos da temporada.',
      ]],
      ['O que acontece se eu parar de jogar antes do final da temporada?', [
        'Seu personagem continuará existindo no servidor de temporada até seu encerramento.',
        'Ao término, ele será incluído no processo de migração para o Babel, conforme as regras estabelecidas.',
      ]],
      ['Onde serão divulgadas as novidades e informações oficiais?', [
        'As informações sobre atualizações, eventos, mudanças e a fusão dos servidores serão divulgadas nos canais oficiais do PristonTale EU.',
      ]],
    ],
  },
];

module.exports = { PAGE, SECTIONS };

if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  // $q$ ... $q$ quoting: the text can hold apostrophes and quotes without escaping.
  const lit = (s) => { if (s.includes('$q$')) throw new Error('texto com $q$'); return `$q$${s}$q$`; };
  const values = [];
  let pos = 0;
  for (const sec of SECTIONS) for (const [q, paras] of sec.items) values.push(`  (${++pos}, ${lit(sec.title)}, ${lit(q)}, ${lit(paras.join('\n\n'))})`);

  const sql = `-- Página privada /season (FAQ da temporada), editável no painel de administrador (Site > Temporada).
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
values (1, ${lit(PAGE.title)}, ${lit(PAGE.intro)})
on conflict (id) do nothing;

insert into public.season_faq (position, section, question, answer)
select * from (values
${values.join(',\n')}
) as v(position, section, question, answer)
where not exists (select 1 from public.season_faq);

-- Conferência: 1 página e ${pos} tópicos.
select (select count(*) from public.season_page) as pagina, (select count(*) from public.season_faq) as topicos;
`;
  fs.writeFileSync(path.join('supabase', '44_season_faq.sql'), sql);
  console.log('ok:', pos, 'tópicos em', SECTIONS.length, 'seções');
}
