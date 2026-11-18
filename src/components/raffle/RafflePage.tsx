// pristonzone.com/rifa: the PristonZONE raffle. Players log in with their site account, reserve numbers (up to the limit) and pay
// in the game; the administrator confirms the payments and draws the winner (at random, among the paid numbers) in the admin panel.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { requestLogin } from '../../lib/builds/account';
import { useI18n } from '../../lib/i18n';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import {
  allowance, cellState, daysLeft, fmtGold, reservedCount, soldCount, toggleSelection,
  type HistoryItem, type Raffle, type TakenNumber,
} from '../../lib/raffle';
import * as realApi from '../../lib/raffleApi';
import { demoApi } from '../../lib/raffleDemo';
import { Loading } from '../Loading';
import { useAuth } from '../market/store';
import { RichText } from '../RichText';

type Lang = 'pt' | 'en';
type L = { pt: string; en: string };
type Tab = 'current' | 'history' | 'winners';

const NICK_KEY = 'pz-raffle-nick';
const POLL_MS = 20000;

const TXT = {
  title: { pt: 'Rifa', en: 'Raffle' },
  tabCurrent: { pt: 'Rifa atual', en: 'Current raffle' },
  tabHistory: { pt: 'Histórico', en: 'History' },
  tabWinners: { pt: 'Ganhadores', en: 'Winners' },
  noBackend: { pt: 'Sem conexão com o banco neste ambiente.', en: 'No database connection in this environment.' },
  notReady: { pt: 'A rifa ainda não está ativa: falta rodar o arquivo supabase/49_raffle.sql no Supabase.', en: 'The raffle is not active yet: supabase/49_raffle.sql still has to be run in Supabase.' },
  none: { pt: 'Não há rifa aberta no momento. Volte em breve!', en: 'There is no open raffle right now. Come back soon!' },
  daysLeft: { pt: 'Faltam {n} dias para a rifa.', en: '{n} days remaining for the raffle.' },
  dayLeft: { pt: 'Falta 1 dia para a rifa.', en: '1 day remaining for the raffle.' },
  lastDay: { pt: 'Último dia da rifa!', en: 'Last day of the raffle!' },
  choose: { pt: 'Escolha seus números', en: 'Choose your number(s)' },
  sold: { pt: '{a} / {b} números vendidos', en: '{a} / {b} numbers sold' },
  reservedN: { pt: '{n} reservados', en: '{n} reserved' },
  legendFree: { pt: 'Disponível', en: 'Available' },
  legendMine: { pt: 'Seu', en: 'Yours' },
  legendReserved: { pt: 'Reservado por outra pessoa', en: 'Reserved by someone else' },
  legendPaid: { pt: 'Já comprado', en: 'Already bought' },
  yourNumbers: { pt: 'Seus números:', en: 'Your numbers:' },
  nick: { pt: 'Nick do seu personagem no jogo', en: 'Your in-game character nick' },
  nickHint: { pt: 'É com esse nome que você aparece na rifa e que será usado na cobrança.', en: 'This is the name you appear with in the raffle and that will be used for the payment.' },
  reserve: { pt: 'Reservar', en: 'Reserve' },
  reserveN: { pt: 'Reservar {n} número(s)', en: 'Reserve {n} number(s)' },
  loginToReserve: { pt: 'Entrar para reservar', en: 'Log in to reserve' },
  pickSome: { pt: 'Toque nos números livres que você quer.', en: 'Tap the free numbers you want.' },
  limitReached: { pt: 'Você já está no limite de números desta rifa.', en: 'You are already at the limit of numbers for this raffle.' },
  reservedOk: { pt: 'Reservado! Agora faça o pagamento no jogo, como mostra o quadro abaixo.', en: 'Reserved! Now pay in the game, as shown in the box below.' },
  pricePer: { pt: 'Preço por número', en: 'Price per number' },
  or: { pt: 'ou', en: 'or' },
  coins: { pt: 'Coins', en: 'Coins' },
  gold: { pt: 'Gold', en: 'Gold' },
  payTitle: { pt: 'Falta pagar', en: 'Payment due' },
  allPaid: { pt: 'Seus números estão pagos. Boa sorte!', en: 'Your numbers are paid. Good luck!' },
  payTotal: { pt: 'Total a pagar:', en: 'Total to pay:' },
  payHow: { pt: 'Envie o pagamento para {who}, informando o seu nick e os números. Depois que o pagamento for confirmado, o número passa a ficar “vendido”.', en: 'Send the payment to {who}, telling your nick and the numbers. Once the payment is confirmed, the number turns “sold”.' },
  payHowNoWho: { pt: 'Combine o pagamento com o organizador, nos canais do PristonZONE, informando o seu nick e os números. Depois que for confirmado, o número passa a ficar “vendido”.', en: 'Arrange the payment with the organizer on the PristonZONE channels, telling your nick and the numbers. Once confirmed, the number turns “sold”.' },
  until: { pt: 'Reserva vale até {d}', en: 'Reservation valid until {d}' },
  giveUp: { pt: 'Desistir', en: 'Give up' },
  paidTag: { pt: 'pago ✓', en: 'paid ✓' },
  rules: { pt: 'Regras:', en: 'Rules:' },
  rulePrize: { pt: 'Prêmio da rifa: {x}.', en: 'Raffle prize: {x}.' },
  ruleMax: { pt: 'Cada pessoa pode comprar até {n} números.', en: 'Each person can buy up to {n} numbers.' },
  ruleHold: { pt: 'A reserva vale por {h} horas: se o pagamento não for confirmado nesse prazo, o número volta a ficar livre.', en: 'A reservation lasts {h} hours: if the payment is not confirmed in that time, the number becomes free again.' },
  ruleDraw: { pt: 'O ganhador é sorteado ao acaso entre os números pagos, quando a rifa for encerrada.', en: 'The winner is drawn at random among the paid numbers when the raffle ends.' },
  historyEmpty: { pt: 'Ainda não há rifas encerradas.', en: 'There are no finished raffles yet.' },
  winnersEmpty: { pt: 'Ainda não há ganhadores.', en: 'There are no winners yet.' },
  drawnOn: { pt: 'Sorteada em {d}', en: 'Drawn on {d}' },
  cancelled: { pt: 'Cancelada', en: 'Cancelled' },
  winnerWord: { pt: 'Ganhador:', en: 'Winner:' },
  number: { pt: 'Número', en: 'Number' },
  soldOf: { pt: '{a} de {b} números vendidos', en: '{a} of {b} numbers sold' },
  nickTooShort: { pt: 'Informe o nick do seu personagem (pelo menos 2 letras).', en: 'Enter your character nick (at least 2 letters).' },
} as const satisfies Record<string, L>;

/** What the database says (in Portuguese) shown in the visitor's language. */
const DB_ERRORS: [RegExp, L][] = [
  [/entre na sua conta/i, { pt: 'Entre na sua conta para reservar.', en: 'Log in to reserve.' }],
  [/não há rifa aberta/i, { pt: 'Não há rifa aberta.', en: 'There is no open raffle.' }],
  [/informe o nick/i, { pt: 'Informe o nick do seu personagem (2 a 30 letras).', en: 'Enter your character nick (2 to 30 letters).' }],
  [/escolha pelo menos/i, { pt: 'Escolha pelo menos um número.', en: 'Pick at least one number.' }],
  [/número repetido/i, { pt: 'Número repetido.', en: 'Repeated number.' }],
  [/número fora da rifa/i, { pt: 'Número fora da rifa.', en: 'Number outside the raffle.' }],
  [/limite de (\d+) números/i, { pt: 'Você chegou ao limite de números desta rifa.', en: 'You reached the limit of numbers for this raffle.' }],
  [/acabou de ser reservado/i, { pt: 'Algum número acabou de ser reservado por outra pessoa. Escolha outro.', en: 'A number was just reserved by someone else. Pick another one.' }],
];

const NUM = (lang: Lang) => (lang === 'pt' ? 'pt-BR' : 'en-US');
const fmtDateTime = (iso: string, lang: Lang) => new Date(iso).toLocaleString(NUM(lang), { dateStyle: 'short', timeStyle: 'short' });
const fmtDay = (iso: string, lang: Lang) => new Date(iso).toLocaleDateString(NUM(lang), { dateStyle: 'medium' });
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));

export function errText(e: unknown, lang: Lang): string {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  const hit = DB_ERRORS.find(([re]) => re.test(m));
  return hit ? hit[1][lang] : m;
}

const readNick = () => { try { return localStorage.getItem(NICK_KEY) ?? ''; } catch { return ''; } };
const saveNick = (v: string) => { try { localStorage.setItem(NICK_KEY, v); } catch { /* ignore */ } };

function Prices({ raffle, lang, times = 1 }: { raffle: Raffle; lang: Lang; times?: number }) {
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  return (
    <span className="rf-prices">
      {raffle.priceCoins !== null && <span className="rf-price"><i aria-hidden="true">🪙</i> <b>{(raffle.priceCoins * times).toLocaleString(NUM(lang))}</b> {T('coins')}</span>}
      {raffle.priceCoins !== null && raffle.priceGoldKk !== null && <span className="rf-or">{T('or')}</span>}
      {raffle.priceGoldKk !== null && <span className="rf-price"><i aria-hidden="true">💰</i> <b>{fmtGold(raffle.priceGoldKk * times)}</b> {T('gold')}</span>}
    </span>
  );
}

function ItemImage({ url, name }: { url: string; name: string }) {
  const [bad, setBad] = useState(false);
  return url && !bad
    ? <img className="rf-item-img" src={url} alt={name} onError={() => setBad(true)} />
    : <span className="rf-item-img rf-item-fallback" aria-hidden="true">🎁</span>;
}

// ---------- current raffle ----------
type Api = Pick<typeof realApi, 'fetchRaffle' | 'fetchRaffleHistory' | 'reserveNumbers' | 'releaseMine'>;

function Current({ raffle, taken, onChanged, lang, api, demo }: { raffle: Raffle; taken: TakenNumber[]; onChanged: () => void; lang: Lang; api: Api; demo: boolean }) {
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const auth = useAuth();
  const [selected, setSelected] = useState<number[]>([]);
  const [nick, setNick] = useState(() => readNick());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const left = allowance(raffle.maxPerPerson, taken);
  const mine = taken.filter((t) => t.mine).sort((a, b) => a.n - b.n);
  const mineReserved = mine.filter((t) => t.status === 'reserved');
  const profileNick = auth.user?.nick ?? '';
  const loggedIn = demo || auth.isLoggedIn;
  const left_days = daysLeft(raffle.endsAt, Date.now());

  // The nick starts as the site nick when the person never typed one.
  useEffect(() => { if (!nick && profileNick) setNick(profileNick); }, [profileNick]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (n: number) => { setErr(''); setOk(''); setSelected((cur) => toggleSelection(cur, n, taken, left)); };

  const reserve = async () => {
    setErr(''); setOk('');
    if (nick.trim().length < 2) return setErr(T('nickTooShort'));
    setBusy(true);
    try {
      await api.reserveNumbers(selected, nick.trim());
      saveNick(nick.trim());
      setSelected([]); setOk(T('reservedOk')); onChanged();
    } catch (e) { setErr(errText(e, lang)); onChanged(); }
    finally { setBusy(false); }
  };

  const giveUp = async (n: number) => {
    setErr(''); setOk('');
    try { await api.releaseMine(n); onChanged(); } catch (e) { setErr(errText(e, lang)); }
  };

  const expiry = mineReserved.map((t) => t.expires).filter((x): x is string => !!x).sort()[0];

  return (
    <div className="rf-current">
      <aside className="rf-item">
        <ItemImage url={raffle.imageUrl} name={raffle.itemName} />
        <h2 className="rf-item-name">{raffle.itemName}</h2>
        {raffle.itemNote && <span className="rf-item-note">{raffle.itemNote}</span>}
        {left_days !== null && <p className="rf-days">📅 {left_days === 0 ? T('lastDay') : left_days === 1 ? T('dayLeft') : fill(T('daysLeft'), { n: left_days })}</p>}
      </aside>

      <section className="rf-board">
        <div className="rf-board-head">
          <h2>{T('choose')}</h2>
          <span className="rf-count">{fill(T('sold'), { a: soldCount(taken), b: raffle.totalNumbers })}{reservedCount(taken) > 0 && <small> · {fill(T('reservedN'), { n: reservedCount(taken) })}</small>}</span>
        </div>

        <div className="rf-grid" role="group" aria-label={T('choose')}>
          {Array.from({ length: raffle.totalNumbers }, (_, i) => i + 1).map((n) => {
            const st = cellState(n, taken);
            const who = taken.find((t) => t.n === n)?.nick;
            const isSel = selected.includes(n);
            const free = st === 'free';
            return (
              <button key={n} type="button" className={`rf-cell ${st}${isSel ? ' sel' : ''}`} disabled={!free && !isSel}
                aria-pressed={isSel} title={who ? `${who}` : undefined} onClick={() => pick(n)}>{n}</button>
            );
          })}
        </div>
        <div className="rf-legend" aria-hidden="true">
          <span><i className="rf-cell free" /> {T('legendFree')}</span>
          <span><i className="rf-cell mine-reserved" /> {T('legendMine')}</span>
          <span><i className="rf-cell reserved" /> {T('legendReserved')}</span>
          <span><i className="rf-cell paid" /> {T('legendPaid')}</span>
        </div>

        <div className="rf-actions">
          {!loggedIn ? (
            <button type="button" className="mk-btn primary rf-buy" onClick={() => requestLogin()}>🔑 {T('loginToReserve')}</button>
          ) : (
            <>
              <label className="rf-nick">
                <span>{T('nick')}</span>
                <input value={nick} maxLength={30} onChange={(e) => setNick(e.target.value)} autoComplete="nickname" />
                <small>{T('nickHint')}</small>
              </label>
              <button type="button" className="mk-btn primary rf-buy" disabled={busy || selected.length === 0 || left === 0} onClick={reserve}>
                {busy ? '⏳' : selected.length > 0 ? `🎁 ${fill(T('reserveN'), { n: selected.length })}` : `🎁 ${T('reserve')}`}
              </button>
            </>
          )}
          <span className="rf-yours">{T('yourNumbers')} <b>{mine.length} / {raffle.maxPerPerson}</b></span>
        </div>
        {loggedIn && selected.length === 0 && left > 0 && !err && !ok && <p className="mk-muted rf-hint">{T('pickSome')}</p>}
        {loggedIn && left === 0 && <p className="mk-muted rf-hint">{T('limitReached')}</p>}
        {err && <p className="mk-warn" role="alert">{err}</p>}
        {ok && <p className="rf-ok" role="status">{ok}</p>}

        <div className="rf-priceline">
          <small>{T('pricePer')}</small>
          <Prices raffle={raffle} lang={lang} />
        </div>
      </section>

      {mine.length > 0 && (
        <section className="rf-pay sr-card">
          <h3 className="mk-h2">{mineReserved.length > 0 ? `⏳ ${T('payTitle')}` : `✅ ${T('allPaid')}`}</h3>
          <ul className="rf-mine">
            {mine.map((t) => (
              <li key={t.n}>
                <b>#{t.n}</b> <span className={t.status === 'paid' ? 'rf-paid-tag' : 'rf-wait-tag'}>{t.status === 'paid' ? T('paidTag') : (lang === 'pt' ? 'aguardando pagamento' : 'waiting for payment')}</span>
                {t.status === 'reserved' && <button type="button" className="mk-btn sm" onClick={() => giveUp(t.n)}>{T('giveUp')}</button>}
              </li>
            ))}
          </ul>
          {mineReserved.length > 0 && (
            <>
              <p className="rf-total">{T('payTotal')} <Prices raffle={raffle} lang={lang} times={mineReserved.length} /></p>
              {raffle.payText
                ? <RichText className="rf-pay-text" source={raffle.payText} />
                : <p>{raffle.payTo ? <>{T('payHow').split('{who}')[0]}<b>{raffle.payTo}</b>{T('payHow').split('{who}')[1]}</> : T('payHowNoWho')}</p>}
              {expiry && <p className="mk-muted">{fill(T('until'), { d: fmtDateTime(expiry, lang) })}</p>}
            </>
          )}
        </section>
      )}

      <section className="rf-rules sr-card">
        <b>ℹ️ {T('rules')}</b>
        <ul>
          <li>{fill(T('rulePrize'), { x: raffle.itemName })}</li>
          {raffle.itemNote && <li>{raffle.itemNote}</li>}
          <li>{fill(T('ruleMax'), { n: raffle.maxPerPerson })}</li>
          <li>{fill(T('ruleHold'), { h: raffle.holdHours })}</li>
          <li>{T('ruleDraw')}</li>
        </ul>
        {raffle.rules && <RichText source={raffle.rules} />}
      </section>
    </div>
  );
}

// ---------- history and winners ----------
function Past({ items, lang, onlyWinners }: { items: HistoryItem[]; lang: Lang; onlyWinners: boolean }) {
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const list = onlyWinners ? items.filter((i) => i.status === 'drawn' && i.winnerNick) : items;
  if (list.length === 0) return <p className="mk-muted">{onlyWinners ? T('winnersEmpty') : T('historyEmpty')}</p>;
  return (
    <ul className="rf-past">
      {list.map((h) => (
        <li key={h.id} className="sr-card rf-past-card">
          <ItemImage url={h.imageUrl} name={h.itemName} />
          <div className="rf-past-info">
            <b>{h.itemName}</b>
            {h.itemNote && <small className="mk-muted">{h.itemNote}</small>}
            <small className="mk-muted">{fill(T('soldOf'), { a: h.sold, b: h.totalNumbers })}</small>
            {h.status === 'cancelled'
              ? <span className="rf-cancelled">{T('cancelled')}</span>
              : <span className="rf-winner">🏆 {T('winnerWord')} <b>{h.winnerNick}</b> · {T('number')} <b>{h.winnerNumber}</b>{h.drawnAt && <small className="mk-muted"> · {fill(T('drawnOn'), { d: fmtDay(h.drawnAt, lang) })}</small>}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RafflePage() {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const [tab, setTab] = useState<Tab>('current');
  const [state, setState] = useState<{ raffle: Raffle | null; taken: TakenNumber[] } | null>(null);
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [err, setErr] = useState('');
  const alive = useRef(true);
  const langRef = useRef(lang);
  langRef.current = lang;
  // /rifa?demo (local server only): a sample raffle kept in memory, to look at the page without the database.
  const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');
  const api: Api = demo ? demoApi : realApi;

  const load = useCallback(async () => {
    if (!demo && !BACKEND_ENABLED) { setErr(TXT.noBackend[langRef.current]); return; }
    try {
      const [s, h] = await Promise.all([api.fetchRaffle(), api.fetchRaffleHistory()]);
      if (alive.current) { setState(s); setHistory(h); setErr(''); }
    } catch (e) {
      if (!alive.current) return;
      const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
      setErr(/raffle_|schema cache|function/i.test(m) ? TXT.notReady[langRef.current] : m);
    }
  }, [demo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    alive.current = true;
    void load();
    const id = window.setInterval(() => { void load(); }, POLL_MS); // so what other people reserve shows up
    return () => { alive.current = false; window.clearInterval(id); };
  }, [load]);

  const tabs = useMemo(() => ([['current', T('tabCurrent')], ['history', T('tabHistory')], ['winners', T('tabWinners')]] as [Tab, string][]),
    [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mk rf">
      <h1 className="mk-h1">🎁 {T('title')}</h1>
      <div className="af-chips rf-tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`af-chip${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {demo && (
        <div className="rf-demo" role="note">
          <b>DEMONSTRAÇÃO</b> · rifa de exemplo, nada é salvo no banco e tudo some ao recarregar. Você está “logado” como um jogador de teste.
          <span className="rf-demo-btns">
            <button type="button" className="mk-btn sm" onClick={async () => { await demoApi.simulatePaid(); void load(); }}>Simular: o admin confirmou meu pagamento</button>
            <button type="button" className="mk-btn sm" onClick={async () => { await demoApi.reset(); void load(); }}>Recomeçar</button>
          </span>
        </div>
      )}
      {err && <p className="mk-warn" role="alert">{err}</p>}
      {!state && !err && <Loading />}
      {state && tab === 'current' && (state.raffle
        ? <Current raffle={state.raffle} taken={state.taken} onChanged={() => void load()} lang={lang} api={api} demo={demo} />
        : <p className="mk-muted">{T('none')}</p>)}
      {state && tab === 'history' && <Past items={history ?? []} lang={lang} onlyWinners={false} />}
      {state && tab === 'winners' && <Past items={history ?? []} lang={lang} onlyWinners />}
    </div>
  );
}
