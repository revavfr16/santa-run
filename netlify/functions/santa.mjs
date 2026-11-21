// GET /api/santa — where is Santa right now?
//
//   { status: "off",    location: null }   nothing to show
//   { status: "paused", location: null }   crew has paused tracking
//   { status: "done",   location: null }   back at the firehouse for the night
//   { status: "live",   location: { lat, lng, updatedAt } | null }
//
// Only Santa's vehicle is ever returned, and only while tracking is on.
// Tracking follows src/schedule.json unless the crew has used the switch
// at /crew. If the switch can't be read, nothing is shown.
//
// Environment variables:
//   FD_TOKEN      First Due API token (required)
//   FD_DEVICE_ID  First Due device id of Santa's vehicle (default below)

import { isHome, json, markFinished, openStore, publicStatus, readMode } from '../lib/control.mjs';

const FIRST_DUE_URL = 'https://sizeup.firstduesizeup.com/fd-api/v1/device-locations';
const DEFAULT_DEVICE_ID = 822633;
const FRESH_SECONDS = 10;

// Reused while the function instance stays warm, so a crowd of phones
// turns into at most one First Due request every FRESH_SECONDS.
let cached = { at: 0, location: null };

const cacheFor = (seconds) => ({
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Netlify-CDN-Cache-Control': `public, max-age=${seconds}, must-revalidate`,
});

async function fetchSantaLocation() {
  const deviceId = Number(process.env.FD_DEVICE_ID || DEFAULT_DEVICE_ID);
  const response = await fetch(FIRST_DUE_URL, {
    headers: {
      Authorization: `Bearer ${process.env.FD_TOKEN}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`First Due responded ${response.status}`);
  }
  const devices = await response.json();
  const device = Array.isArray(devices)
    ? devices.find((d) => Number(d.id) === deviceId)
    : null;
  if (!device || !device.latitude || !device.longitude) {
    console.warn(`Device ${deviceId} not found or has no position`);
    return null;
  }
  return {
    lat: Number(device.latitude),
    lng: Number(device.longitude),
    updatedAt: device.updated_at || null,
  };
}

export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' });

  const now = Date.now();
  const store = openStore();
  let mode;
  let status;
  try {
    ({ mode } = await readMode(store, now));
    status = await publicStatus(store, mode, now);
  } catch (error) {
    console.error('Could not read the tracking switch:', error);
    return json(503, { error: 'Tracker is unavailable' });
  }

  if (status !== 'live') return json(200, { status, location: null }, cacheFor(FRESH_SECONDS));

  if (!process.env.FD_TOKEN) {
    console.error('FD_TOKEN is not set');
    return json(500, { error: 'Tracker is not configured' });
  }

  try {
    if (now - cached.at > FRESH_SECONDS * 1000) {
      cached = { at: now, location: await fetchSantaLocation() };
    }
  } catch (error) {
    console.error('Could not fetch Santa location:', error);
    return json(502, { error: 'Could not reach the vehicle tracker' });
  }

  // On a scheduled night the run ends when the vehicle is home. "Track now"
  // from the crew keeps showing it regardless.
  if (mode === 'auto' && isHome(cached.location, now)) {
    try {
      await markFinished(store, now);
    } catch (error) {
      console.error('Could not record the end of the run:', error);
    }
    return json(200, { status: 'done', location: null }, cacheFor(FRESH_SECONDS));
  }
  return json(200, { status: 'live', location: cached.location }, cacheFor(FRESH_SECONDS));
};

export const config = { path: '/api/santa' };
