// Countdown to the launch of the new season: Friday 27 November 2026, 15:00 Brasília time.
// Brasília is UTC-3 all year (Brazil has no daylight saving time any more), so 15:00 there is 18:00 UTC.
// The target is an absolute instant, so every visitor sees the same remaining time whatever their own time zone is.

export const SEASON_LAUNCH_AT = Date.UTC(2026, 10, 27, 18, 0, 0);

export interface Remaining { days: number; hours: number; minutes: number; seconds: number; done: boolean }

/** Time left from `now` until `target` (both in ms). Never negative: once the moment has come, `done` is true and all parts are 0. */
export function remaining(now: number, target: number = SEASON_LAUNCH_AT): Remaining {
  const total = Math.max(0, Math.floor((target - now) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    done: target - now <= 0,
  };
}
