// Small route geometry helpers. Points are [lng, lat]; distances are metres.

const EARTH_M = 6371000;
const RAD = Math.PI / 180;
export const METRES_PER_MILE = 1609.344;

export function distance(a, b) {
  const dLat = (b[1] - a[1]) * RAD;
  const dLng = (b[0] - a[0]) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

/** Pull every LineString out of a GeoJSON document, in order, as one path. */
export function lineCoordinates(geojson) {
  const coords = [];
  const visit = (geometry) => {
    if (!geometry) return;
    if (geometry.type === 'LineString') {
      geometry.coordinates.forEach((c) => coords.push([c[0], c[1]]));
    } else if (geometry.type === 'MultiLineString') {
      geometry.coordinates.forEach((line) => line.forEach((c) => coords.push([c[0], c[1]])));
    } else if (geometry.type === 'GeometryCollection') {
      geometry.geometries.forEach(visit);
    }
  };
  (geojson.features || []).forEach((feature) => visit(feature.geometry));
  return coords;
}

/** A route is its coordinates plus the distance travelled at each one. */
export function buildRoute(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + distance(coords[i - 1], coords[i]));
  }
  return { coords, cum, length: cum[cum.length - 1] || 0 };
}

function projectOnSegment(p, a, b) {
  // Flat-earth approximation around p; fine at these distances.
  const kx = Math.cos(p[1] * RAD) * EARTH_M * RAD;
  const ky = EARTH_M * RAD;
  const ax = (a[0] - p[0]) * kx;
  const ay = (a[1] - p[1]) * ky;
  const dx = (b[0] - a[0]) * kx;
  const dy = (b[1] - a[1]) * ky;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? -(ax * dx + ay * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { t, dist: Math.hypot(ax + t * dx, ay + t * dy) };
}

function projections(route, p, from = -Infinity, to = Infinity) {
  const out = [];
  const { coords, cum } = route;
  for (let i = 0; i < coords.length - 1; i++) {
    if (cum[i + 1] < from || cum[i] > to) continue;
    const { t, dist } = projectOnSegment(p, coords[i], coords[i + 1]);
    out.push({ dist, along: cum[i] + t * (cum[i + 1] - cum[i]) });
  }
  return out;
}

/** Closest point on the route to p, optionally only between two distances along it. */
export function project(route, p, from, to) {
  let best = null;
  for (const hit of projections(route, p, from, to)) {
    if (!best || hit.dist < best.dist) best = hit;
  }
  return best;
}

/**
 * Every separate time the route comes close to p. A route that goes out and
 * back along the same road passes a driveway twice; this returns both.
 */
export function passes(route, p, slack = 60, gap = 300) {
  const all = projections(route, p);
  if (!all.length) return { dist: Infinity, alongs: [] };
  const min = Math.min(...all.map((hit) => hit.dist));
  const near = all.filter((hit) => hit.dist <= min + slack);
  const alongs = [];
  let group = null;
  for (const hit of near) {
    if (group && hit.along - group.last > gap) {
      alongs.push(group.best.along);
      group = null;
    }
    if (!group) group = { best: hit, last: hit.along };
    if (hit.dist < group.best.dist) group.best = hit;
    group.last = hit.along;
  }
  if (group) alongs.push(group.best.along);
  return { dist: min, alongs };
}

export function pointAt(route, along) {
  const { coords, cum } = route;
  if (!coords.length) return null;
  if (along <= 0) return coords[0];
  if (along >= route.length) return coords[coords.length - 1];
  let i = 1;
  while (cum[i] < along) i++;
  const t = (along - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  const a = coords[i - 1];
  const b = coords[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** The part of the route from its start up to a distance along it. */
export function sliceTo(route, along) {
  const { coords, cum } = route;
  if (along <= 0 || !coords.length) return [];
  const out = [];
  for (let i = 0; i < coords.length && cum[i] <= along; i++) out.push(coords[i]);
  if (along < route.length) out.push(pointAt(route, along));
  return out;
}

export function bounds(coords) {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [lng, lat] of coords) {
    w = Math.min(w, lng);
    e = Math.max(e, lng);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  return [
    [w, s],
    [e, n],
  ];
}
