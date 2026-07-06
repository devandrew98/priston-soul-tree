// Survive or Die (SoD): 8 rounds of mobs. Each round ends at a fixed cumulative
// time; the per-round duration lets us normalise points into a points/min pace.

export interface SodRound {
  n: number; // round number 1..8
  endSec: number; // cumulative time (seconds from start) when the round ends
  endLabel: string; // "mm:ss" as shown in game
  durationSec: number; // length of this round in seconds
}

// End timestamps provided by the game (cumulative "mm:ss").
const END_LABELS: [number, string][] = [
  [1, '1:37'],
  [2, '3:14'],
  [3, '4:48'],
  [4, '6:25'],
  [5, '8:50'],
  [6, '11:12'],
  [7, '13:36'],
  [8, '15:47'],
];

const toSec = (mmss: string) => {
  const [m, s] = mmss.split(':').map(Number);
  return m * 60 + s;
};

export const SOD_ROUNDS: SodRound[] = END_LABELS.map(([n, label], i) => {
  const endSec = toSec(label);
  const prevSec = i === 0 ? 0 : toSec(END_LABELS[i - 1][1]);
  return { n, endSec, endLabel: label, durationSec: endSec - prevSec };
});

export const SOD_TOTAL_SEC = SOD_ROUNDS[SOD_ROUNDS.length - 1].endSec;

/** "mm:ss" from seconds. */
export function fmtMS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Points per minute for a round (0 when no duration/points). */
export function perMin(points: number, durationSec: number): number {
  if (!durationSec || !points) return 0;
  return (points / durationSec) * 60;
}
