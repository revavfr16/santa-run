# Reva VFR Santa Run

Live tracker for Reva Volunteer Fire & Rescue's Santa Run, served at
`santarun.reva16.org` from Netlify.

Neighbours see where Santa is and, after sharing their location or tapping
the map, when he should reach the spot on the route closest to them. The crew
can pause or switch tracking from their phones.

## Each year

Everything that changes from year to year is in `src/schedule.json`:

```json
{
  "routesFinal": false,
  "runs": [
    {
      "id": "sat",
      "start": "2026-12-19T16:00:00-05:00",
      "finish": "2026-12-19T21:45:00-05:00",
      "end": "2026-12-19T22:30:00-05:00",
      "route": "/routes/20251212.geojson",
      "landmarks": [
        { "name": "Reva Rd at Rt 29", "at": [-78.0954, 38.4521], "time": "17:30" }
      ]
    }
  ]
}
```

1. Set each night's times, keeping the `-05:00` Eastern offset:
   `start` is when Santa leaves the firehouse, `finish` is when he should reach
   the end of the route, and `end` is when tracking switches itself off.
2. Put the route files in `public/routes/` as GeoJSON LineStrings, drawn in the
   order Santa drives them.
3. Add landmarks if you can (see below). They are optional.
4. Set `routesFinal` to `true` once the routes are settled. Until then the page
   shows "Routes aren't final yet".
5. Check `FD_DEVICE_ID` on Netlify matches the vehicle Santa rides with.
6. Deploy, then open `/?demo=live` to see it working (see Previewing).

**The routes in the repo are last year's**, standing in until this year's are
drawn: the first on Saturday, the second on Sunday.

### Estimates and landmarks

Before a run, the page works out when Santa reaches a spot from the plan: an
even pace from `start` to `finish`. Once he is moving, every estimate shifts
by however far ahead or behind the plan he is, so a late start or a break
corrects itself.

An even pace is wrong where the engine drives at normal speed (Route 29) or
crawls (a neighbourhood loop). A landmark fixes that: a point on the route
and the clock time (24-hour, on the night of the run) Santa should be there.
The pace is then even between each pair of landmarks. To get a point's
`[longitude, latitude]`, right-click it in Google Maps and swap the two
numbers. A landmark that is off the route or out of time order is skipped
with a warning in the browser console.

## Turning tracking on and off

Tracking follows the schedule by itself. Outside a scheduled run the server
returns no location at all, so the vehicle is never visible the rest of the year.

The crew can override that at **`/crew`** by signing in with a reva16.org
Google account:

| Choice | What the public sees |
| --- | --- |
| Follow the schedule | Santa during scheduled runs, nothing otherwise |
| Pause tracking | Vehicle hidden, "Santa is taking a short break" |
| Track now | Santa immediately (rehearsal or early start) |
| Turn tracking off | Vehicle hidden, even during a scheduled run |

On a run night, tracking also stops by itself once the vehicle is back at the
firehouse within 90 minutes of the planned finish, and stays stopped even if
the vehicle goes out again. ("Track now" shows it again if that was a mistake.)

Any override lapses back to the schedule by itself, so a forgotten switch
can't leave the vehicle visible or leave next week's run turned off: at the end
of that night's run if it was set on a run night, otherwise after 2 hours for
"Track now" and 8 hours for the others. Changes reach phones within about half
a minute.

How it is protected:

- There is no password. `/crew` uses Google sign-in, and the server checks
  Google's signature on every request: the token must be for this site, be
  unexpired, and belong to a verified reva16.org Workspace account.
- Access follows the Workspace. Suspend an account there and it loses the switch.
- Each change is stored and logged with the email of the person who made it.
- The switch is stored in Netlify Blobs. If it can't be read, the server shows
  nothing instead of guessing.

### One-time Google setup

In the Google Cloud console, signed in as a reva16.org admin:

1. Create a project (or pick one) under the reva16.org organisation.
2. Google Auth Platform > Audience: choose **Internal**.
3. Google Auth Platform > Clients > Create client > **Web application**.
4. Authorised JavaScript origins: `https://santarun.reva16.org` and
   `http://localhost:3000`. No redirect URIs.
5. Copy the client id into `VITE_GOOGLE_CLIENT_ID` on Netlify and in `.env`.

## Setup

```bash
npm install
cp .env.example .env   # then fill it in
npm run dev            # http://localhost:3000
```

Environment variables (in `.env` locally, and on Netlify under
Site configuration > Environment variables):

| Name | Used by | Purpose |
| --- | --- | --- |
| `VITE_MAPBOX_TOKEN` | browser | Mapbox public token for the map and address search |
| `VITE_MAPBOX_STYLE` | browser | Optional map style; defaults to a night style |
| `FD_TOKEN` | server | First Due API token |
| `FD_DEVICE_ID` | server | First Due device id of Santa's vehicle |
| `VITE_GOOGLE_CLIENT_ID` | both | Google sign-in client id for `/crew` |

## Previewing

Add `?demo=` to the address to see a state without waiting for December:
`before`, `today`, `live`, `paused`, `done`, `over`. Nothing is fetched in a
demo; `live` drives a pretend Santa along the first night's route.

## How it fits together

- `src/schedule.json` — run nights, read by both the page and the server.
- `netlify/functions/santa.mjs` — `GET /api/santa`. Returns only Santa's
  vehicle, only while tracking is on, and asks First Due at most once every
  10 seconds however many phones are watching.
- `netlify/functions/crew.mjs` — `POST /api/crew`, the crew switch.
- `src/lib/timing.js` — the plan for a night and the arrival estimate.
- `src/lib/pin.js` — the person's pin and what the card says about it. The pin
  is kept on the phone and never sent anywhere; only the spot on the route is
  looked up for its road name (`src/lib/roads.js`).
- `src/components/` — the map, the card over it, and the crew page.
- `public/santa.svg` is Santa's marker. `public/flyer-header.jpg` and
  `public/share.jpg` are cut from the department's flyer.
