// Tutorial text: one entry per area of the site. Everything here describes what the site itself does
// (read from each tool); no game rules are stated. `video` is left empty on purpose: when a YouTube
// id is filled in, the tutorial shows it inside that area.
import type { Route } from '../../lib/routes';

export interface Bilingual { pt: string; en: string }

export interface Area {
  id: string;
  icon: string;
  title: Bilingual;
  /** One line shown on the card. */
  summary: Bilingual;
  /** What it is for. */
  about: Bilingual;
  steps: Bilingual[];
  tips: Bilingual[];
  /** Where the tool lives on the site. */
  open: Partial<Route> & Pick<Route, 'section'>;
  /** Needs a signed-in account (or special access) to use fully. */
  note?: Bilingual;
  /** YouTube video id, when there is one. */
  video?: string;
}

export const AREAS: Area[] = [
  {
    id: 'quests', icon: '📜',
    title: { pt: 'Quest Tracker', en: 'Quest Tracker' },
    summary: { pt: 'Veja as quests do seu level e planeje o caminho até o level que quer.', en: 'See the quests for your level and plan the way to the level you want.' },
    about: {
      pt: 'Mostra as quests disponíveis, quanto de EXP cada uma dá e monta um plano para chegar ao level que você escolher.',
      en: 'Shows the available quests, how much EXP each one gives, and builds a plan to reach the level you choose.',
    },
    steps: [
      { pt: 'Em “Meus Personagens”, crie um personagem e informe o seu level e a sua EXP.', en: 'In “My Characters”, create a character and enter your level and EXP.' },
      { pt: 'Em “Quests Disponíveis”, veja a lista do seu level. Use a pesquisa por nome ou ID, e “Filtrar” para categoria, mapa e level.', en: 'In “Available Quests”, see the list for your level. Use the search by name or ID, and “Filter” for category, map and level.' },
      { pt: 'Clique em “✓ Já fiz” nas quests que você já fez: elas saem da lista. Dá para desfazer nos detalhes da quest.', en: 'Click “✓ Done” on quests you have already done: they leave the list. You can undo it in the quest details.' },
      { pt: 'Em “Planejar”, escolha a meta (level e %) e as quests que quer fazer. O site mostra a ordem, o EXP de cada uma e quanto falta.', en: 'In “Plan”, choose the goal (level and %) and the quests you want to do. The site shows the order, each quest’s EXP and how much is missing.' },
      { pt: 'No fim do plano, o botão “Levar para o celular” gera um link com a lista para marcar as quests enquanto joga.', en: 'At the end of the plan, the “Take it to your phone” button creates a link with the list so you can tick quests while playing.' },
    ],
    tips: [
      { pt: 'O EXP que falta além das quests aparece como “EXP de Grind”.', en: 'The EXP that is missing beyond the quests shows as “Grind EXP”.' },
      { pt: 'Marcar “Já fiz” só esconde a quest da lista para você se orientar. Não muda nada no jogo.', en: 'Marking “Done” only hides the quest from the list to help you keep track. It changes nothing in the game.' },
      { pt: 'As marcações do checklist no celular ficam salvas só naquele navegador.', en: 'The ticks on the phone checklist are saved only in that browser.' },
    ],
    open: { section: 'tools', toolTab: 'quests' },
  },
  {
    id: 'souls', icon: '🌳',
    title: { pt: 'Árvore de Souls', en: 'Soul Tree' },
    summary: { pt: 'Planeje a sua build da Fusion Tier e gere sugestões.', en: 'Plan your Fusion Tier build and generate suggestions.' },
    about: {
      pt: 'Planejador da Árvore Fusion Tier, com três partes: a árvore, o inventário de souls e um gerador de builds.',
      en: 'Fusion Tier tree planner, with three parts: the tree, the soul inventory and a build generator.',
    },
    steps: [
      { pt: 'Em “🎒 Inventário”, marque as souls que você tem e o nível de cada uma.', en: 'In “🎒 Inventory”, mark the souls you have and the level of each.' },
      { pt: 'Em “🌳 Árvore”, informe o seu nível de fusão no painel de totais: os pontos de fusão são calculados sozinhos.', en: 'In “🌳 Tree”, enter your fusion level in the totals panel: the fusion points are computed for you.' },
      { pt: 'Clique num node para escolher a soul, o nível da soul e o nível do node. O custo em pontos aparece na hora.', en: 'Click a node to choose the soul, the soul level and the node level. The point cost shows right away.' },
      { pt: 'Em “🤖 Gerador (IA)”, use os atalhos (Ataque, Tank, Farm…) ou a busca profunda para o site sugerir uma build com as souls do seu inventário.', en: 'In “🤖 Generator (AI)”, use the shortcuts (Attack, Tank, Farm…) or the deep search to have the site suggest a build with the souls in your inventory.' },
      { pt: 'Use 💾 Salvar, ⧉ Duplicar e 🔗 Compartilhar para guardar versões e mandar sua build por código ou link.', en: 'Use 💾 Save, ⧉ Duplicate and 🔗 Share to keep versions and send your build by code or link.' },
    ],
    tips: [
      { pt: 'O aviso “gastou pontos além do limite” aparece quando a build passa dos seus pontos.', en: 'The “spent points over your limit” warning shows when the build goes over your points.' },
      { pt: 'O botão “❓ Tutorial” dentro da ferramenta abre um passeio guiado pela tela.', en: 'The “❓ Tutorial” button inside the tool opens a guided tour of the screen.' },
    ],
    open: { section: 'tools', toolTab: 'soultree' },
  },
  {
    id: 'skills', icon: '🌟',
    title: { pt: 'Construtor de Skills', en: 'Class Skill Builder' },
    summary: { pt: 'Distribua Skill Points e Elite Points e monte a barra de skills.', en: 'Spend Skill Points and Elite Points and set up the skill bar.' },
    about: {
      pt: 'Monta a build de skills da sua classe, mostra os pontos usados e os que sobram e gera um link para compartilhar.',
      en: 'Builds your class skill loadout, shows the points used and left, and creates a link to share.',
    },
    steps: [
      { pt: 'Escolha a classe e o level, e dê um nome à build.', en: 'Choose the class and the level, and name the build.' },
      { pt: 'No livro de skills, clique numa skill para colocar +1 ponto, clique direito para tirar 1, e Shift + clique para colocar o máximo que o level permite.', en: 'In the skill book, click a skill for +1 point, right-click to remove 1, and Shift + click to put in as many as your level allows.' },
      { pt: 'Marque as quests que dão pontos extras para o total ficar certo.', en: 'Tick the quests that give extra points so the total is right.' },
      { pt: 'Arraste as skills com pontos até a barra de skills. Dá para baixar ou copiar a imagem da barra.', en: 'Drag skills with points onto the skill bar. You can download or copy the bar image.' },
      { pt: 'Veja o “Plano de pontos por nível” para saber em que ordem gastar. Use “Compartilhar Build” para gerar o link.', en: 'See the “Point plan by level” to know in what order to spend. Use “Share Build” to create the link.' },
    ],
    tips: [
      { pt: 'Para pôr pontos numa skill, as anteriores precisam de pelo menos 1 ponto; esses pontos são colocados sozinhos.', en: 'To put points in a skill, the earlier ones need at least 1 point; those points are added for you.' },
      { pt: 'Em “Comparar com outra build”, cole o link de uma build compartilhada para ver as diferenças skill por skill.', en: 'In “Compare with another build”, paste the link of a shared build to see the differences skill by skill.' },
    ],
    open: { section: 'tools', toolTab: 'skilltree' },
  },
  {
    id: 'builds', icon: '🏆',
    title: { pt: 'Builds da Comunidade', en: 'Community Builds' },
    summary: { pt: 'Guarde suas builds na conta e veja as de outros jogadores.', en: 'Keep your builds in your account and see other players’ builds.' },
    about: {
      pt: 'Galeria de builds de skills e de souls. Você salva as suas na conta, escolhe se ficam públicas e vê o que os outros montaram.',
      en: 'Gallery of skill and soul builds. You save yours in your account, choose whether they are public, and see what others put together.',
    },
    steps: [
      { pt: 'Monte a build no Construtor de Skills ou na Árvore de Souls.', en: 'Put the build together in the Skill Builder or the Soul Tree.' },
      { pt: 'Use “Salvar na minha conta”, dê um nome e escolha se quer compartilhar com a comunidade.', en: 'Use “Save to my account”, give it a name and choose whether to share it with the community.' },
      { pt: 'Em Builds da Comunidade, escolha o tipo (souls ou skills) para ver a galeria e as suas builds salvas.', en: 'In Community Builds, choose the type (souls or skills) to see the gallery and your saved builds.' },
    ],
    tips: [{ pt: 'Builds privadas só você vê.', en: 'Private builds are visible only to you.' }],
    note: { pt: 'Para salvar, é preciso entrar na conta.', en: 'You need to sign in to save.' },
    open: { section: 'tools', toolTab: 'builds' },
  },
  {
    id: 'wardrobe', icon: '🧥',
    title: { pt: 'Armário de Personagem', en: 'Character Wardrobe' },
    summary: { pt: 'Monte seu personagem com equipamentos e gere um link público.', en: 'Set up your character with gear and create a public link.' },
    about: {
      pt: 'Ficha do personagem com nick, classe, level, EXP, equipamentos e souls. Serve para mostrar e facilitar a venda de um personagem.',
      en: 'Character sheet with nick, class, level, EXP, gear and souls. Meant to show and make it easier to sell a character.',
    },
    steps: [
      { pt: 'Entre na conta e clique para criar um personagem.', en: 'Sign in and click to create a character.' },
      { pt: 'Preencha as informações (nick, classe, nível, EXP) e as observações do vendedor.', en: 'Fill in the info (nick, class, level, EXP) and the seller’s notes.' },
      { pt: 'Em Equipamentos, clique em cada espaço para escolher o item e depois a raridade. Preencha os detalhes dos itens, como mixing e affixes.', en: 'In Equipment, click each slot to pick the item and then its rarity. Fill in item details such as mixing and affixes.' },
      { pt: 'Em Venda, informe preço em Coins ou Gold e contatos (opcionais).', en: 'In Sale, enter the price in Coins or Gold and contacts (optional).' },
      { pt: 'Use “Gerar link do personagem” e envie o link público para quem quiser mostrar.', en: 'Use “Generate character link” and send the public link to whoever you want to show.' },
    ],
    tips: [{ pt: 'Se você excluir o personagem, o link público deixa de funcionar.', en: 'If you delete the character, the public link stops working.' }],
    note: { pt: 'É preciso entrar na conta.', en: 'You need to sign in.' },
    open: { section: 'tools', toolTab: 'wardrobe' },
  },
  {
    id: 'mixing', icon: '⚗',
    title: { pt: 'Mixing', en: 'Mixing' },
    summary: { pt: 'Consulte as fórmulas de mixing e os sheltoms necessários.', en: 'Look up the mixing formulas and the sheltoms required.' },
    about: {
      pt: 'Lista de todas as fórmulas de mixing por categoria, com o efeito e os sheltoms que cada uma pede.',
      en: 'List of every mixing formula by category, with the effect and the sheltoms each one needs.',
    },
    steps: [
      { pt: 'Procure por efeito na busca (por exemplo: Critical, HP, Absorb).', en: 'Search by effect (for example: Critical, HP, Absorb).' },
      { pt: 'Ou marque os sheltoms que você tem: o site mostra só as fórmulas que usam apenas eles.', en: 'Or mark the sheltoms you have: the site shows only the formulas that use just those.' },
      { pt: 'Cada fórmula mostra o efeito, os sheltoms necessários e o total.', en: 'Each formula shows the effect, the required sheltoms and the total.' },
    ],
    tips: [{ pt: 'Use “Limpar” para tirar o filtro de sheltoms.', en: 'Use “Clear” to remove the sheltom filter.' }],
    open: { section: 'tools', toolTab: 'mixing' },
  },
  {
    id: 'aging', icon: '⚒',
    title: { pt: 'Aging', en: 'Aging' },
    summary: { pt: 'Calcule o custo do aging e compare itens.', en: 'Work out the aging cost and compare items.' },
    about: {
      pt: 'Duas abas: a calculadora de aging e a comparação de itens.',
      en: 'Two tabs: the aging calculator and the item comparison.',
    },
    steps: [
      { pt: 'Na “Calculadora de Aging”, escolha o item e o aging que deseja.', en: 'In the “Aging calculator”, pick the item and the aging you want.' },
      { pt: 'O site mostra quantos sheltoms e quanto gold você vai gastar no jogo.', en: 'The site shows how many sheltoms and how much gold you will spend in game.' },
      { pt: 'Na aba “Comparar itens”, escolha dois itens e veja lado a lado os atributos perfeitos de cada um, na raridade que quiser.', en: 'In the “Compare items” tab, pick two items and see their perfect stats side by side, in the rarity you want.' },
    ],
    tips: [],
    open: { section: 'tools', toolTab: 'aging' },
  },
  {
    id: 'sod', icon: '🎯',
    title: { pt: 'Survive or Die', en: 'Survive or Die' },
    summary: { pt: 'Registre seus pontos por round e acompanhe o seu ritmo.', en: 'Log your points per round and follow your pace.' },
    about: {
      pt: 'São 8 rounds de mobs. Você marca quantos pontos fez em cada round e o site calcula o seu ritmo.',
      en: 'It is 8 rounds of mobs. You log how many points you scored each round and the site works out your pace.',
    },
    steps: [
      { pt: 'Digite os pontos de cada round.', en: 'Type the points of each round.' },
      { pt: 'O site mostra pontos por minuto, total de pontos, tempo total, melhor e pior round.', en: 'The site shows points per minute, total points, total time, best and worst round.' },
      { pt: 'Use “Salvar como recorde” para guardar o seu melhor run e comparar com os próximos.', en: 'Use “Save as record” to keep your best run and compare against the next ones.' },
    ],
    tips: [{ pt: 'Use “Limpar” para começar um novo run.', en: 'Use “Clear” to start a new run.' }],
    open: { section: 'tools', toolTab: 'sod' },
  },
  {
    id: 'timers', icon: '⏱',
    title: { pt: 'Timers (Boss e Fury)', en: 'Timers (Boss and Fury)' },
    summary: { pt: 'Contagem regressiva dos bosses e dos Furys, com alerta de voz.', en: 'Countdown for bosses and Furys, with voice alerts.' },
    about: {
      pt: 'Mostra quanto falta para cada boss nascer e para cada Fury aparecer. Os horários seguem o tempo oficial do jogo (GMT 0).',
      en: 'Shows how long until each boss spawns and each Fury appears. Times follow the game’s official time (GMT 0).',
    },
    steps: [
      { pt: 'No Timer Boss, veja o próximo boss e o cronograma do dia. Escolha o seu fuso horário para ver nos seus horários.', en: 'In Timer Boss, see the next boss and the daily schedule. Choose your timezone to see your local times.' },
      { pt: 'Clique na ⭐ dos bosses em “Todos os bosses” e use “Só favoritos” para ver só os que importam para você.', en: 'Click the ⭐ on bosses under “All bosses” and use “Favorites only” to see just the ones that matter to you.' },
      { pt: 'Ative os “Alertas de voz” e escolha com quantos minutos de antecedência quer ser avisado.', en: 'Turn on “Voice alerts” and choose how many minutes ahead you want to be warned.' },
      { pt: 'No Timer Fury, veja os horários por faixa de nível, também com alertas de voz.', en: 'In Timer Fury, see the times by level range, also with voice alerts.' },
    ],
    tips: [{ pt: 'Os horários dos bosses são os mesmos para todos; só a hora mostrada muda com o fuso.', en: 'Boss times are the same for everyone; only the displayed hour changes with the timezone.' }],
    open: { section: 'timers', timerTab: 'boss' },
  },
  {
    id: 'market', icon: '🏰',
    title: { pt: 'Marketplace', en: 'Marketplace' },
    summary: { pt: 'Compre e venda itens do servidor.', en: 'Buy and sell server items.' },
    about: {
      pt: 'Mercado da comunidade, com pesquisa e filtros. Você pode anunciar um item à venda ou publicar um pedido de compra.',
      en: 'Community market with search and filters. You can list an item for sale or post a want-to-buy request.',
    },
    steps: [
      { pt: 'Use a pesquisa e os “Filtros” para achar o item. Clique no anúncio para ver os detalhes e o vendedor.', en: 'Use the search and the “Filters” to find the item. Click a listing to see the details and the seller.' },
      { pt: 'Para anunciar, entre na conta e use “Criar anúncio”: nome do item, atributos, preço, descrição e a imagem do item (obrigatória).', en: 'To list something, sign in and use “Create listing”: item name, stats, price, description and the item image (required).' },
      { pt: 'Procurando algo? Use “Criar pedido de compra” e diga o valor que topa pagar.', en: 'Looking for something? Use “Create want-to-buy post” and say the price you are willing to pay.' },
      { pt: 'Use “Favoritar” para guardar itens e vendedores.', en: 'Use “Favorite” to keep items and sellers.' },
    ],
    tips: [
      { pt: 'Se um usuário tiver várias denúncias, o site avisa para negociar com cautela. Dá para denunciar pelo botão “Denunciar”.', en: 'If a user has several reports, the site warns you to trade with caution. You can report with the “Report” button.' },
    ],
    note: { pt: 'Para anunciar é preciso entrar na conta.', en: 'You need to sign in to list items.' },
    open: { section: 'market' },
  },
  {
    id: 'share', icon: '🖥',
    title: { pt: 'Compartilhamento de Tela', en: 'Screen Sharing' },
    summary: { pt: 'Mostre a tela do seu jogo para amigos, pelo navegador.', en: 'Show your game screen to friends, from the browser.' },
    about: {
      pt: 'Você compartilha a tela do seu jogo direto pelo navegador, de graça e sem instalar nada. Quem assiste entra com um link ou código de sala.',
      en: 'You share your game screen straight from the browser, free and with nothing to install. Viewers join with a link or a room code.',
    },
    steps: [
      { pt: 'Para transmitir, use “Iniciar transmissão” e escolha a janela ou a tela.', en: 'To stream, use “Start sharing” and pick the window or the screen.' },
      { pt: 'Envie o link (ou o código da sala) para quem vai assistir.', en: 'Send the link (or the room code) to the people who will watch.' },
      { pt: 'Para assistir, digite o código da sala e use “Entrar na sala”.', en: 'To watch, type the room code and use “Join room”.' },
    ],
    tips: [
      { pt: 'Se o jogo aparecer preto, rode o Priston Tale em modo janela (ou janela sem bordas).', en: 'If the game shows black, run Priston Tale in windowed (or borderless) mode.' },
      { pt: 'Quanto mais gente assistindo, mais upload você usa. Se travar, escolha uma qualidade menor.', en: 'The more viewers, the more upload you use. If it stutters, pick a lower quality.' },
      { pt: 'O celular consegue assistir, mas só o computador consegue compartilhar a tela.', en: 'A phone can watch, but only a computer can share the screen.' },
    ],
    open: { section: 'tools', toolTab: 'screenshare' },
  },
  {
    id: 'clan', icon: '🏰',
    title: { pt: 'Formação do Clã', en: 'Clan Formation' },
    summary: { pt: 'Formação do Bless Castle, para líderes de clã.', en: 'Bless Castle formation, for clan leaders.' },
    about: {
      pt: 'Ferramenta para organizar a formação do clã no Bless Castle e compartilhar um link só para leitura com os membros.',
      en: 'Tool to organize the clan’s Bless Castle formation and share a read-only link with the members.',
    },
    steps: [
      { pt: 'O líder monta a formação no quadro e acompanha a presença dos membros.', en: 'The leader sets up the formation on the board and follows the members’ attendance.' },
      { pt: 'Gere o link de compartilhamento: os membros abrem a formação, mas não conseguem alterá-la.', en: 'Create the share link: members open the formation but cannot change it.' },
    ],
    tips: [],
    note: { pt: 'Esta ferramenta só aparece para líderes e vices de clã autorizados, e para o administrador.', en: 'This tool is shown only to authorized clan leaders and vices, and to the administrator.' },
    open: { section: 'tools', toolTab: 'clan' },
  },
  {
    id: 'streamers', icon: '📺',
    title: { pt: 'Streamers', en: 'Streamers' },
    summary: { pt: 'Veja quem está ao vivo na comunidade.', en: 'See who is live in the community.' },
    about: {
      pt: 'Lista de streamers da comunidade, na Twitch e no YouTube, com quem está ao vivo agora e quantos espectadores tem.',
      en: 'List of community streamers on Twitch and YouTube, showing who is live now and how many viewers they have.',
    },
    steps: [
      { pt: 'Abra a página e veja a seção “Ao vivo agora”.', en: 'Open the page and look at the “Live now” section.' },
      { pt: 'Clique no card do streamer para abrir o canal dele em outra aba.', en: 'Click the streamer’s card to open their channel in a new tab.' },
    ],
    tips: [{ pt: 'Se ninguém estiver ao vivo, a página avisa e você pode voltar mais tarde.', en: 'If nobody is live, the page says so and you can come back later.' }],
    open: { section: 'streamers' },
  },
  {
    id: 'guides', icon: '🎬',
    title: { pt: 'Guias', en: 'Guides' },
    summary: { pt: 'Vídeos escolhidos pela equipe.', en: 'Videos picked by the team.' },
    about: {
      pt: 'Vídeos selecionados pela equipe para ajudar na sua jornada, separados por categoria.',
      en: 'Videos selected by the team to help on your journey, grouped by category.',
    },
    steps: [
      { pt: 'Escolha a categoria e clique no vídeo para assistir na própria página.', en: 'Choose the category and click the video to watch it on the page.' },
    ],
    tips: [],
    open: { section: 'guides' },
  },
];

export function findArea(id: string): Area | undefined {
  return AREAS.find((a) => a.id === id);
}
