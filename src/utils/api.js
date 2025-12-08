/**
 * Fetch device locations from the serverless API proxy
 * @returns {Promise<Array>} Array of device location objects
 */
export async function fetchDeviceLocations() {
  try {
    const response = await fetch('/api/device-locations');

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching device locations:', error);
    throw error;
  }
}

/**
 * Find a specific device by ID from the locations array
 * @param {Array} locations - Array of device locations
 * @param {number} deviceId - ID of the device to find
 * @returns {Object|null} Device location object or null if not found
 */
export function findDeviceById(locations, deviceId) {
  return locations.find(device => device.id === deviceId) || null;
}

/**
 * Find a specific device by name from the locations array
 * @param {Array} locations - Array of device locations
 * @param {string} deviceName - Name of the device to find
 * @returns {Object|null} Device location object or null if not found
 */
export function findDeviceByName(locations, deviceName) {
  return locations.find(device => device.name === deviceName) || null;
}
