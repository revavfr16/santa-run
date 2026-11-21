import schedule from '../schedule.json';

// The firehouse's time zone, so dates read the same on every phone.
const TIME_ZONE = 'America/New_York';

/** False until the crew has settled this year's routes; the page says so. */
export const ROUTES_FINAL = schedule.routesFinal !== false;

// A landmark's time is a clock time on the night of its run: "17:30".
const onNight = (run, clock) => new Date(`${run.start.slice(0, 10)}T${clock}:00${run.start.slice(19)}`);

/**
 * Each run has three times:
 *   start   Santa leaves the firehouse
 *   finish  he reaches the end of the route (used for estimates)
 *   end     tracking switches itself off
 */
export const RUNS = schedule.runs
  .map((run) => ({
    ...run,
    startAt: new Date(run.start),
    finishAt: new Date(run.finish || run.end),
    endAt: new Date(run.end),
    landmarks: (run.landmarks || []).map((mark) => ({ ...mark, timeAt: onNight(run, mark.time) })),
  }))
  .sort((a, b) => a.startAt - b.startAt);

const format = (options) => new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, ...options });
const longDay = format({ weekday: 'long', month: 'long', day: 'numeric' });
const weekday = format({ weekday: 'long' });
const shortWeekday = format({ weekday: 'short' });
const dayOfMonth = format({ day: 'numeric' });
const clock = format({ hour: 'numeric', minute: '2-digit' });
const dayKey = format({ year: 'numeric', month: '2-digit', day: '2-digit' });

export const formatLongDay = (date) => longDay.format(date);
export const formatWeekday = (date) => weekday.format(date);
/** "Sat 19" */
export const formatShortDay = (date) => `${shortWeekday.format(date)} ${dayOfMonth.format(date)}`;
/** "4:00 pm" */
export const formatTime = (date) => clock.format(date).replace(/\s?([AP])M$/, (_, half) => ` ${half.toLowerCase()}m`);
const isSameDay = (a, b) => dayKey.format(a) === dayKey.format(b);

export function formatDuration(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const h = `${hours} hour${hours === 1 ? '' : 's'}`;
  return rest ? `${h} ${rest} min` : h;
}

/**
 * Where we are in the season.
 *
 *   before  a run is coming up
 *   live    Santa is out
 *   paused  Santa is out but the crew has paused tracking
 *   hold    a run is scheduled now but the crew has tracking switched off
 *   done    tonight's run has finished (the server says so once Santa is home)
 *   over    no runs left this year
 *
 * `run` is the run that matters most right now. The server's answer wins over
 * the phone's clock, so a rehearsal drive or a wrong phone clock still works.
 */
export function getPhase(now, serverStatus, answered = false) {
  const active = RUNS.find((run) => now >= run.startAt && now <= run.endAt);
  const next = RUNS.find((run) => run.startAt > now) || null;
  const previous = [...RUNS].reverse().find((run) => run.endAt < now) || null;
  const run = active || next || previous;

  if (serverStatus === 'done' && (active || previous)) return { phase: 'done', run: active || previous, next };
  if (serverStatus === 'paused') return { phase: 'paused', run, next };
  if (serverStatus === 'live') return { phase: 'live', run, next };
  if (active) return { phase: answered ? 'hold' : 'live', run, next };
  if (previous && isSameDay(previous.endAt, now)) return { phase: 'done', run: previous, next };
  if (next) return { phase: 'before', run: next, next };
  return { phase: 'over', run: previous, next: null };
}

/** True from half an hour before a run until a little after it ends. */
export function isNearRun(now) {
  return RUNS.some(
    (run) => now >= run.startAt.getTime() - 30 * 60000 && now <= run.endAt.getTime() + 15 * 60000
  );
}
