import { MAPBOX_TOKEN } from '../config';

const found = new Map();

/**
 * The road at a point, and the nearest other road if one is close by:
 * { name: "Reva Rd", near: "Bridle Ct" | null }, or null if it can't be read.
 *
 * Only ever called with a point on Santa's route, never with a person's own
 * location.
 */
export function roadAt([lng, lat]) {
  const key = `${lng.toFixed(5)},${lat.toFixed(5)}`;
  if (!found.has(key)) found.set(key, lookUp(lng, lat).catch(() => null));
  return found.get(key);
}

async function lookUp(lng, lat) {
  const params = new URLSearchParams({
    radius: '200',
    limit: '25',
    layers: 'road',
    dedupe: 'true',
    access_token: MAPBOX_TOKEN,
  });
  const response = await fetch(
    `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng},${lat}.json?${params}`
  );
  if (!response.ok) throw new Error(`Road lookup failed: ${response.status}`);
  const data = await response.json();
  // Results come nearest first.
  const roads = (data.features || [])
    .map((feature) => ({
      name: feature.properties.name,
      kind: feature.properties.class,
      metres: feature.properties.tilequery?.distance ?? Infinity,
    }))
    .filter((road) => road.name && !['path', 'track', 'service', 'pedestrian'].includes(road.kind));

  const here = roads[0];
  if (!here || here.metres > 40) return null;
  const other = roads.find((road) => road.name !== here.name);
  return { name: here.name, near: other ? other.name : null };
}
