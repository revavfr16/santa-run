// The crew's tracking switch, shared by the public and crew functions.
//
// The switch is one small record in Netlify Blobs. Anyone can be told its
// effect; changing it needs a Google sign-in from the crew's Workspace
// (see functions/crew.mjs).

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getStore } from '@netlify/blobs';
import schedule from '../../src/schedule.json' with { type: 'json' };

// auto    follow the schedule, and stop once Santa is back at the firehouse
// live    show Santa now, whatever the schedule says
// paused  hide Santa and say he is taking a short break
// off     hide Santa and say nothing is happening
export const MODES = ['auto', 'live', 'paused', 'off'];

// Anything other than "auto" lapses by itself, so a forgotten switch can
// neither leave a vehicle visible nor leave next week's run switched off.
// A switch used on a run night lapses when that run ends. Otherwise
// "Track now" lasts long enough for a rehearsal and the rest last longer.
const HOUR = 3600000;
const OVERRIDE_HOURS = 8;
const REHEARSAL_HOURS = 2;

// Back at the firehouse this close to the planned finish means the night is over.
const HOME_METRES = 200;
const HOME_BEFORE_FINISH = 90 * 60000;

const MODE_KEY = 'mode';
const FINISHED_KEY = 'finished';

export const openStore = () => getStore({ name: 'santa-run', consistency: 'strong' });

const runs = schedule.runs.map((run) => ({
  id: run.start,
  start: Date.parse(run.start),
  finish: Date.parse(run.finish || run.end),
  end: Date.parse(run.end),
}));

const activeRun = (now) => runs.find((run) => now >= run.start && now <= run.end) || null;

function lapsesAt(mode, changedAt) {
  const tonight = runs.find((run) => run.end > changedAt && run.start < changedAt + OVERRIDE_HOURS * HOUR);
  if (tonight) return tonight.end;
  return changedAt + (mode === 'live' ? REHEARSAL_HOURS : OVERRIDE_HOURS) * HOUR;
}

function metresBetween([lng1, lat1], [lng2, lat2]) {
  const rad = Math.PI / 180;
  const x = (lng2 - lng1) * rad * Math.cos(((lat1 + lat2) / 2) * rad);
  const y = (lat2 - lat1) * rad;
  return Math.hypot(x, y) * 6371000;
}

/** True once the vehicle is back at the firehouse near the end of tonight's run. */
export function isHome(location, now) {
  const run = activeRun(now);
  return Boolean(
    run &&
      location &&
      now >= run.finish - HOME_BEFORE_FINISH &&
      metresBetween([location.lng, location.lat], schedule.firehouse) < HOME_METRES
  );
}

/**
 * Remembers that tonight's run has finished, so the vehicle stays hidden
 * even if it leaves the firehouse again before tracking would have ended.
 */
export async function markFinished(store, now) {
  const run = activeRun(now);
  if (run) await store.setJSON(FINISHED_KEY, { run: run.id });
}

async function finishedTonight(store, now) {
  const run = activeRun(now);
  if (!run) return false;
  const saved = await store.get(FINISHED_KEY, { type: 'json' });
  return saved?.run === run.id;
}

export async function readMode(store, now) {
  const saved = await store.get(MODE_KEY, { type: 'json' });
  if (!saved || !MODES.includes(saved.mode) || saved.mode === 'auto') {
    return { mode: 'auto', until: null, changedBy: saved?.changedBy || null, changedAt: saved?.changedAt || null };
  }
  const until = lapsesAt(saved.mode, saved.changedAt);
  if (now >= until) return { mode: 'auto', until: null, changedBy: null, changedAt: null };
  return { mode: saved.mode, until, changedBy: saved.changedBy || null, changedAt: saved.changedAt };
}

export async function writeMode(store, mode, now, changedBy) {
  await store.setJSON(MODE_KEY, { mode, changedAt: now, changedBy });
}

/**
 * What the public page is told: "live", "paused", "off", or "done" once
 * Santa is back at the firehouse for the night.
 */
export async function publicStatus(store, mode, now) {
  if (mode !== 'auto') return mode;
  if (!activeRun(now)) return 'off';
  return (await finishedTonight(store, now)) ? 'done' : 'live';
}

export class NotCrewError extends Error {}

const GOOGLE_KEYS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/**
 * Checks a Google sign-in token and returns who it belongs to.
 *
 * The token must be signed by Google, issued for this site's sign-in client,
 * unexpired, and belong to an account in the crew's Google Workspace.
 * Throws NotCrewError for a genuine Google account outside the Workspace,
 * and jose's own errors for anything forged, expired or meant for another site.
 */
export async function verifyCrewToken(token, { clientId, domain, keys = GOOGLE_KEYS }) {
  const { payload } = await jwtVerify(token, keys, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: clientId,
    algorithms: ['RS256'],
  });
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  if (payload.hd !== domain || payload.email_verified !== true || !email.endsWith(`@${domain}`)) {
    throw new NotCrewError(`${email || 'account'} is not in ${domain}`);
  }
  return { email };
}

export function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}
