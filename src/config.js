// Run dates, times, landmarks, route files and the firehouse live in
// schedule.json, which the server functions read too. Everything else is here.
import schedule from './schedule.json';

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

// A night style, because most of the run happens after dark on phones held
// outdoors. Road names rely on a style built on Mapbox Streets.
export const MAPBOX_STYLE =
  import.meta.env.VITE_MAPBOX_STYLE || 'mapbox://styles/mapbox/navigation-night-v1';

// Reva VFR, 18230 Birmingham Road, Culpeper, VA 22701 — [lng, lat]
export const FIREHOUSE = schedule.firehouse;

// How often a phone asks where Santa is.
export const POLL_MS = 15000;
// Outside a run, check occasionally so a rehearsal drive still shows up.
export const IDLE_POLL_MS = 5 * 60 * 1000;

export const DONATE_URL =
  'https://www.zeffy.com/en-US/embed/donation-form/donate-to-help-us-help-you';
export const INSTAGRAM_URL = 'https://www.instagram.com/revavolunteerfirerescue16/';

// Crew sign-in at /crew. The client id is public; access is enforced on the server.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const CREW_DOMAIN = 'reva16.org';
