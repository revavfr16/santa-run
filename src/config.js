/**
 * Configuration for the Santa Tracker
 */

// Mapbox configuration
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbGV4YW1wbGUifQ.example';
export const MAPBOX_STYLE = import.meta.env.VITE_MAPBOX_STYLE || 'mapbox://styles/mapbox/streets-v12';

// The ID of the device to track from First Due API
export const DEVICE_ID = 822633; // Ambulance

// Update interval in milliseconds (20 seconds)
export const UPDATE_INTERVAL = 20000;

// Tracking time window (military time)
export const TRACKING_START_TIME = 1730; // 5:30 PM
export const TRACKING_END_TIME = 2200;   // 10:00 PM

// Map center coordinates (Reva VFR - 18230 Birmingham Road, Culpeper, VA 22701)
export const CENTER_POSITION = [38.45186601577171, -78.09639387355408];
export const DEFAULT_ZOOM = 13;

// Routes configuration
export const ROUTES = [
  {
    name: 'December 12',
    file: '/routes/20251212.geojson',
    color: '#FF0000'
  },
  {
    name: 'December 19',
    file: '/routes/20251219.geojson',
    color: 'green'
  }
];
