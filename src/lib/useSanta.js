import { useEffect, useRef, useState } from 'react';
import { IDLE_POLL_MS, POLL_MS } from '../config';
import { passes, pointAt, project } from './geo';
import { RUNS, isNearRun } from './schedule';

/**
 * Add ?demo=before|today|live|paused|done|over to the address to preview each
 * state without waiting for December. Nothing is fetched in a demo.
 */
export function getDemo() {
  const value = new URLSearchParams(window.location.search).get('demo');
  return ['before', 'today', 'live', 'paused', 'done', 'over'].includes(value) ? value : null;
}

export function demoNow(demo) {
  const first = RUNS[0];
  const last = RUNS[RUNS.length - 1];
  const day = 24 * 3600000;
  switch (demo) {
    case 'before':
      return new Date(first.startAt.getTime() - 3 * day);
    case 'today':
      return new Date(first.startAt.getTime() - 130 * 60000);
    case 'done':
      return new Date(first.endAt.getTime() + 20 * 60000);
    case 'over':
      return new Date(last.endAt.getTime() + 3 * day);
    default:
      return new Date(first.startAt.getTime() + 75 * 60000);
  }
}

/** Polls /api/santa. Returns { status, location, seenAt, failed, answered }. */
export function useSanta(demo, demoRoute) {
  const [state, setState] = useState({ status: 'off', location: null, seenAt: null, failed: false, answered: false });

  useEffect(() => {
    if (demo) return undefined;
    let timer;
    let stopped = false;
    let asking = false;
    let live = false;

    const poll = async () => {
      if (asking) return;
      asking = true;
      try {
        const response = await fetch('/api/santa');
        if (!response.ok) throw new Error(`Tracker responded ${response.status}`);
        const data = await response.json();
        if (stopped) return;
        live = data.status === 'live';
        setState((previous) => ({
          status: data.status,
          // Keep the last known position through a gap in the data.
          location: data.location || (data.status === 'live' ? previous.location : null),
          seenAt: data.location ? Date.now() : previous.seenAt,
          failed: false,
          answered: true,
        }));
      } catch (error) {
        console.error('Could not update Santa:', error);
        if (!stopped) setState((previous) => ({ ...previous, failed: true }));
      }
      asking = false;
      // Keep up with an early start or a rehearsal as closely as a scheduled run.
      if (!stopped) timer = setTimeout(poll, live || isNearRun(Date.now()) ? POLL_MS : IDLE_POLL_MS);
    };

    poll();
    // Phones pause timers in the background; catch up when the page comes back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer);
        poll();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [demo]);

  useEffect(() => {
    if (!demo) return undefined;
    if (demo === 'paused') {
      setState({ status: 'paused', location: null, seenAt: null, failed: false, answered: true });
      return undefined;
    }
    if (demo !== 'live' || !demoRoute) {
      setState({ status: demo === 'live' ? 'live' : 'off', location: null, seenAt: null, failed: false, answered: true });
      return undefined;
    }
    let along = demoRoute.length * 0.22;
    const step = () => {
      along = Math.min(demoRoute.length, along + 45);
      const [lng, lat] = pointAt(demoRoute, along);
      setState({ status: 'live', location: { lat, lng }, seenAt: Date.now(), failed: false, answered: true });
    };
    step();
    const timer = setInterval(step, 2000);
    return () => clearInterval(timer);
  }, [demo, demoRoute]);

  return state;
}

const TOP_SPEED = 20; // metres a second, about 45 mph

/**
 * How far along tonight's route Santa is, in metres, or null when he is off it.
 *
 * Routes double back on themselves, so "nearest point" alone is ambiguous.
 * Once we have a fix we only look a little way ahead of it; for the first fix
 * we pick the pass closest to where the plan says he should be by now.
 */
export function useProgress(route, plan, location, now) {
  const previous = useRef(null);
  const fixedAt = useRef(0);
  const lastKnown = useRef(null);
  const [along, setAlong] = useState(null);

  useEffect(() => {
    previous.current = null;
    lastKnown.current = null;
  }, [route]);

  useEffect(() => {
    if (!route || !plan || !location) {
      setAlong(null);
      return;
    }
    const point = [location.lng, location.lat];
    let next = null;

    if (previous.current != null) {
      // Only as far ahead as an engine could have driven since the last fix,
      // so a wobble in the signal can't jump him onto the road back.
      const seconds = (Date.now() - fixedAt.current) / 1000;
      const reach = Math.min(3000, Math.max(400, seconds * TOP_SPEED));
      const ahead = project(route, point, previous.current - 200, previous.current + reach);
      if (ahead && ahead.dist < 250) next = ahead.along;
    }
    if (next == null) {
      const { dist, alongs } = passes(route, point);
      if (dist < 400 && alongs.length) {
        // Coming back from a detour, he rejoins near where he left; otherwise go by the plan.
        const expected = lastKnown.current ?? plan.alongAt(now.getTime());
        next = alongs.reduce((a, b) => (Math.abs(b - expected) < Math.abs(a - expected) ? b : a));
      }
    }

    previous.current = next;
    if (next != null) {
      fixedAt.current = Date.now();
      lastKnown.current = next;
    }
    setAlong(next);
    // `now` only matters for the first fix; re-running on every tick is not needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, plan, location]);

  return along;
}
