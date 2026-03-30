import { NextResponse } from 'next/server';

/**
 * GET /api/places?q=<query>
 *
 * Server-side proxy – browser calls this route, which calls Google APIs
 * from the server (no CORS blocks). Chain:
 *   1. Google Places Text Search  (best results – needs Places API enabled)
 *   2. Google Geocoding API        (fallback if Places API not enabled)
 *   3. Nominatim (OpenStreetMap)   (free fallback, no key needed)
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const q = query.trim();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const debug = { apiKey: apiKey ? 'present' : 'missing', placesStatus: null, geocodingStatus: null };

  if (apiKey) {
    // 1. Google Places Text Search (finds restaurants, landmarks, businesses, etc.)
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${apiKey}`
      );
      const data = await res.json();
      debug.placesStatus = data.status;
      debug.placesError = data.error_message || null;

      if (data.status === 'OK' && data.results?.length) {
        const results = data.results.slice(0, 6).map((place) => ({
          place_name: place.formatted_address || place.name,
          name: place.name || (place.formatted_address || '').split(',')[0],
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          address: place.formatted_address || place.name,
          type: place.types?.[0] || '',
          place_id: place.place_id || null,
          place_rank: 0,
          source: 'google_places',
        }));
        return NextResponse.json({ results, _debug: debug });
      }
    } catch (err) {
      debug.placesStatus = 'FETCH_ERROR';
      debug.placesError = err.message;
    }

    // 2. Google Geocoding API fallback (works even if Places API is not enabled)
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${apiKey}`
      );
      const data = await res.json();
      debug.geocodingStatus = data.status;
      debug.geocodingError = data.error_message || null;

      if (data.status === 'OK' && data.results?.length) {
        const results = data.results.slice(0, 6).map((place) => ({
          place_name: place.formatted_address,
          name: place.address_components?.[0]?.short_name || place.formatted_address.split(',')[0],
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          address: place.formatted_address,
          type: place.types?.[0] || '',
          place_id: place.place_id || null,
          place_rank: 0,
          source: 'google_geocoding',
        }));
        return NextResponse.json({ results, _debug: debug });
      }
    } catch (err) {
      debug.geocodingStatus = 'FETCH_ERROR';
      debug.geocodingError = err.message;
    }
  }

  // 3. Nominatim (OpenStreetMap) – free, no key required
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&addressdetails=1`,
      { headers: { 'User-Agent': 'MuktodharaClubApp/1.0 (PlaceSearch)' } }
    );
    const data = await res.json();
    debug.nominatimCount = Array.isArray(data) ? data.length : 0;

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ results: [], _debug: debug });
    }

    const results = data.map((place) => ({
      place_name: place.display_name,
      name: place.display_name.split(',')[0],
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
      address: place.display_name,
      type: place.type || '',
      osm_id: place.osm_id,
      place_id: null,
      place_rank: place.place_rank || 0,
      source: 'nominatim',
    }));

    return NextResponse.json({ results, _debug: debug });
  } catch (err) {
    return NextResponse.json({ results: [], _debug: debug, error: err.message }, { status: 500 });
  }
}
