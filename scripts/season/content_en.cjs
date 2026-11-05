// English version of the /season FAQ (same order and shape as content.cjs). Translated from the Portuguese text the site owner sent.
// Run from the project root to write supabase/45_season_faq_en.sql: node scripts/season/content_en.cjs
const { PAGE, SECTIONS } = require('./content.cjs');

const PAGE_EN = {
  title: 'Official FAQ — PristonTale EU Season',
  intro: 'Everything you need to know about the PristonTale EU season server.',
};

const SECTIONS_EN = [
  {
    title: '1. GENERAL INFORMATION',
    items: [
      ['What is the season server?', [
        'The PristonTale EU season server is an independent server that runs alongside the main server, Babel.',
        'Everyone starts a new journey here on equal terms: level 1 characters, with no equipment, gold, souls or other previously accumulated resources.',
        'It is a chance to start over, explore the season\'s content, compete on equal starting conditions and develop your character from scratch.',
      ]],
      ['Why is there a season server?', [
        'The season server was created to allow major updates to be implemented and evaluated before they reach the main server, Babel.',
        'During the season, players will be able to try out new systems, content, mechanics and balance changes.',
        'This lets the team follow how the new features work, identify possible problems and make the necessary adjustments before their final integration into Babel.',
        '**Important:** the season server is not just a testing environment. It offers a complete progression experience, with characters and achievements that will be preserved after it ends.',
      ]],
      ['How long does a season last?', [
        'The season will last 2 months.',
        'At the end of this period, the season server will be merged with the main server, Babel.',
      ]],
      ['What happens to Babel during the season?', [
        'Babel will keep running normally throughout the whole period.',
        'Players can keep using their existing characters, equipment and resources without having to take part in the season.',
        'Each player is free to choose which server they want to play on.',
      ]],
      ['Do I have to take part in the season?', [
        'No. Participation is entirely optional.',
        'You can keep playing on Babel as usual, without creating a character on the season server.',
      ]],
    ],
  },
  {
    title: '2. CHARACTERS AND PROGRESSION',
    items: [
      ['Do I need to create a new character to play in the season?', [
        'Yes. All players will start with new characters, at level 1.',
      ]],
      ['What happens to my character when the season ends?', [
        'At the end of the season, your character will be migrated to the main server, Babel.',
        'The migration will preserve your progress, including level, equipment, souls, inventory and items stored in the chest, according to the season\'s transfer rules.',
        'This means the time you invested in developing your character will not be lost.',
      ]],
      ['Can I play on Babel and in the season at the same time?', [
        'Both servers will be available during the season.',
        'You can choose which one you want to play on, keeping independent progressions until the merge.',
      ]],
    ],
  },
  {
    title: '3. CONTENT AND UPDATES',
    items: [
      ['Will the season have exclusive content?', [
        'The season server will be used to present and evaluate new content, systems and updates before they are integrated into Babel.',
        'The specific new features of each season will be officially announced by the team.',
      ]],
      ['What are the season rewards?', [
        'The season rewards, as well as the goals and requirements needed to earn them, will be announced on the official PristonTale EU channels.',
      ]],
      ['Will all the season\'s updates reach Babel?', [
        'The goal is for the updates developed and validated during the season to be incorporated into Babel after it ends.',
        'However, systems that show problems or need improvements may receive adjustments before the final integration.',
      ]],
    ],
  },
  {
    title: '4. SERVER MERGE',
    items: [
      ['What does merging the season with Babel mean?', [
        'The merge is the process of integrating the characters, and their respective progress, into the main server.',
        'When the season ends, the characters developed in it will become part of Babel, together with the characters that already existed on the server.',
      ]],
      ['Will the season server remain available after the merge?', [
        'No. When the season ends, the seasonal server will be shut down and its progress will be integrated into Babel.',
      ]],
      ['What will happen to the characters that already exist on Babel?', [
        'The characters that already exist on Babel will keep their progress as normal.',
        'The purpose of the merge is to bring in the season\'s characters, without resetting the characters that already belong to the main server.',
      ]],
      ['Do I have to request the transfer of my character manually?', [
        'No, the transfer is done automatically by the team at the end of the season.',
      ]],
    ],
  },
  {
    title: '5. FREQUENTLY ASKED QUESTIONS',
    items: [
      ['I\'m a new player. Is it worth starting with the season?', [
        'Yes! The season is an excellent opportunity to start your journey in PristonTale EU.',
        'Since everyone starts at level 1, new players and veterans begin on equal terms of progression, with no equipment or resources accumulated in previous seasons. It is very easy to find parties and to level up more effectively.',
      ]],
      ['If I start playing after the season has begun, can I still take part?', [
        'Yes. The server will remain available throughout the season.',
        'However, players who start later will have less time to reach the season\'s goals and objectives.',
      ]],
      ['What happens if I stop playing before the end of the season?', [
        'Your character will keep existing on the season server until it closes.',
        'At the end, it will be included in the migration process to Babel, according to the established rules.',
      ]],
      ['Where will news and official information be announced?', [
        'Information about updates, events, changes and the server merge will be announced on the official PristonTale EU channels.',
      ]],
    ],
  },
];

module.exports = { PAGE_EN, SECTIONS_EN };

if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  if (SECTIONS.length !== SECTIONS_EN.length) throw new Error('seções diferentes');
  const lit = (s) => { if (s.includes('$q$')) throw new Error('texto com $q$'); return `$q$${s}$q$`; };
  const rows = [];
  SECTIONS.forEach((sec, i) => {
    const en = SECTIONS_EN[i];
    if (sec.items.length !== en.items.length) throw new Error(`seção ${i + 1}: quantidade de tópicos diferente`);
    sec.items.forEach(([q], j) => {
      const [qEn, parasEn] = en.items[j];
      rows.push(`  (${lit(q)}, ${lit(en.title)}, ${lit(qEn)}, ${lit(parasEn.join('\n\n'))})`);
    });
  });

  const sql = `-- Página /season em inglês: acrescenta os campos em inglês e coloca a tradução do FAQ oficial.
-- Quem acessa o site em inglês vê o texto em inglês; se um campo em inglês estiver vazio, aparece o texto em português.
-- A tradução só entra nos tópicos que ainda não têm inglês (casando pela pergunta em português), então não sobrescreve
-- nada que você já tenha escrito. Gerado por scripts/season/content_en.cjs. É seguro rodar de novo.

alter table public.season_page add column if not exists title_en text not null default '';
alter table public.season_page add column if not exists intro_en text not null default '';
alter table public.season_faq  add column if not exists section_en  text not null default '';
alter table public.season_faq  add column if not exists question_en text not null default '';
alter table public.season_faq  add column if not exists answer_en   text not null default '';

update public.season_page
   set title_en = ${lit(PAGE_EN.title)}, intro_en = ${lit(PAGE_EN.intro)}
 where id = 1 and title_en = '' and intro_en = '' and title = ${lit(PAGE.title)};

update public.season_faq f
   set section_en = v.section_en, question_en = v.question_en, answer_en = v.answer_en
  from (values
${rows.join(',\n')}
  ) as v(question_pt, section_en, question_en, answer_en)
 where f.question = v.question_pt and f.question_en = '' and f.answer_en = '';

-- Conferência: quantos tópicos já têm inglês (deve ser ${rows.length} se você não mexeu nas perguntas em português).
select (select count(*) from public.season_faq where question_en <> '') as topicos_em_ingles,
       (select count(*) from public.season_faq) as topicos;
`;
  fs.writeFileSync(path.join('supabase', '45_season_faq_en.sql'), sql);
  console.log('ok:', rows.length, 'tópicos traduzidos');
}
