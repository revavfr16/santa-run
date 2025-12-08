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
