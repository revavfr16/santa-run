import { passes } from './geo';

/**
 * The plan for one night: when Santa should be at each distance along the route.
 *
 * It is a handful of fixed points — the start, any landmarks from
 * schedule.json, and the finish — with an even pace between each pair.
 * Landmarks are what make it right on a fast stretch of highway or a slow
 * neighbourhood loop; without any, the whole night is one even pace.
 *
 * Where the route passes a landmark twice, its time belongs to the first
 * pass after the previous landmark.
 */
export function buildPlan(route, run) {
  const finish = run.finishAt.getTime();
  const points = [{ along: 0, time: run.startAt.getTime() }];

  [...run.landmarks]
    .sort((a, b) => a.timeAt - b.timeAt)
    .forEach((mark) => {
      const last = points[points.length - 1];
      const time = mark.timeAt.getTime();
      const { dist, alongs } = passes(route, mark.at);
      const along = alongs.find((a) => a > last.along && a < route.length);
      if (dist > 500 || along === undefined || time <= last.time || time >= finish) {
        console.warn(`Skipping landmark "${mark.name}" on ${run.id}: it is off the route or out of order.`);
        return;
      }
      points.push({ along, time });
    });

  points.push({ along: route.length, time: finish });

  const between = (value, from, to) => {
    for (let i = 1; i < points.length; i++) {
      if (value <= points[i][from] || i === points.length - 1) {
        const a = points[i - 1];
        const b = points[i];
        const t = (value - a[from]) / (b[from] - a[from] || 1);
        return a[to] + Math.max(0, Math.min(1, t)) * (b[to] - a[to]);
      }
    }
    return points[0][to];
  };

  return {
    /** Planned time (ms) at a distance along the route. */
    timeAt: (along) => between(along, 'along', 'time'),
    /** Planned distance along the route at a time (ms). */
    alongAt: (time) => between(time, 'time', 'along'),
  };
}

/**
 * When Santa should reach a point, in ms.
 *
 * Once we know where he is, the plan only supplies how long the stretch
 * between him and the point takes, so a late start or a break moves every
 * estimate by itself.
 */
export function arrival(plan, along, { now, santaAlong }) {
  if (santaAlong == null) return plan.timeAt(along);
  return now + (plan.timeAt(along) - plan.timeAt(santaAlong));
}
