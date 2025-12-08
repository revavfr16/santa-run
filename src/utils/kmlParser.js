import { kml } from '@tmcw/togeojson';

/**
 * Parse KML file and extract coordinates
 * @param {string} kmlText - KML file content as text
 * @returns {Array} Array of [lat, lng] coordinates
 */
export function parseKML(kmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
  const geojson = kml(xmlDoc);

  const coordinates = [];

  if (geojson.features && geojson.features.length > 0) {
    geojson.features.forEach(feature => {
      if (feature.geometry && feature.geometry.coordinates) {
        if (feature.geometry.type === 'LineString') {
          feature.geometry.coordinates.forEach(coord => {
            // GeoJSON coordinates are [lng, lat], we need [lat, lng] for Leaflet
            coordinates.push([coord[1], coord[0]]);
          });
        }
      }
    });
  }

  return coordinates;
}

/**
 * Parse GeoJSON file and extract coordinates
 * @param {Object} geojsonData - GeoJSON object
 * @returns {Array} Array of [lat, lng] coordinates
 */
export function parseGeoJSON(geojsonData) {
  const coordinates = [];

  if (geojsonData.features && geojsonData.features.length > 0) {
    geojsonData.features.forEach(feature => {
      if (feature.geometry) {
        // Handle GeometryCollection
        if (feature.geometry.type === 'GeometryCollection') {
          feature.geometry.geometries.forEach(geom => {
            if (geom.type === 'LineString' && geom.coordinates) {
              geom.coordinates.forEach(coord => {
                // GeoJSON coordinates are [lng, lat, elevation], we need [lat, lng]
                coordinates.push([coord[1], coord[0]]);
              });
            }
          });
        }
        // Handle direct LineString
        else if (feature.geometry.type === 'LineString' && feature.geometry.coordinates) {
          feature.geometry.coordinates.forEach(coord => {
            // GeoJSON coordinates are [lng, lat, elevation], we need [lat, lng]
            coordinates.push([coord[1], coord[0]]);
          });
        }
      }
    });
  }

  return coordinates;
}

/**
 * Load and parse KML file from URL
 * @param {string} url - URL to KML file
 * @returns {Promise<Array>} Array of [lat, lng] coordinates
 */
export async function loadKMLRoute(url) {
  try {
    const response = await fetch(url);
    const kmlText = await response.text();
    return parseKML(kmlText);
  } catch (error) {
    console.error('Error loading KML route:', error);
    return [];
  }
}

/**
 * Load and parse GeoJSON file from URL
 * @param {string} url - URL to GeoJSON file
 * @returns {Promise<Array>} Array of [lat, lng] coordinates
 */
export async function loadGeoJSONRoute(url) {
  try {
    const response = await fetch(url);
    const geojsonData = await response.json();
    return parseGeoJSON(geojsonData);
  } catch (error) {
    console.error('Error loading GeoJSON route:', error);
    return [];
  }
}

/**
 * Load and parse route file from URL (auto-detects KML or GeoJSON)
 * @param {string} url - URL to route file
 * @returns {Promise<Array>} Array of [lat, lng] coordinates
 */
export async function loadRoute(url) {
  // Check file extension to determine type
  if (url.toLowerCase().endsWith('.geojson') || url.toLowerCase().endsWith('.json')) {
    return loadGeoJSONRoute(url);
  } else {
    return loadKMLRoute(url);
  }
}
