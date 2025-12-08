# Deployment Guide

## Quick Start

### 1. Set Environment Variable

Create a `.env` file for local development:

```bash
cp .env.example .env
# Edit .env and add your FD_TOKEN
```

For production deployment, set the environment variable in Netlify dashboard.

### 2. Deploy to Netlify

#### Option A: Using Netlify CLI

```bash
# Install Netlify CLI (if not already installed)
npm i -g netlify-cli

# Login to Netlify
netlify login

# Initialize site (first time only)
netlify init

# Deploy to production
netlify deploy --prod
```

#### Option B: Using Git Integration (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [Netlify](https://app.netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Connect your repository
5. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
6. Add environment variable:
   - Go to Site settings → Environment variables
   - Add `FD_TOKEN` with your First Due API token
7. Deploy!

### 3. Configure Custom Domain

In Netlify dashboard:
- Go to Site settings → Domain management
- Click "Add custom domain"
- Add `santarun.reva16.org`
- Configure DNS as instructed by Netlify

## Local Development

The app uses Netlify Dev to run both the Vite dev server and serverless functions locally:

```bash
# Install dependencies
npm install

# Create .env file with your FD_TOKEN
cp .env.example .env

# Run local development server
npm run dev
```

This will start:
- Vite dev server on port 5173
- Netlify Dev proxy on port 8888 (with functions support)
- Your app will be available at `http://localhost:8888`
- API endpoint: `http://localhost:8888/api/device-locations`

## Configuration

All configuration is centralized in [src/config.js](src/config.js):

### Device Name
```javascript
export const DEVICE_NAME = 'Car 1216 (iPad)';
```

### Tracking Hours
```javascript
export const TRACKING_START_TIME = 1730; // 5:30 PM
export const TRACKING_END_TIME = 2200;   // 10:00 PM
```

### Map Settings
```javascript
export const CENTER_POSITION = [38.4385, -78.0093]; // [lat, lng]
export const DEFAULT_ZOOM = 13;
```

### Routes
```javascript
export const ROUTES = [
  {
    name: 'North Loop',
    file: '/routes/route1.kml',
    color: 'red'
  },
  {
    name: 'South Loop',
    file: '/routes/route2.kml',
    color: 'green'
  }
];
```

## Custom Routes

To add or modify routes:

1. Create a KML file (use Google My Maps or similar tool)
2. Place it in the [public/routes/](public/routes/) directory
3. Update the `ROUTES` array in [src/config.js](src/config.js)

### KML File Format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Route Name</name>
    <Placemark>
      <LineString>
        <coordinates>
          lng1,lat1,0
          lng2,lat2,0
          lng3,lat3,0
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>
```

Note: Coordinates are in `longitude,latitude,altitude` format.

## Netlify Function

The serverless function is located at [netlify/functions/device-locations.js](netlify/functions/device-locations.js).

It proxies requests to:
```
https://sizeup.firstduesizeup.com/fd-api/v1/device-locations
```

The function:
- Handles CORS automatically
- Adds the authorization header using the `FD_TOKEN` environment variable
- Returns the device locations as JSON

### Local Function Testing

When running `npm run dev`, Netlify Dev automatically serves the function at:
```
http://localhost:8888/api/device-locations
```

The `/api/*` path is redirected to `/.netlify/functions/*` via the [netlify.toml](netlify.toml) configuration.

## Build Commands

```bash
# Development (with Netlify Dev and functions)
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview
```

## Troubleshooting

### Device Not Found

If the device name doesn't match, check the API response:
```bash
curl --request GET \
  --header "Authorization: Bearer ${FD_TOKEN}" \
  --header "accept: application/json" \
  --url "https://sizeup.firstduesizeup.com/fd-api/v1/device-locations" | jq -r '.[].name'
```

Update `DEVICE_NAME` in [src/config.js](src/config.js) with the correct name.

### Routes Not Displaying

1. Verify KML files are in [public/routes/](public/routes/)
2. Check browser console for parsing errors
3. Validate KML format using a validator

### Tracking Not Active

Verify the current time is within `TRACKING_START_TIME` and `TRACKING_END_TIME` (in 24-hour format).

### Local Development Issues

If `npm run dev` doesn't work:

1. Make sure `.env` file exists with `FD_TOKEN`
2. Check that Netlify CLI is installed: `netlify --version`
3. Try clearing Netlify cache: `rm -rf .netlify`
4. Reinstall dependencies: `npm install`

### Function Not Working Locally

If the `/api/device-locations` endpoint returns 404:

1. Check [netlify.toml](netlify.toml) has the correct redirects
2. Verify function exists at [netlify/functions/device-locations.js](netlify/functions/device-locations.js)
3. Check Netlify Dev logs for errors
4. Make sure `FD_TOKEN` is set in `.env`

## Security

- Never commit the `.env` file to version control (it's in [.gitignore](.gitignore))
- Keep your First Due API token secure
- The token is only used server-side in the Netlify function
- Set environment variables in Netlify dashboard for production

## Continuous Deployment

With Git integration, Netlify will automatically deploy when you push to your repository:

1. Push to `main` branch → Production deployment
2. Push to other branches → Preview deployments
3. Pull requests → Deploy previews with unique URLs

You can configure this in Netlify dashboard under Site settings → Build & deploy.
