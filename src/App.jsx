import { useEffect, useState, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { loadRoute } from "./utils/kmlParser";
import { fetchDeviceLocations, findDeviceById } from "./utils/api";
import { isWithinTrackingHours } from "./utils/timeWindow";
import {
  DEVICE_ID,
  UPDATE_INTERVAL,
  CENTER_POSITION,
  DEFAULT_ZOOM,
  ROUTES,
  MAPBOX_TOKEN,
  MAPBOX_STYLE,
} from "./config";

// Set Mapbox access token
mapboxgl.accessToken = MAPBOX_TOKEN;

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const santaMarker = useRef(null);
  const firehouseMarker = useRef(null);
  const routeSources = useRef({});

  const [routes, setRoutes] = useState([]);
  const [santaLocation, setSantaLocation] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);
  const [visibleRoutes, setVisibleRoutes] = useState({});
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isCenteredOnSanta, setIsCenteredOnSanta] = useState(true);

  // Dev mode is automatically enabled in development environment
  const isDev = import.meta.env.DEV;
  const [devModeOverride, setDevModeOverride] = useState(false);
  const devMode = isDev || devModeOverride;
  
  // Dev toggle to simulate off-hours (for styling)
  const [simulateOffHours, setSimulateOffHours] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initialize map
  useEffect(() => {
    if (map.current) return; // Initialize map only once

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAPBOX_STYLE,
      center: [CENTER_POSITION[1], CENTER_POSITION[0]], // Mapbox uses [lng, lat]
      zoom: DEFAULT_ZOOM,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-left");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Load routes (KML or GeoJSON)
  useEffect(() => {
    const loadRoutes = async () => {
      try {
        const loadedRoutes = await Promise.all(
          ROUTES.map(async (route) => ({
            name: route.name,
            coordinates: await loadRoute(route.file),
            color: route.color,
          }))
        );
        setRoutes(loadedRoutes);

        // Initialize all routes as visible
        const initialVisibility = {};
        loadedRoutes.forEach((route) => {
          initialVisibility[route.name] = true;
        });
        setVisibleRoutes(initialVisibility);
      } catch (err) {
        console.error("Error loading routes:", err);
        setError("Failed to load routes");
      }
    };

    loadRoutes();
  }, []);

  // Add routes to map when they're loaded
  useEffect(() => {
    if (!map.current || !mapLoaded || routes.length === 0) return;

    routes.forEach((route) => {
      const sourceId = `route-${route.name}`;
      const layerId = `route-layer-${route.name}`;

      // Check if source already exists
      if (!map.current.getSource(sourceId)) {
        // Convert coordinates from [lat, lng] to [lng, lat] for Mapbox
        const coordinates = route.coordinates.map((coord) => [
          coord[1],
          coord[0],
        ]);

        map.current.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: { name: route.name },
            geometry: {
              type: "LineString",
              coordinates: coordinates,
            },
          },
        });

        map.current.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": route.color,
            "line-width": 4,
            "line-opacity": 0.7,
          },
        });

        routeSources.current[route.name] = { sourceId, layerId };
      }
    });
  }, [routes, mapLoaded]);

  // Update route visibility
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    Object.keys(visibleRoutes).forEach((routeName) => {
      const routeInfo = routeSources.current[routeName];
      if (routeInfo) {
        const visibility = visibleRoutes[routeName] ? "visible" : "none";
        if (map.current.getLayer(routeInfo.layerId)) {
          map.current.setLayoutProperty(
            routeInfo.layerId,
            "visibility",
            visibility
          );
        }
      }
    });
  }, [visibleRoutes, mapLoaded]);

  // Fetch Santa's location
  const updateSantaLocation = async () => {
    // In dev mode, simulateOffHours can override tracking
    if (devMode && simulateOffHours) {
      setIsTracking(false);
      return;
    }
    
    if (!devMode && !isWithinTrackingHours()) {
      setIsTracking(false);
      return;
    }

    try {
      setIsTracking(true);
      const locations = await fetchDeviceLocations();
      const device = findDeviceById(locations, DEVICE_ID);

      if (device && device.latitude && device.longitude) {
        setSantaLocation({
          lat: device.latitude,
          lng: device.longitude,
          status: device.status_code,
          type: device.type,
          name: device.name,
          updatedAt: device.updated_at,
        });
        setLastUpdate(new Date());
        setError(null);
      } else {
        setError(`Device ID ${DEVICE_ID} not found or has no location`);
      }
    } catch (err) {
      console.error("Error fetching Santa location:", err);
      setError("Failed to fetch Santa location");
    }
  };

  // Update Santa marker on map
  useEffect(() => {
    if (!map.current || !santaLocation) return;

    const lngLat = [santaLocation.lng, santaLocation.lat];

    // Create custom marker element
    const el = document.createElement("div");
    el.className = "santa-marker";
    el.innerHTML = `
      <div style="position: relative; display: inline-block; width: 60px; height: 60px;">
        <div style="font-size: 40px; line-height: 1;">🚒</div>
        <div style="position: absolute; top: 0px; left: 4px; font-size: 24px;">🎅</div>
      </div>
    `;

    if (santaMarker.current) {
      santaMarker.current.setLngLat(lngLat);
    } else {
      santaMarker.current = new mapboxgl.Marker({ element: el })
        .setLngLat(lngLat)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding: 12px; text-align: center;">
                <div style="font-size: 32px; margin-bottom: 8px;">🎅</div>
                <h3 style="font-weight: bold; color: #dc2626; font-size: 16px; margin: 0;">Santa is here!</h3>
                <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">
                </p>
              </div>
            `)
        )
        .addTo(map.current);
    }

    // Auto-follow Santa only if we're already centered on them
    if (isCenteredOnSanta && map.current) {
      map.current.flyTo({
        center: lngLat,
        duration: 1000,
      });
    }
  }, [santaLocation, isCenteredOnSanta, lastUpdate]);

  // Set up polling for Santa's location
  useEffect(() => {
    // Initial fetch
    updateSantaLocation();

    // Set up interval
    const interval = setInterval(updateSantaLocation, UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [devMode, simulateOffHours]);

  // Toggle route visibility
  const toggleRoute = (routeName) => {
    setVisibleRoutes((prev) => ({
      ...prev,
      [routeName]: !prev[routeName],
    }));
  };

  // Center map on Santa
  const centerOnSanta = () => {
    if (map.current && santaLocation) {
      setIsCenteredOnSanta(true);
      map.current.flyTo({
        center: [santaLocation.lng, santaLocation.lat],
        zoom: DEFAULT_ZOOM,
        duration: 1000,
      });
    }
  };

  // Share or copy URL to clipboard
  const shareOrCopy = async () => {
    const shareText = `Following RevaVFR Santa Run at ${window.location.href}`;
    const shareData = {
      title: 'RevaVFR Santa Run Tracker',
      text: 'Following RevaVFR Santa Run',
      url: window.location.href,
    };

    // Try Web Share API first (native share menu on mobile/desktop)
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        // Share was successful
        return;
      } catch (err) {
        // User cancelled or share failed, fall through to copy
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    }

    // Fallback to copy-to-clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareText;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  // Track when user moves away from Santa
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const checkIfCentered = () => {
      if (!santaLocation) return;
      
      const center = map.current.getCenter();
      const santaLng = santaLocation.lng;
      const santaLat = santaLocation.lat;
      
      // Check if map center is within ~0.005 degrees of Santa (~500m)
      const threshold = 0.005;
      const isNearSanta = 
        Math.abs(center.lng - santaLng) < threshold &&
        Math.abs(center.lat - santaLat) < threshold;
      
      setIsCenteredOnSanta(isNearSanta);
    };

    map.current.on("moveend", checkIfCentered);
    
    return () => {
      if (map.current) {
        map.current.off("moveend", checkIfCentered);
      }
    };
  }, [mapLoaded, santaLocation]);

  // Show firehouse marker during off-hours
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const firehouseLngLat = [CENTER_POSITION[1], CENTER_POSITION[0]];

    if (!isTracking) {
      // Remove Santa marker if it exists
      if (santaMarker.current) {
        santaMarker.current.remove();
        santaMarker.current = null;
      }

      // Create firehouse marker if it doesn't exist
      if (!firehouseMarker.current) {
        const el = document.createElement("div");
        el.className = "firehouse-marker";
        el.innerHTML = `<div style="font-size: 40px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🏠</div>`;

        firehouseMarker.current = new mapboxgl.Marker({ element: el })
          .setLngLat(firehouseLngLat)
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding: 16px; text-align: center; min-width: 220px;">
                <div style="font-size: 36px; margin-bottom: 8px;">🚒🏠</div>
                <h3 style="font-weight: bold; color: #dc2626; font-size: 16px; margin: 0 0 4px 0;">
                  Santa Tracking Schedule:
                </h3>
                </p>
                <p style="font-size: 13px; color: #6b7280; margin: 0;">
                  📅 Dec 12 & Dec 19<br/>
                  🕔 Starting at 5:00 PM
                </p>
              </div>
            `)
          )
          .addTo(map.current);
        
        // Open popup by default
        firehouseMarker.current.togglePopup();
      }

      // Center map on firehouse
      map.current.flyTo({
        center: firehouseLngLat,
        zoom: DEFAULT_ZOOM,
        duration: 1000,
      });
    } else {
      // Remove firehouse marker when tracking starts
      if (firehouseMarker.current) {
        firehouseMarker.current.remove();
        firehouseMarker.current = null;
      }
    }
  }, [isTracking, mapLoaded]);

  return (
    <div className="relative h-screen w-full">
      <div ref={mapContainer} className="mapboxgl-map" />

      {/* Find Santa button - positioned below nav controls, hidden when centered */}
      {santaLocation && !isCenteredOnSanta && (
        <button
          onClick={centerOnSanta}
          className="absolute top-32 left-2.5 z-10 w-[29px] h-[29px] bg-white rounded shadow flex items-center justify-center text-base hover:bg-gray-100 active:bg-gray-200"
          title="Find Santa"
        >
          🎅
        </button>
      )}

      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-3/4 md:w-auto md:left-auto md:right-6 md:translate-x-0 bg-red-500/95 backdrop-blur-sm rounded-xl shadow-xl p-3 md:px-6 md:py-4 z-10">
        {/* Mobile: compact title */}
        <h1 className="md:hidden text-lg font-bold text-white text-center">
          🎅 Reva VFR Santa Run
        </h1>

        {/* Desktop: full title */}
        <h1 className="hidden md:block text-xl font-bold text-white space-nowrap">
          🎅 Reva Volunteer Fire & Rescue Santa Tracker
        </h1>
      </div>

      {/* Bottom panel - routes & sharing */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-4 w-[85vw] max-w-xs">
        {/* Route toggles */}
        <div className="mb-3">
          <div className="flex gap-2">
            {routes.map((route) => (
              <button
                key={route.name}
                onClick={() => toggleRoute(route.name)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  visibleRoutes[route.name]
                    ? "text-white shadow-sm"
                    : "bg-gray-200 text-gray-500"
                }`}
                style={visibleRoutes[route.name] ? { backgroundColor: route.color } : {}}
              >
                {route.name}
              </button>
            ))}
          </div>
        </div>

        {/* Social sharing */}
        <div className="border-t border-gray-200 pt-3">
          <div className="flex gap-2">
            {/* X/Twitter */}
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("🎅 Tracking Santa with RevaVFR! #SantaRun #RevaVFR")}&url=${encodeURIComponent(window.location.href)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center p-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              title="Share on X"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            {/* Facebook */}
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent("🎅 Tracking Santa with Reva VFR! #SantaRun")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Share on Facebook"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            {/* Instagram */}
            <a
              href="https://www.instagram.com/revavolunteerfirerescue16/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center p-2.5 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white rounded-lg hover:opacity-90 transition-opacity"
              title="Follow @RevaVFR on Instagram"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </a>
            {/* Share / Copy Link */}
            <button
              onClick={shareOrCopy}
              className={`flex-1 flex items-center justify-center p-2.5 rounded-lg transition-colors ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
              title={copied ? 'Copied!' : navigator.share ? 'Share link' : 'Copy link to clipboard'}
            >
              {copied ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
                </svg>
              )}
            </button>
          </div>
          {/* Donate */}
          <a
            href="https://www.zeffy.com/en-US/embed/donation-form/donate-to-help-us-help-you"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 w-full flex items-center justify-center gap-2 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
            title="Donate to Reva VFR"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            Donate
          </a>
        </div>

        {/* Dev mode toggle */}
        {isDev && (
          <div className="border-t border-gray-200 pt-3 mt-3">
            <button
              onClick={() => setSimulateOffHours(!simulateOffHours)}
              className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                simulateOffHours
                  ? "bg-gray-600 text-white hover:bg-gray-700"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              {simulateOffHours ? "📴 Off Hours" : "🟢 Tracking"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
