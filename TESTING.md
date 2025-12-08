# Testing Guide

## Local Development Testing

### Testing Without Real API

To test the app without the First Due API during development, you can:

1. **Mock the API response** by creating a local override in [src/utils/api.js](src/utils/api.js)

2. **Bypass time restrictions** temporarily by modifying [src/utils/timeWindow.js](src/utils/timeWindow.js):

```javascript
export function isWithinTrackingHours() {
  return true; // Always return true for testing
}
```

### Testing Time Windows

To test the time window functionality without waiting:

```javascript
// In src/utils/timeWindow.js - for testing only
export function isWithinTrackingHours() {
  // Force to always be in tracking window for testing
  return true;

  // Or force to always be outside tracking window
  // return false;
}
```

Remember to revert these changes before deployment!

## Testing the Serverless Function Locally

### Using Vercel Dev Server

```bash
# Install Vercel CLI globally
npm i -g vercel

# Create .env file with your token
echo "FD_TOKEN=your_token_here" > .env

# Run Vercel development server
vercel dev
```

This will start a local server at `http://localhost:3000` and your API will be available at:
```
http://localhost:3000/api/device-locations
```

### Testing the API Directly

```bash
# Test with curl (set FD_TOKEN in your environment first)
curl --request GET \
  --header "Authorization: Bearer ${FD_TOKEN}" \
  --header "accept: application/json" \
  --url "https://sizeup.firstduesizeup.com/fd-api/v1/device-locations" | jq -r

# Or test just the device names
curl --request GET \
  --header "Authorization: Bearer ${FD_TOKEN}" \
  --header "accept: application/json" \
  --url "https://sizeup.firstduesizeup.com/fd-api/v1/device-locations" | jq -r '.[].name'
```

## Pre-Deployment Checklist

- [ ] Set correct `DEVICE_NAME` in [src/config.js](src/config.js)
- [ ] Verify tracking time window is correct (1730-2200)
- [ ] Test KML routes display correctly
- [ ] Confirm `FD_TOKEN` environment variable is set in Vercel
- [ ] Verify custom domain `santarun.reva16.org` is configured
- [ ] Test on mobile devices (responsive design)
- [ ] Check browser console for any errors
- [ ] Verify map tiles load correctly
- [ ] Test outside tracking hours (should show "Outside Tracking Hours")
- [ ] Test during tracking hours (should show "Tracking Active")

## Common Issues During Development

### Leaflet CSS Not Loading
- Ensure `@import 'leaflet/dist/leaflet.css';` is at the top of [src/index.css](src/index.css)

### Marker Icons Missing
- The app uses CDN for marker icons, check your internet connection
- Icons are loaded from: `https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/`

### KML Files Not Found
- KML files must be in [public/routes/](public/routes/)
- Reference them with `/routes/filename.kml` (leading slash is important)

### CORS Errors
- Make sure you're using the serverless function at `/api/device-locations`
- Don't call the First Due API directly from the frontend

## Browser Testing

Test on these browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile Safari (iOS)
- Chrome Mobile (Android)

## Performance Testing

Monitor:
- Network requests every 20 seconds
- Memory usage over time (check for leaks)
- Map rendering performance
- Initial page load time

## Event Day Testing

1. **One Day Before**: Test the full system end-to-end
2. **Event Day (Early)**: Verify tracking at 5:25 PM (before window opens)
3. **Event Day (5:30 PM)**: Confirm tracking starts automatically
4. **During Event**: Monitor for any errors or issues
5. **After 10:00 PM**: Verify tracking stops

## Monitoring During Event

Watch for:
- Device location updates every 20 seconds
- Correct device being tracked
- Map updates smoothly
- No console errors
- Responsive on mobile devices
