import { METRES_PER_MILE, passes, pointAt } from './geo';
import { RUNS, formatTime, formatWeekday } from './schedule';
import { arrival } from './timing';

const STORAGE_KEY = 'santa-run-pin';
const MINUTE = 60000;

// The pin is where the person is, or where they tapped. It never leaves the phone.
export function loadPin() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Number.isFinite(saved.lng) && Number.isFinite(saved.lat)) return saved;
  } catch {
    // Storage is blocked or empty; start without a pin.
  }
  return null;
}

export function savePin(pin) {
  try {
    if (pin) localStorage.setItem(STORAGE_KEY, JSON.stringify(pin));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Works for this visit even if it can't be remembered.
  }
}

/** Ask the phone where it is. Rejects if the person says no or it can't tell. */
export function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('No location on this device'));
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lng: position.coords.longitude, lat: position.coords.latitude }),
      reject,
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * MINUTE }
    );
  });
}

function milesFromYou(metres) {
  if (metres < 120) return null;
  const miles = metres / METRES_PER_MILE;
  const shown = miles < 10 ? miles.toFixed(1).replace(/\.0$/, '') : String(Math.round(miles));
  return `${shown} ${shown === '1' ? 'mile' : 'miles'} from you`;
}

/** "between 6:30 and 7:00 pm": a half-hour window around a time. */
function windowAround(time, stepMinutes, earliest) {
  const step = stepMinutes * MINUTE;
  const from = Math.max(earliest, Math.round((time - 15 * MINUTE) / step) * step);
  const start = formatTime(new Date(from));
  const end = formatTime(new Date(from + 30 * MINUTE));
  const sameHalf = start.slice(-2) === end.slice(-2);
  return `between ${sameHalf ? start.slice(0, -3) : start} and ${end}`;
}

const roundedMinutes = (minutes) => (minutes < 8 ? 5 : Math.round(minutes / 5) * 5);

/**
 * What the card says about the pin: one entry per night still to come.
 *
 *   { id, day, tonight, point, distance, when, state }
 *
 * `point` is the spot on that night's route closest to the pin. On a road
 * Santa drives twice it is the next pass that hasn't happened yet.
 * `state` is planned | close | here | passed.
 *
 * `live` describes tonight's run while it is under way:
 *   { runId, santaAlong }   santaAlong may be null if we can't place him.
 */
export function describeNights({ pin, routes, plans, now, live, finishedRunId }) {
  const at = [pin.lng, pin.lat];

  return RUNS.filter(
    (run) => routes[run.id] && plans[run.id] && run.endAt > now && run.id !== finishedRunId
  ).map((run) => {
    const route = routes[run.id];
    const plan = plans[run.id];
    const { dist, alongs } = passes(route, at);
    const tonight = live?.runId === run.id;
    const santaAlong = tonight ? live.santaAlong : null;

    const base = { id: run.id, day: formatWeekday(run.startAt), tonight, distance: milesFromYou(dist) };

    if (santaAlong == null) {
      const along = alongs[0];
      // Before he sets off, or while we can't place him: the plan, never a time already gone.
      const planned = plan.timeAt(along);
      const start = run.startAt.getTime();
      // The first few minutes of the route don't need a half-hour window.
      if (planned - start < 15 * MINUTE && now.getTime() < start) {
        return { ...base, point: pointAt(route, along), state: 'planned', when: `just after ${formatTime(run.startAt)}` };
      }
      const time = Math.max(planned, tonight ? now.getTime() + 10 * MINUTE : 0);
      return { ...base, point: pointAt(route, along), state: 'planned', when: windowAround(time, tonight ? 5 : 15, run.startAt.getTime()) };
    }

    const along = alongs.find((a) => a > santaAlong - 100);
    if (along === undefined) {
      return { ...base, point: pointAt(route, alongs[alongs.length - 1]), state: 'passed', when: null };
    }
    const point = pointAt(route, along);
    const time = arrival(plan, along, { now: now.getTime(), santaAlong });
    const minutes = (time - now.getTime()) / MINUTE;
    if (along - santaAlong < 400 || minutes < 3) {
      return { ...base, point, state: 'here', when: 'almost here' };
    }
    if (minutes <= 30) {
      return { ...base, point, state: 'close', when: `about ${roundedMinutes(minutes)} minutes away` };
    }
    return { ...base, point, state: 'planned', when: windowAround(time, 5, run.startAt.getTime()) };
  });
}
