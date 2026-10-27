// Official aging chances (PristonTale EU wiki, https://wiki.pristontale.eu/en/Basic_Information/Aging).
// All values are percentages of aging TO that level. Double Aging is rolled only after a success and
// Break only after a failure, so the real chance of a double is success x double / 100 and of a break fail x break / 100.

export interface AgeChance { level: number; success: number; double: number; breakPct: number }

const RAW: [number, number, number][] = [
  [100, 18, 0], [97, 17, 0], [94, 16, 0], [88, 15, 0], [82, 14, 0], [76, 13, 0], [70, 12, 0], [64, 11, 0],
  [58, 10, 8], [52, 9, 10], [46, 8, 12], [40, 7, 14], [32, 6, 16], [29, 5, 18], [26, 4, 20], [23, 3, 22],
  [20, 2, 24], [17, 1, 26], [14, 1, 28], [12, 1, 30], [8, 0, 33], [5, 0, 35],
];

export const AGE_CHANCES: AgeChance[] = RAW.map(([success, double, breakPct], i) => ({ level: i + 1, success, double, breakPct }));

/** Chance of failing the attempt (100 - success). */
export const failChance = (c: AgeChance) => 100 - c.success;

/** Aging Efficiency: each failed attempt adds this many points of success chance (reset on success or break). */
export const EFFICIENCY_STEP = 2;

/** Success chance of the next attempt after `fails` failures in a row (Aging Efficiency), capped at 100. */
export const effectiveSuccess = (baseSuccess: number, fails: number) => Math.min(100, baseSuccess + EFFICIENCY_STEP * Math.max(0, fails));
