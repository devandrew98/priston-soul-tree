// pristonzone.com/overlay: what the PristonZONE Overlay (Boss Timer) is, what it is for and how it works, with real screenshots of the app.
import { useEffect, useState } from 'react';
import { trackEvent } from '../../lib/analytics';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { useI18n } from '../../lib/i18n';
import { OVERLAY_KEY, downloadUrl, fetchAppDownload } from '../../lib/market/downloads';

type L = { pt: string; en: string };

interface Shot { src: string; alt: L; caption: L }

const TXT = {
  title: { pt: 'Overlay PristonZONE', en: 'PristonZONE Overlay' },
  subtitle: { pt: 'Os timers do jogo numa janelinha por cima da tela, com aviso por voz.', en: 'The game timers in a small window on top of your screen, with voice alerts.' },
  download: { pt: 'Baixar o Overlay (Windows)', en: 'Download the Overlay (Windows)' },
  downloadNote: { pt: 'Programa portátil: não precisa instalar nem ser administrador.', en: 'Portable program: no install and no administrator rights needed.' },
  whatTitle: { pt: 'O que é e para que serve', en: 'What it is and what it is for' },
  what: [
    {
      pt: 'O Overlay PristonZONE (também chamado de Boss Timer) é um programa para Windows que mostra uma janelinha sempre por cima de tudo, com a contagem regressiva dos bosses do PristonTale EU. Assim você acompanha os horários sem sair do jogo e sem ficar abrindo o site.',
      en: 'The PristonZONE Overlay (also called Boss Timer) is a Windows program that shows a small always-on-top window with the countdown for the PristonTale EU bosses. This way you follow the schedules without leaving the game or opening the site.',
    },
    {
      pt: 'Ele serve para você não perder o nascimento de um boss: o programa avisa por voz e por som antes do horário, deixa o timer vermelho nos últimos minutos e destaca em dourado quando o boss nasce.',
      en: 'It is there so you do not miss a boss spawn: the program warns you by voice and sound before the time, turns the timer red in the last minutes and highlights it in gold when the boss spawns.',
    },
  ] as L[],
  whatListTitle: { pt: 'O que ele mostra', en: 'What it shows' },
  whatList: [
    { pt: 'Bosses: o cronograma oficial, com os bosses do mesmo horário juntos num só contador.', en: 'Bosses: the official schedule, with the bosses of the same time grouped under one counter.' },
    { pt: 'Fury: os horários da faixa de nível que você escolher (os mesmos do Timer Fury do site).', en: 'Fury: the times of the level range you choose (the same as the site\'s Fury Timer).' },
    { pt: 'Vengeful: os horários dos bosses Vengeful.', en: 'Vengeful: the times of the Vengeful bosses.' },
    { pt: 'Calculadora de Farm: um caderno para registrar suas sessões de farm e comparar mapas (abre pelo ícone da calculadora).', en: 'Farm Calculator: a notebook to log your farm sessions and compare maps (opens from the calculator icon).' },
  ] as L[],
  howTitle: { pt: 'Como funciona', en: 'How it works' },
  s1: { pt: '1. Baixar e abrir', en: '1. Download and open' },
  s1p: [
    { pt: 'Baixe o arquivo e dê dois cliques. Não precisa instalar nem ser administrador.', en: 'Download the file and double-click it. No install and no administrator rights needed.' },
    { pt: 'Na primeira vez, a tela de configurações abre sozinha: escolha os bosses, o tema e os alertas. Depois o programa fica na bandeja do sistema, perto do relógio.', en: 'The first time, the settings screen opens by itself: pick your bosses, theme and alerts. After that the program stays in the system tray, next to the clock.' },
    { pt: 'Suas escolhas ficam salvas num arquivo ao lado do programa (pristonzone-boss-timer.config.json).', en: 'Your choices are saved in a file next to the program (pristonzone-boss-timer.config.json).' },
  ] as L[],
  s2: { pt: '2. A janela do Overlay', en: '2. The Overlay window' },
  s2p: [
    { pt: 'Esta é a janela que fica por cima do jogo. Cada bloco é um timer: Bosses, Fury e Vengeful. Cada um mostra o nome, o mapa e o horário em GMT (GMT 0), com a contagem regressiva ao lado.', en: 'This is the window that stays on top of the game. Each block is a timer: Bosses, Fury and Vengeful. Each one shows the name, the map and the time in GMT (GMT 0), with the countdown beside it.' },
  ] as L[],
  statesTitle: { pt: 'As cores e etiquetas', en: 'Colors and labels' },
  states: [
    { pt: 'PRÓXIMO: ainda falta tempo.', en: 'PRÓXIMO (next): there is still time.' },
    { pt: 'Vermelho pulsando (NASCENDO EM BREVE): faltam menos de 2 minutos.', en: 'Pulsing red (spawning soon): less than 2 minutes left.' },
    { pt: 'Dourado (VIVO): o boss acabou de nascer. Fica assim por alguns minutos (3 por padrão, você muda nas configurações).', en: 'Gold (VIVO / live): the boss has just spawned. It stays like this for a few minutes (3 by default, you can change it in the settings).' },
  ] as L[],
  buttonsTitle: { pt: 'Os botões da barra de cima', en: 'The buttons on the top bar' },
  buttons: [
    { pt: 'Alto-falante: silencia ou volta os alertas de voz e som.', en: 'Speaker: mutes or restores the voice and sound alerts.' },
    { pt: 'Cadeado: trava a janela no lugar (ou destrava para arrastar).', en: 'Padlock: locks the window in place (or unlocks it so you can drag it).' },
    { pt: 'Click-through: o mouse atravessa a janela e clica no jogo por trás dela.', en: 'Click-through: the mouse passes through the window and clicks the game behind it.' },
    { pt: 'Calculadora: abre a Calculadora de Farm.', en: 'Calculator: opens the Farm Calculator.' },
    { pt: 'Engrenagem: abre as configurações. X: fecha a janela do overlay (o programa continua na bandeja).', en: 'Gear: opens the settings. X: closes the overlay window (the program stays in the tray).' },
  ] as L[],
  shortcutsTitle: { pt: 'Atalhos (funcionam mesmo com o jogo em foco)', en: 'Shortcuts (they work even with the game focused)' },
  shortcuts: [
    ['Alt+B', { pt: 'mostrar ou ocultar o overlay', en: 'show or hide the overlay' }],
    ['Alt+C', { pt: 'ligar ou desligar o click-through', en: 'turn click-through on or off' }],
    ['Alt+M', { pt: 'silenciar os alertas', en: 'mute the alerts' }],
  ] as [string, L][],
  shortcutsNote: { pt: 'Dá para trocar os atalhos na aba Atalhos das configurações.', en: 'You can change the shortcuts in the Shortcuts tab of the settings.' },
  s3: { pt: '3. Deixar do seu jeito (configurações)', en: '3. Make it yours (settings)' },
  s3p: { pt: 'Clique na engrenagem para abrir as configurações. À direita fica uma pré-visualização em tempo real do que você muda. As abas principais:', en: 'Click the gear to open the settings. On the right there is a live preview of what you change. The main tabs:' },
  cfgBosses: {
    title: { pt: 'Bosses: o que aparece', en: 'Bosses: what shows up' },
    text: { pt: 'Ligue ou desligue os timers de Bosses, Fury e Vengeful, escolha a faixa de nível do Fury e marque os bosses que você quer acompanhar. Se nenhum boss de um horário estiver marcado, esse horário não aparece.', en: 'Turn the Bosses, Fury and Vengeful timers on or off, choose the Fury level range and tick the bosses you want to follow. If no boss of a time is ticked, that time does not show.' },
  },
  cfgSounds: {
    title: { pt: 'Sons e voz: os alertas', en: 'Sound and voice: the alerts' },
    text: { pt: 'Anúncios por voz e efeito sonoro, avisos antes do nascimento, e a escolha de quais timers (Bosses, Fury, Vengeful) podem fazer barulho. Dá para ajustar idioma, volume, velocidade e tom da voz, e testar.', en: 'Voice announcements and sound effect, warnings before the spawn, and the choice of which timers (Bosses, Fury, Vengeful) may make noise. You can adjust the voice language, volume, speed and pitch, and test it.' },
  },
  cfgTimers: {
    title: { pt: 'Timers: avisos e relógio do servidor', en: 'Timers: warnings and server clock' },
    text: { pt: 'Escolha com quantos minutos de antecedência a voz avisa (10, 5 e 2 por padrão) e por quanto tempo o boss fica como "vivo". Se o servidor do jogo estiver adiantado ou atrasado alguns segundos, o "Relógio do servidor" corrige a contagem de cada timer.', en: 'Choose how many minutes ahead the voice warns you (10, 5 and 2 by default) and how long the boss stays as "live". If the game server runs a few seconds early or late, the "Server clock" fixes the count of each timer.' },
  },
  clock: {
    title: { pt: 'Relógio do servidor: deixe o timer igual ao do jogo', en: 'Server clock: make the timer match the game' },
    text: [
      { pt: 'Às vezes o próprio jogo fica com o horário alterado em relação ao sistema global de horários (o relógio do mundo). Quando isso acontece, o boss nasce alguns segundos antes ou depois do que o cronograma diz, e o timer do overlay fica fora de sincronia com o servidor do jogo.', en: 'Sometimes the game itself runs with a time shifted from the global time system (the world clock). When that happens, the boss spawns a few seconds before or after what the schedule says, and the overlay timer drifts out of sync with the game server.' },
      { pt: 'Por isso o aplicativo dá liberdade para você corrigir isso na mão. Em Configurações › Timers, no bloco "Relógio do servidor", cada timer (Bosses, Fury e Vengeful) tem o seu próprio ajuste, porque o desvio nem sempre é igual para todos.', en: 'That is why the app lets you fix it by hand. In Settings › Timers, in the "Server clock" block, each timer (Bosses, Fury and Vengeful) has its own adjustment, because the shift is not always the same for all of them.' },
    ] as L[],
    stepsTitle: { pt: 'Como ajustar', en: 'How to adjust' },
    steps: [
      { pt: 'Escolha Adiantar se o servidor está adiantado: a contagem termina antes.', en: 'Choose Advance if the server is ahead: the countdown ends sooner.' },
      { pt: 'Escolha Atrasar se o servidor está atrasado: a contagem termina depois.', en: 'Choose Delay if the server is behind: the countdown ends later.' },
      { pt: 'Digite quantos segundos de diferença (no exemplo da imagem, 12 segundos).', en: 'Type how many seconds of difference (in the example picture, 12 seconds).' },
      { pt: 'Para o mesmo ajuste em todos de uma vez, use "Aplicar em todos" e depois "Aplicar". "Zerar tudo" volta tudo a zero.', en: 'For the same adjustment on all of them at once, use "Apply to all" and then "Apply". "Reset all" sets everything back to zero.' },
    ] as L[],
    tip: { pt: 'Dica: confira num nascimento de verdade. Se o boss nasceu 12 segundos antes de o timer zerar, adiante 12 segundos. O ajuste muda só a contagem e os alertas de voz; os horários oficiais continuam intactos.', en: 'Tip: check it on a real spawn. If the boss spawned 12 seconds before the timer hit zero, advance by 12 seconds. The adjustment only changes the countdown and the voice alerts; the official times stay untouched.' },
  },
  cfgOverlay: {
    title: { pt: 'Overlay: posição, tamanho e fundo', en: 'Overlay: position, size and background' },
    text: { pt: 'Sempre por cima, travar posição, modo compacto, orientação vertical ou horizontal (uma barra fina), largura, monitor e transparência do fundo. Se a janela ficar fora da tela, use "Redefinir posição".', en: 'Always on top, lock position, compact mode, vertical or horizontal orientation (a thin bar), width, monitor and background transparency. If the window ends up off-screen, use "Reset position".' },
  },
  cfgLook: {
    title: { pt: 'Aparência: temas e cores', en: 'Appearance: themes and colors' },
    text: { pt: 'Temas prontos e ajuste das cores, sombras, transparência, bordas e tamanho dos ícones.', en: 'Ready-made themes and tuning of colors, shadows, transparency, borders and icon size.' },
  },
  cfgKeys: {
    title: { pt: 'Atalhos', en: 'Shortcuts' },
    text: { pt: 'Troque as teclas de mostrar/ocultar, click-through e silenciar.', en: 'Change the keys for show/hide, click-through and mute.' },
  },
  s4: { pt: '4. Calculadora de Farm', en: '4. Farm Calculator' },
  s4p: [
    { pt: 'O ícone da calculadora na barra do overlay abre uma janela à parte para registrar suas sessões de farm: personagem, mapa, EXP e Gold no começo e no fim, buffs usados e os drops.', en: 'The calculator icon on the overlay bar opens a separate window to log your farm sessions: character, map, EXP and Gold at the start and end, buffs used and the drops.' },
    { pt: 'Depois você vê o histórico, compara mapas, define metas e olha gráficos de EXP, Gold e drops por hora. Tudo fica salvo só no seu computador.', en: 'Then you see the history, compare maps, set goals and look at charts of EXP, Gold and drops per hour. Everything is saved only on your computer.' },
  ] as L[],
  tipsTitle: { pt: 'Dicas', en: 'Tips' },
  tips: [
    { pt: 'Os horários são os do servidor, em GMT (GMT 0). O programa já faz a contagem para você, sem precisar converter para o seu fuso.', en: 'The times are the server\'s, in GMT (GMT 0). The program already does the countdown for you, no need to convert to your timezone.' },
    { pt: 'Quer só olhar sem atrapalhar? Ligue o click-through (Alt+C): o mouse passa direto pela janela.', en: 'Want to just look without getting in the way? Turn click-through on (Alt+C): the mouse goes straight through the window.' },
    { pt: 'Prefere uma barra fina no topo ou no rodapé? Em Overlay, mude a orientação para Horizontal.', en: 'Prefer a thin bar at the top or bottom? In Overlay, switch the orientation to Horizontal.' },
    { pt: 'A janela sumiu? Aperte Alt+B, ou use o ícone da bandeja do sistema.', en: 'Window gone? Press Alt+B, or use the system tray icon.' },
  ] as L[],
  zoom: { pt: 'Clique na imagem para ver maior.', en: 'Click the image to see it bigger.' },
} as const;

const SHOTS = {
  bar: { src: '/overlay/barra.png', alt: { pt: 'A janela do Overlay com os timers de Bosses, Fury e Vengeful', en: 'The Overlay window with the Bosses, Fury and Vengeful timers' }, caption: { pt: 'A janela do Overlay por cima do jogo.', en: 'The Overlay window on top of the game.' } },
  bosses: { src: '/overlay/cfg-bosses.png', alt: { pt: 'Configurações, aba Bosses', en: 'Settings, Bosses tab' }, caption: { pt: 'Configurações › Bosses, com a pré-visualização à direita.', en: 'Settings › Bosses, with the preview on the right.' } },
  sounds: { src: '/overlay/cfg-sons.png', alt: { pt: 'Configurações, aba Sons e voz', en: 'Settings, Sound and voice tab' }, caption: { pt: 'Configurações › Sons e voz.', en: 'Settings › Sound and voice.' } },
  timers: { src: '/overlay/cfg-timers.png', alt: { pt: 'Configurações, aba Timers', en: 'Settings, Timers tab' }, caption: { pt: 'Configurações › Timers: avisos e relógio do servidor.', en: 'Settings › Timers: warnings and server clock.' } },
  clock: { src: '/overlay/cfg-relogio.png', alt: { pt: 'Relógio do servidor nas configurações de Timers', en: 'Server clock in the Timers settings' }, caption: { pt: 'Configurações › Timers › Relógio do servidor, com ajuste de 12 segundos.', en: 'Settings › Timers › Server clock, with a 12-second adjustment.' } },
  overlay: { src: '/overlay/cfg-overlay.png', alt: { pt: 'Configurações, aba Overlay', en: 'Settings, Overlay tab' }, caption: { pt: 'Configurações › Overlay: posição, tamanho e fundo.', en: 'Settings › Overlay: position, size and background.' } },
  look: { src: '/overlay/cfg-aparencia.png', alt: { pt: 'Configurações, aba Aparência', en: 'Settings, Appearance tab' }, caption: { pt: 'Configurações › Aparência: temas e cores.', en: 'Settings › Appearance: themes and colors.' } },
  keys: { src: '/overlay/cfg-atalhos.png', alt: { pt: 'Configurações, aba Atalhos', en: 'Settings, Shortcuts tab' }, caption: { pt: 'Configurações › Atalhos.', en: 'Settings › Shortcuts.' } },
  farm: { src: '/overlay/farm.png', alt: { pt: 'A Calculadora de Farm', en: 'The Farm Calculator' }, caption: { pt: 'A Calculadora de Farm: iniciar uma sessão.', en: 'The Farm Calculator: starting a session.' } },
} satisfies Record<string, Shot>;

function Print({ shot, lang, narrow }: { shot: Shot; lang: 'pt' | 'en'; narrow?: boolean }) {
  return (
    <figure className={`ovg-fig${narrow ? ' narrow' : ''}`}>
      <a href={shot.src} target="_blank" rel="noopener noreferrer" title={TXT.zoom[lang]}>
        <img src={shot.src} alt={shot.alt[lang]} />
      </a>
      <figcaption>{shot.caption[lang]}</figcaption>
    </figure>
  );
}

function Cfg({ item, shot, lang }: { item: { title: L; text: L }; shot: Shot; lang: 'pt' | 'en' }) {
  return (
    <section className="sr-card ovg-cfg">
      <h3 className="mk-h2">{item.title[lang]}</h3>
      <p>{item.text[lang]}</p>
      <Print shot={shot} lang={lang} />
    </section>
  );
}

export function OverlayGuide() {
  const { lang } = useI18n();
  const [href, setHref] = useState('');
  const [filename, setFilename] = useState('');

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    let cancelled = false;
    fetchAppDownload(OVERLAY_KEY).then((d) => {
      if (cancelled || !d) return;
      setHref(downloadUrl(d.path));
      setFilename(d.filename);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const Download = () => href ? (
    <div className="ovg-dl">
      <a className="mk-btn primary" href={href} download={filename} onClick={() => trackEvent('overlay:download')}>⬇ {TXT.download[lang]}</a>
      <small className="mk-muted">{TXT.downloadNote[lang]}</small>
    </div>
  ) : null;

  return (
    <div className="mk ovg">
      <h1 className="mk-h1">🖥️ {TXT.title[lang]}</h1>
      <p className="mk-muted">{TXT.subtitle[lang]}</p>
      <Download />

      <section className="sr-card ovg-what">
        <h2 className="mk-h2">{TXT.whatTitle[lang]}</h2>
        {TXT.what.map((p, i) => <p key={i}>{p[lang]}</p>)}
        <h3 className="ovg-h3">{TXT.whatListTitle[lang]}</h3>
        <ul>{TXT.whatList.map((p, i) => <li key={i}>{p[lang]}</li>)}</ul>
      </section>

      <h2 className="mk-h2 ovg-big">{TXT.howTitle[lang]}</h2>

      <section className="sr-card">
        <h3 className="mk-h2">{TXT.s1[lang]}</h3>
        {TXT.s1p.map((p, i) => <p key={i}>{p[lang]}</p>)}
        <Download />
      </section>

      <section className="sr-card">
        <h3 className="mk-h2">{TXT.s2[lang]}</h3>
        {TXT.s2p.map((p, i) => <p key={i}>{p[lang]}</p>)}
        <Print shot={SHOTS.bar} lang={lang} narrow />
        <div className="ovg-two">
          <div>
            <h3 className="ovg-h3">{TXT.statesTitle[lang]}</h3>
            <ul>{TXT.states.map((p, i) => <li key={i}>{p[lang]}</li>)}</ul>
          </div>
          <div>
            <h3 className="ovg-h3">{TXT.buttonsTitle[lang]}</h3>
            <ul>{TXT.buttons.map((p, i) => <li key={i}>{p[lang]}</li>)}</ul>
          </div>
        </div>
        <h3 className="ovg-h3">{TXT.shortcutsTitle[lang]}</h3>
        <table className="af-table ovg-keys">
          <tbody>{TXT.shortcuts.map(([k, d]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{d[lang]}</td></tr>)}</tbody>
        </table>
        <p className="mk-muted">{TXT.shortcutsNote[lang]}</p>
      </section>

      <h3 className="mk-h2 ovg-big">{TXT.s3[lang]}</h3>
      <p>{TXT.s3p[lang]}</p>
      <Cfg item={TXT.cfgBosses} shot={SHOTS.bosses} lang={lang} />
      <Cfg item={TXT.cfgSounds} shot={SHOTS.sounds} lang={lang} />
      <Cfg item={TXT.cfgTimers} shot={SHOTS.timers} lang={lang} />
      <section className="sr-card ovg-cfg">
        <h3 className="mk-h2">{TXT.clock.title[lang]}</h3>
        {TXT.clock.text.map((p, i) => <p key={i}>{p[lang]}</p>)}
        <Print shot={SHOTS.clock} lang={lang} />
        <h3 className="ovg-h3">{TXT.clock.stepsTitle[lang]}</h3>
        <ul>{TXT.clock.steps.map((p, i) => <li key={i}>{p[lang]}</li>)}</ul>
        <p className="mk-note">{TXT.clock.tip[lang]}</p>
      </section>
      <Cfg item={TXT.cfgOverlay} shot={SHOTS.overlay} lang={lang} />
      <Cfg item={TXT.cfgLook} shot={SHOTS.look} lang={lang} />
      <Cfg item={TXT.cfgKeys} shot={SHOTS.keys} lang={lang} />

      <section className="sr-card">
        <h3 className="mk-h2">{TXT.s4[lang]}</h3>
        {TXT.s4p.map((p, i) => <p key={i}>{p[lang]}</p>)}
        <Print shot={SHOTS.farm} lang={lang} />
      </section>

      <section className="sr-card">
        <h3 className="mk-h2">{TXT.tipsTitle[lang]}</h3>
        <ul>{TXT.tips.map((p, i) => <li key={i}>{p[lang]}</li>)}</ul>
      </section>

      <Download />
    </div>
  );
}
