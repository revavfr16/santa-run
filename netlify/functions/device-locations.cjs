exports.handler = async function(event, context) {
  
  const hideLocations = process.env.HIDE_LOCATIONS === 'true';

  if (hideLocations) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations: [] }),
    };
  }

  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const FD_TOKEN = process.env.FD_TOKEN;

    if (!FD_TOKEN) {
      console.error('FD_TOKEN not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'FD_TOKEN not configured' }),
      };
    }

    console.log('Fetching device locations from First Due API...');
    const response = await fetch('https://sizeup.firstduesizeup.com/fd-api/v1/device-locations', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${FD_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('First Due API request failed:', response.status);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: 'First Due API request failed',
          status: response.status
        }),
      };
    }

    const data = await response.json();
    console.log(`✓ Fetched ${data.length} device locations`);

    // Log the device we're looking for
    const targetDevice = data.find(d => d.id === 822633);
    if (targetDevice) {
      console.log(`✓ Found device 822633: ${targetDevice.name} at [${targetDevice.latitude}, ${targetDevice.longitude}]`);
    } else {
      console.log('⚠ Device 822633 not found in response');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Error fetching device locations:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
