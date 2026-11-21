// POST /api/crew — the crew's tracking switch.
//
//   {}          report the current mode
//   { mode }    set the mode: auto | live | paused | off
//
// Every request must carry a Google sign-in token for an account in the
// crew's Google Workspace:  Authorization: Bearer <token>
// The token is checked against Google's public keys on every request; there is
// no password or shared secret to leak. Each change is recorded with the
// email of the person who made it.
//
// Environment variables:
//   VITE_GOOGLE_CLIENT_ID  the site's Google sign-in client id (not a secret)
//   CREW_DOMAIN            Workspace domain allowed to use the switch

import {
  MODES,
  NotCrewError,
  json,
  openStore,
  publicStatus,
  readMode,
  verifyCrewToken,
  writeMode,
} from '../lib/control.mjs';

const DEFAULT_DOMAIN = 'reva16.org';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return json(503, { error: 'Crew sign-in is not set up' });
  const domain = process.env.CREW_DOMAIN || DEFAULT_DOMAIN;

  const [scheme, token] = (req.headers.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return json(401, { error: 'Sign in to continue' });

  let who;
  try {
    who = await verifyCrewToken(token, { clientId, domain });
  } catch (error) {
    if (error instanceof NotCrewError) {
      console.warn(`Refused: ${error.message}`);
      return json(403, { error: `Use your ${domain} account` });
    }
    return json(401, { error: 'Sign in again to continue' });
  }

  let body = {};
  try {
    body = (await req.json()) || {};
  } catch {
    return json(400, { error: 'Expected JSON' });
  }

  const now = Date.now();
  const store = openStore();

  if (body.mode !== undefined) {
    if (!MODES.includes(body.mode)) return json(400, { error: 'Unknown mode' });
    await writeMode(store, body.mode, now, who.email);
    console.log(`Tracking switch set to ${body.mode} by ${who.email}`);
  }

  const current = await readMode(store, now);
  return json(200, { ...current, publicStatus: publicStatus(current.mode, now), you: who.email });
};

export const config = { path: '/api/crew' };
