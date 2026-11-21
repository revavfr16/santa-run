import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { FIREHOUSE, MAPBOX_STYLE, MAPBOX_TOKEN } from '../config';
import { bounds } from '../lib/geo';

mapboxgl.accessToken = MAPBOX_TOKEN;

const LIGHTS = '#FFD95A';
const MARGIN = 56;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lineFeature = (coordinates) => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates },
});

function pin(className, html, title) {
  const el = document.createElement('div');
  el.className = className;
  el.innerHTML = html;
  if (title) el.title = title;
  return el;
}

const STATION_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.200 2.800 9v11.300h3.400v-7.100h11.600v7.100h3.400V9zM8 15v1.600h8V15zm0 3.200v2.100h8v-2.100z"/></svg>';
const PIN_ICON =
  '<svg viewBox="0 0 32 42" aria-hidden="true"><path class="pin-drop" d="M16 1.500C7.900 1.500 1.500 7.800 1.500 15.700c0 10.300 12 22.600 13.700 24.300a1.100 1.100 0 0 0 1.600 0c1.700-1.700 13.700-14 13.700-24.300C30.500 7.800 24.100 1.500 16 1.500z"/><circle class="pin-eye" cx="16" cy="15.500" r="5.500"/></svg>';

/**
 * The map. It draws what it is given and reports what the person does;
 * all decisions live in App.
 */
export default function MapView({
  routes, // [{ id, coords }]
  viewRunId, // the night whose route is drawn
  drivenCoords, // where Santa has been tonight, when tonight's route is drawn
  santa, // { lng, lat } | null
  spot, // [lng, lat] | null — the pin, on the drawn route
  me, // { lng, lat } | null — where the person is, when that is some way from the pin
  pinKey, // changes whenever the person places or moves their pin
  frameSpot, // keep the pin in view along with Santa
  follow,
  followSanta, // while following, stay with Santa rather than framing the route
  onUserMove,
  picking,
  onPick,
  onRoadName,
  inset, // { top, bottom, left } — parts of the map hidden behind the card
}) {
  const container = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const lastLng = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(!MAPBOX_TOKEN);

  // Callbacks change every render; the map's listeners read the latest ones.
  const handlers = useRef({});
  handlers.current = { onUserMove, onPick, onRoadName, picking };

  useEffect(() => {
    if (!MAPBOX_TOKEN) return undefined;
    const instance = new mapboxgl.Map({
      container: container.current,
      style: MAPBOX_STYLE,
      center: FIREHOUSE,
      zoom: 11.500,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.current = instance;
    instance.touchZoomRotate.disableRotation();
    instance.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    // Routes and pins only need the style, not the first batch of map tiles.
    instance.on('style.load', () => {
      // The night style ships live traffic colouring, which competes with the route.
      instance.getStyle().layers.forEach((layer) => {
        if (/traffic|incident/.test(`${layer.source} ${layer.id}`)) {
          instance.setLayoutProperty(layer.id, 'visibility', 'none');
        }
      });
      setReady(true);
    });
    // Say the map can't load only while nothing has loaded. One refused tile
    // among many good ones is not worth a message.
    let tilesLoaded = false;
    instance.on('error', (event) => {
      // 401: bad token. 403: the token isn't allowed on this web address.
      if (!tilesLoaded && [401, 403].includes(event.error?.status)) setFailed(true);
    });
    instance.on('data', (event) => {
      if (event.dataType === 'source' && event.tile && !tilesLoaded) {
        tilesLoaded = true;
        setFailed(false);
      }
    });
    const resizer = new ResizeObserver(() => instance.resize());
    resizer.observe(container.current);

    instance.on('dragstart', () => handlers.current.onUserMove?.());
    instance.on('zoomstart', (event) => {
      if (event.originalEvent) handlers.current.onUserMove?.();
    });
    instance.on('click', (event) => {
      if (handlers.current.picking) {
        handlers.current.onPick?.({ lng: event.lngLat.lng, lat: event.lngLat.lat });
      }
    });

    markers.current.firehouse = new mapboxgl.Marker({
      element: pin('pin pin-firehouse', STATION_ICON, 'Reva Volunteer Fire & Rescue'),
    })
      .setLngLat(FIREHOUSE)
      .addTo(instance);

    return () => {
      resizer.disconnect();
      instance.remove();
      map.current = null;
      markers.current = {};
    };
  }, []);

  // Each night's route is a string of lights, with a solid glow where Santa has been.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    if (!instance.getSource('driven')) {
      instance.addSource('driven', { type: 'geojson', data: lineFeature([]) });
      instance.addLayer({
        id: 'driven-glow',
        type: 'line',
        source: 'driven',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': LIGHTS, 'line-width': 14, 'line-blur': 10, 'line-opacity': 0.500 },
      });
      instance.addLayer({
        id: 'driven',
        type: 'line',
        source: 'driven',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FFFFFF', 'line-width': 3.500 },
      });
    }
    routes.forEach((route) => {
      const id = `route-${route.id}`;
      if (!instance.getSource(id)) {
        instance.addSource(id, { type: 'geojson', data: lineFeature(route.coords) });
        instance.addLayer(
          {
            id,
            type: 'line',
            source: id,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': LIGHTS, 'line-width': 5, 'line-dasharray': [0, 2] },
          },
          'driven-glow'
        );
      }
      instance.setLayoutProperty(id, 'visibility', route.id === viewRunId ? 'visible' : 'none');
    });
  }, [ready, routes, viewRunId]);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    instance.getSource('driven')?.setData(lineFeature(drivenCoords || []));
  }, [ready, drivenCoords]);

  // Santa's marker. He faces the way he is heading.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    if (!santa) {
      markers.current.santa?.remove();
      markers.current.santa = null;
      lastLng.current = null;
      return;
    }
    const lngLat = [santa.lng, santa.lat];
    if (!markers.current.santa) {
      markers.current.santa = new mapboxgl.Marker({
        element: pin('pin pin-santa', '<img src="/santa.svg" alt="Santa" />'),
        anchor: 'bottom',
        offset: [0, 8],
      })
        .setLngLat(lngLat)
        .addTo(instance);
    } else {
      markers.current.santa.setLngLat(lngLat);
    }
    if (lastLng.current != null && Math.abs(santa.lng - lastLng.current) > 0.000050) {
      markers.current.santa.getElement().classList.toggle('pin-santa-west', santa.lng < lastLng.current);
    }
    lastLng.current = santa.lng;
  }, [ready, santa]);

  // The camera. While following, it keeps Santa in view (with the pin, if
  // he hasn't reached it yet); with no Santa it frames the whole route.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !follow) return;
    const padding = {
      top: inset.top + MARGIN,
      bottom: inset.bottom + MARGIN,
      left: inset.left + MARGIN,
      right: MARGIN,
    };
    const duration = reducedMotion() ? 0 : 900;
    if (santa && followSanta) {
      const at = [santa.lng, santa.lat];
      const box = new mapboxgl.LngLatBounds(at, at);
      if (spot && frameSpot) box.extend(spot);
      instance.fitBounds(box, { padding, maxZoom: 14.500, duration });
      return;
    }
    const route = routes.find((r) => r.id === viewRunId);
    if (route) instance.fitBounds(bounds(route.coords), { padding, duration });
  }, [ready, follow, followSanta, santa, spot, frameSpot, routes, viewRunId, inset.top, inset.bottom, inset.left]);

  // The road Santa is on, read from the map's own road data.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !santa) return undefined;
    const read = () => {
      const { x, y } = instance.project([santa.lng, santa.lat]);
      const road = instance
        .queryRenderedFeatures([
          [x - 10, y - 10],
          [x + 10, y + 10],
        ])
        .find((feature) => feature.sourceLayer === 'road' && feature.properties?.name);
      if (road) handlers.current.onRoadName?.(road.properties.name);
    };
    instance.once('idle', read);
    return () => instance.off('idle', read);
  }, [ready, santa]);

  // The person's pin, which they can also drag along to a better spot.
  const spotKey = spot ? spot.join(',') : '';
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    if (!spot) {
      markers.current.spot?.remove();
      markers.current.spot = null;
      return;
    }
    if (!markers.current.spot) {
      const marker = new mapboxgl.Marker({
        element: pin('pin pin-spot', PIN_ICON, 'Your pin'),
        anchor: 'bottom',
        draggable: true,
      })
        .setLngLat(spot)
        .addTo(instance);
      marker.on('dragend', () => {
        const { lng, lat } = marker.getLngLat();
        handlers.current.onPick?.({ lng, lat });
      });
      markers.current.spot = marker;
    } else {
      markers.current.spot.setLngLat(spot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, spotKey]);

  // Where the person is, when that isn't on the route itself. A fresh pin
  // is brought into view unless the camera is already following Santa.
  const meKey = me ? `${me.lng},${me.lat}` : '';
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    markers.current.me?.remove();
    markers.current.me = null;
    if (me) {
      markers.current.me = new mapboxgl.Marker({ element: pin('pin pin-me', '', 'You') })
        .setLngLat([me.lng, me.lat])
        .addTo(instance);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, meKey]);

  const previousPin = useRef(pinKey);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || previousPin.current === pinKey) return;
    previousPin.current = pinKey;
    if (!spot || (santa && follow && followSanta)) return;
    const box = new mapboxgl.LngLatBounds(spot, spot);
    if (me) box.extend([me.lng, me.lat]);
    handlers.current.onUserMove?.();
    instance.fitBounds(box, {
      padding: {
        top: inset.top + MARGIN * 2,
        bottom: inset.bottom + MARGIN * 2,
        left: inset.left + MARGIN * 2,
        right: MARGIN * 2,
      },
      maxZoom: 14,
      duration: reducedMotion() ? 0 : 900,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pinKey]);

  return (
    <div className={`map${picking ? ' map-picking' : ''}`}>
      <div ref={container} className="map-canvas" />
      {failed && <p className="map-message">The map can't load right now. Santa's status below is still up to date.</p>}
    </div>
  );
}
