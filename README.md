# Reva VFR Santa Run Tracker

A real-time tracker for the Reva Volunteer Fire and Rescue Station's Santa Run event.

## Features

- Real-time GPS tracking of Santa's location via First Due API
- Interactive map using Leaflet.js
- Multiple predefined routes displayed on the map
- Automatic tracking during event hours (5:30 PM - 10:00 PM)
- Updates every 20 seconds
- Responsive design with Tailwind CSS

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your First Due API token:
```bash
cp .env.example .env
```

Edit `.env` and add your token:
```
FD_TOKEN=your_first_due_token_here
```

3. Run the development server:
```bash
npm run dev
```

## Deployment

This app is designed to be deployed to Netlify at `santarun.reva16.org`.

1. Install Netlify CLI (optional):
```bash
npm i -g netlify-cli
```

2. Deploy:
```bash
netlify deploy --prod
```

Or connect your repository to Netlify via the web interface.

3. Set the environment variable in Netlify:
- Go to Site settings → Environment variables
- Add `FD_TOKEN` with your First Due API token

## Configuration

### Tracked Device

The device name to track is hardcoded in [src/components/SantaMap.jsx](src/components/SantaMap.jsx#L26):

```javascript
const DEVICE_NAME = 'Car 1216 (iPad)';
```

Change this to match the device name from your First Due API.

### Routes

Routes are defined as KML files in the [public/routes/](public/routes/) directory:
- `route1.kml` - North Loop (red)
- `route2.kml` - South Loop (green)

### Tracking Hours

Tracking is active between 5:30 PM (1730) and 10:00 PM (2200). This is configured in [src/utils/timeWindow.js](src/utils/timeWindow.js).

### Update Interval

Location updates every 20 seconds. This is configured in [src/components/SantaMap.jsx](src/components/SantaMap.jsx#L27):

```javascript
const UPDATE_INTERVAL = 20000; // 20 seconds
```

## Architecture

- **Frontend**: React + Vite + Tailwind CSS
- **Map**: Leaflet.js with OpenStreetMap tiles
- **API Proxy**: Serverless function at `/api/device-locations` to handle CORS
- **Routes**: KML files parsed to GeoJSON for display

## API Endpoints

### GET /api/device-locations

Netlify serverless function that proxies requests to the First Due API to fetch device locations.

**Response**: Array of device location objects from First Due API.

**Local Development**: When running `npm run dev`, this endpoint is available at `http://localhost:8888/api/device-locations`

## License

ISC
