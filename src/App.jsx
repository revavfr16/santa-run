import { useEffect, useMemo, useRef, useState } from 'react';
import Card from './components/Card';
import MapView from './components/MapView';
import { FIREHOUSE } from './config';
import { METRES_PER_MILE, buildRoute, distance, lineCoordinates, passes, sliceTo } from './lib/geo';
import { describeNights, loadPin, locate, savePin } from './lib/pin';
import { roadAt } from './lib/roads';
import { ROUTES_FINAL, RUNS, formatShortDay, getPhase } from './lib/schedule';
import { buildPlan } from './lib/timing';
import { demoNow, getDemo, useProgress, useSanta } from './lib/useSanta';

const demo = getDemo();
const MINUTE = 60000;
const WIDE = '(min-width: 860px)';

function useRoutes() {
  const [routes, setRoutes] = useState({});
  useEffect(() => {
    RUNS.forEach(async (run) => {
      try {
        const response = await fetch(run.route);
        const route = buildRoute(lineCoordinates(await response.json()));
        if (route.coords.length > 1) setRoutes((loaded) => ({ ...loaded, [run.id]: route }));
      } catch (error) {
        console.error(`Could not load the route for ${run.id}:`, error);
      }
    });
  }, []);
  return routes;
}

function useNow() {
  const [now, setNow] = useState(() => (demo ? demoNow(demo) : new Date()));
  useEffect(() => {
    if (demo) return undefined;
    const timer = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Road names for the spots where Santa passes the pin. */
function useRoads(nights) {
  const [roads, setRoads] = useState({});
  const keys = nights.map((night) => night.point.join(',')).join('|');
  useEffect(() => {
    nights.forEach((night) => {
      const key = night.point.join(',');
      roadAt(night.point).then((road) => {
        if (road) setRoads((known) => (known[key] ? known : { ...known, [key]: road }));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  return nights.map((night) => ({ ...night, road: roads[night.point.join(',')] || null }));
}

/** How much of the map the card and the top bar cover, so the camera can avoid them. */
function useInset(cardRef) {
  const [inset, setInset] = useState({ top: 56, bottom: 0, left: 0 });
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return undefined;
    const wide = window.matchMedia(WIDE);
    const measure = () => {
      // An opened card covers the map anyway; keep framing for the closed one.
      if (!wide.matches && card.classList.contains('is-open')) return;
      const next = wide.matches
        ? { top: 56, bottom: 0, left: Math.round(card.offsetWidth) + 16 }
        : { top: ROUTES_FINAL ? 56 : 88, bottom: Math.round(card.offsetHeight), left: 0 };
      setInset((old) =>
        old.top === next.top && old.bottom === next.bottom && old.left === next.left ? old : next
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    wide.addEventListener('change', measure);
    measure();
    return () => {
      observer.disconnect();
      wide.removeEventListener('change', measure);
    };
  }, [cardRef]);
  return inset;
}

export default function App() {
  const clock = useNow();
  const routes = useRoutes();
  const plans = useMemo(
    () => Object.fromEntries(RUNS.filter((r) => routes[r.id]).map((r) => [r.id, buildPlan(routes[r.id], r)])),
    [routes]
  );
  const server = useSanta(demo, routes[RUNS[0].id]);
  const scheduled = getPhase(clock, server.status, server.answered);
  const { run, next } = scheduled;

  // Estimates only make sense during a scheduled run, not a rehearsal drive.
  const underWay = Boolean(run) && clock >= run.startAt && clock <= run.endAt;
  const tonightRoute = underWay ? routes[run.id] : null;
  const tonightPlan = underWay ? plans[run.id] : null;
  const located = scheduled.phase === 'live' ? server.location : null;
  const santaAlong = useProgress(tonightRoute, tonightPlan, located, clock);

  // In the live demo the pretend Santa drives fast, so the clock keeps up
  // with him: always a few minutes behind plan.
  const now = useMemo(
    () =>
      demo === 'live' && tonightPlan && santaAlong != null
        ? new Date(tonightPlan.timeAt(santaAlong) + 6 * MINUTE)
        : clock,
    [clock, tonightPlan, santaAlong]
  );

  // Remember how far he got, for estimates during a break and to know when he's home.
  const farthest = useRef({ runId: null, along: 0 });
  if (underWay && santaAlong != null) farthest.current = { runId: run.id, along: santaAlong };
  const reached = farthest.current.runId === run?.id ? farthest.current.along : null;

  // Back at the firehouse near the end of the route means the night is over,
  // whatever the clock says.
  const home =
    underWay &&
    located &&
    distance([located.lng, located.lat], FIREHOUSE) < 200 &&
    ((reached ?? 0) > 0.900 * tonightRoute?.length || clock >= run.finishAt.getTime() - 30 * MINUTE);
  const phase = home ? 'done' : scheduled.phase;
  const santa = home ? null : located;

  const [pin, setPin] = useState(loadPin);
  const [asking, setAsking] = useState(null); // null | 'locating' | 'picking'
  const [note, setNote] = useState(null);
  const [chosenRunId, setChosenRunId] = useState(null);
  const [follow, setFollow] = useState(true);
  const [roadName, setRoadName] = useState(null);
  const cardRef = useRef(null);
  const inset = useInset(cardRef);

  const viewRunId = chosenRunId || run?.id;
  const viewingTonight = underWay && viewRunId === run.id;

  const described = useMemo(() => {
    if (!pin) return [];
    const knownAlong = santaAlong ?? (phase === 'paused' ? reached : null);
    return describeNights({
      pin,
      routes,
      plans,
      now,
      live: underWay && phase !== 'done' ? { runId: run.id, santaAlong: knownAlong } : null,
      finishedRunId: phase === 'done' ? run.id : null,
    });
  }, [pin, routes, plans, now, underWay, phase, run, santaAlong, reached]);
  const nights = useRoads(described);

  const mapRoutes = useMemo(
    () => RUNS.filter((r) => routes[r.id]).map((r) => ({ id: r.id, coords: routes[r.id].coords })),
    [routes]
  );
  const drivenCoords = useMemo(
    () => (viewingTonight && santa && santaAlong != null ? sliceTo(tonightRoute, santaAlong) : []),
    [viewingTonight, santa, tonightRoute, santaAlong]
  );

  const viewed = nights.find((night) => night.id === viewRunId);
  const spot = viewed?.point || null;

  const placePin = (point) => {
    const placed = { lng: point.lng, lat: point.lat };
    setPin(placed);
    savePin(placed);
    setAsking(null);
    setNote(null);
  };

  const askWhen = async () => {
    setAsking('locating');
    setNote(null);
    try {
      const here = await locate();
      const nearest = Math.min(
        ...Object.values(routes).map((route) => passes(route, [here.lng, here.lat]).dist),
        Infinity
      );
      if (nearest > 25 * METRES_PER_MILE) {
        setNote("You're a long way from Santa's route right now.");
        setAsking('picking');
        return;
      }
      placePin(here);
    } catch {
      setNote("We couldn't get your location.");
      setAsking('picking');
    }
  };

  const viewNight = (id) => {
    setChosenRunId(id);
    setFollow(true);
  };

  return (
    <div
      className="app"
      style={{ '--card-height': `${inset.bottom}px`, '--card-width': `${inset.left}px` }}
    >
      <MapView
        routes={mapRoutes}
        viewRunId={viewRunId}
        drivenCoords={drivenCoords}
        santa={santa}
        spot={spot}
        me={pin && viewed?.distance ? pin : null}
        pinKey={pin ? `${pin.lng},${pin.lat}` : ''}
        frameSpot={viewingTonight && viewed?.state !== 'passed'}
        follow={follow && asking !== 'picking'}
        followSanta={viewRunId === run?.id}
        onUserMove={() => setFollow(false)}
        picking={asking === 'picking'}
        onPick={placePin}
        onRoadName={setRoadName}
        inset={inset}
      />

      <header className="top">
        <p className="wordmark">Reva Santa Runs</p>
        <div className="nights-toggle" role="group" aria-label="Route shown on the map">
          {RUNS.map((night) => (
            <button
              key={night.id}
              type="button"
              aria-pressed={night.id === viewRunId}
              onClick={() => viewNight(night.id)}
            >
              {formatShortDay(night.startAt)}
            </button>
          ))}
        </div>
        {!ROUTES_FINAL && <p className="notice">Routes aren't final yet</p>}
      </header>

      {!follow && asking !== 'picking' && (
        <button type="button" className="recenter" onClick={() => setFollow(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 8.500a3.500 3.500 0 1 0 0 7 3.500 3.500 0 0 0 0-7zM11 2h2v3.100a7 7 0 0 1 5.900 5.900H22v2h-3.100a7 7 0 0 1-5.900 5.900V22h-2v-3.100A7 7 0 0 1 5.100 13H2v-2h3.100A7 7 0 0 1 11 5.100zm1 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
          </svg>
          {santa && viewRunId === run?.id ? 'Find Santa' : 'Show the route'}
        </button>
      )}

      <Card
        cardRef={cardRef}
        phase={phase}
        run={run}
        next={next}
        now={now}
        santa={santa}
        roadName={roadName}
        staleFor={server.seenAt ? Date.now() - server.seenAt : 0}
        hasPin={Boolean(pin)}
        nights={nights}
        viewRunId={viewRunId}
        onViewNight={viewNight}
        asking={asking}
        note={note}
        onAsk={askWhen}
        onMove={() => {
          setNote(null);
          setAsking('picking');
        }}
        onRemove={() => {
          setPin(null);
          savePin(null);
        }}
        onCancel={() => {
          setAsking(null);
          setNote(null);
        }}
      />
    </div>
  );
}
