// The crew's tracking switch, shared by the public and crew functions.
//
// The switch is one small record in Netlify Blobs. Anyone can be told its
// effect; changing it needs a Google sign-in from the crew's Workspace
// (see functions/crew.mjs).

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getStore } from '@netlify/blobs';
import schedule from '../../src/schedule.json' with { type: 'json' };

// auto    follow the schedule
// live    show Santa now, whatever the schedule says
// paused  hide Santa and say he is taking a short break
// off     hide Santa and say nothing is happening
export const MODES = ['auto', 'live', 'paused', 'off'];

// Anything other than "auto" lapses by itself, so a forgotten switch can
// neither leave a vehicle visible nor leave next week's run switched off.
export const OVERRIDE_HOURS = 8;

const MODE_KEY = 'mode';

export const openStore = () => getStore({ name: 'santa-run', consistency: 'strong' });

export function runIsActive(now) {
  return schedule.runs.some(
    (run) => now >= Date.parse(run.start) && now <= Date.parse(run.end)
  );
}

export async function readMode(store, now) {
  const saved = await store.get(MODE_KEY, { type: 'json' });
  if (!saved || !MODES.includes(saved.mode) || saved.mode === 'auto') {
    return { mode: 'auto', until: null, changedBy: saved?.changedBy || null, changedAt: saved?.changedAt || null };
  }
  const until = saved.changedAt + OVERRIDE_HOURS * 3600000;
  if (now >= until) return { mode: 'auto', until: null, changedBy: null, changedAt: null };
  return { mode: saved.mode, until, changedBy: saved.changedBy || null, changedAt: saved.changedAt };
}

export async function writeMode(store, mode, now, changedBy) {
  await store.setJSON(MODE_KEY, { mode, changedAt: now, changedBy });
}

/** What the public page is told: "live", "paused" or "off". */
export function publicStatus(mode, now) {
  if (mode === 'auto') return runIsActive(now) ? 'live' : 'off';
  return mode;
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
  return { email, name: typeof payload.name === 'string' ? payload.name : email };
}

export function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}
