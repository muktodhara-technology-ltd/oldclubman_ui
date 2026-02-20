import React, { useState, useEffect, useRef } from 'react';
import { FaCloudSun, FaSun, FaCloud, FaCloudRain, FaSnowflake, FaBolt, FaSmog } from 'react-icons/fa';
import { useSelector } from 'react-redux';

const Weather = () => {
    const { profile } = useSelector((state) => state.settings ? state.settings : { profile: null });
    const [weatherData, setWeatherData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [unit, setUnit] = useState('C'); // 'C' or 'F'
    const weatherFetched = useRef(false);

    useEffect(() => {
        // Update time every minute
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        // Wait till profile is loaded or at least attempted
        // But to not hang forever if profile is null but no fetch happens, we just check if it has client data or if it's empty
        // Usually profile is populated quickly by parent components.
        // We will attempt weather fetch once when profile.client exists or after a timeout.

        let timeoutId;

        const fetchWeather = async (lat, lon) => {
            try {
                // Using Open-Meteo API (Free, no key required)
                const response = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&daily=sunrise,sunset&timezone=auto`
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch weather data');
                }

                const data = await response.json();

                // Get location name using reverse geocoding (OpenStreetMap Nominatim - Free)
                const locationResponse = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
                );
                const locationData = await locationResponse.json();

                // Extract city/area name
                const city = locationData.address.city ||
                    locationData.address.town ||
                    locationData.address.village ||
                    locationData.address.suburb ||
                    locationData.address.county ||
                    "Unknown Location";

                // Try to get state code from state_code or ISO3166-2-lvl4 (e.g. "US-NY" -> "NY")
                const stateShort = locationData.address.state_code ||
                    (locationData.address["ISO3166-2-lvl4"] ? locationData.address["ISO3166-2-lvl4"].split('-').pop() : "") ||
                    "";

                const locationName = stateShort ? `${city}, ${stateShort.toUpperCase()}` : city;

                setWeatherData({
                    temp: Math.round(data.current.temperature_2m),
                    humidity: data.current.relative_humidity_2m,
                    wind: data.current.wind_speed_10m,
                    precipitation: data.current.precipitation,
                    weatherCode: data.current.weather_code,
                    location: locationName,
                    isDay: data.current.is_day !== 0
                });
                setLoading(false);
            } catch (err) {
                console.error("Weather fetch error:", err);
                setError("Unable to load weather");
                setLoading(false);
            }
        };

        const fetchIpLocation = async () => {
            try {
                // Using ipwho.is which has friendly CORS policies for client-side usage
                const response = await fetch('https://ipwho.is/');
                if (!response.ok) throw new Error('IP Location failed');
                const data = await response.json();

                if (data.success === false) {
                    throw new Error(data.message || 'IP lookup failed');
                }

                fetchWeather(data.latitude, data.longitude);
            } catch (err) {
                console.error("IP Geolocation error:", err);
                // Default to New York only if both methods fail
                fetchWeather(40.7128, -74.0060);
            }
        };

        const getLocation = () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        fetchWeather(position.coords.latitude, position.coords.longitude);
                    },
                    (err) => {
                        console.warn("Geolocation permission denied or error:", err);
                        fetchIpLocation();
                    },
                    { timeout: 10000 }
                );
            } else {
                fetchIpLocation();
            }
        };

        const fetchWeatherByCity = async (cityName) => {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=1`);
                const data = await response.json();
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);
                    fetchWeather(lat, lon);
                } else {
                    console.warn("City not found for user profile location");
                    getLocation();
                }
            } catch (err) {
                console.error("Geocoding error for profile location:", err);
                getLocation();
            }
        };

        const startFetching = () => {
            if (weatherFetched.current) return;
            weatherFetched.current = true;

            const currentCity = profile?.client?.currentstate?.name || profile?.client?.fromcity?.name;

            if (currentCity) {
                fetchWeatherByCity(currentCity);
            } else {
                getLocation();
            }
        };

        // If profile client exists, start immediately
        if (profile?.client) {
            startFetching();
        } else {
            // Otherwise give redex 1 second to fetch profile, if not just proceed
            if (!weatherFetched.current) {
                timeoutId = setTimeout(() => {
                    startFetching();
                }, 1000);
            }
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [profile]);

    // Helper to get icon based on WMO weather code from Open-Meteo
    const getWeatherIcon = (code) => {
        // 0: Clear sky
        if (code === 0) return <FaSun className="text-yellow-500 w-16 h-16 drop-shadow-md" />;
        // 1, 2, 3: Mainly clear, partly cloudy, and overcast
        if (code >= 1 && code <= 3) return <FaCloudSun className="text-blue-400 w-16 h-16 drop-shadow-md" />;
        // 45, 48: Fog
        if (code === 45 || code === 48) return <FaSmog className="text-gray-400 w-16 h-16 drop-shadow-md" />;
        // 51-67: Drizzle and Rain
        if (code >= 51 && code <= 67) return <FaCloudRain className="text-blue-600 w-16 h-16 drop-shadow-md" />;
        // 71-77: Snow
        if (code >= 71 && code <= 77) return <FaSnowflake className="text-blue-300 w-16 h-16 drop-shadow-md" />;
        // 80-82: Rain showers
        if (code >= 80 && code <= 82) return <FaCloudRain className="text-blue-600 w-16 h-16 drop-shadow-md" />;
        // 85-86: Snow showers
        if (code >= 85 && code <= 86) return <FaSnowflake className="text-blue-300 w-16 h-16 drop-shadow-md" />;
        // 95-99: Thunderstorm
        if (code >= 95 && code <= 99) return <FaBolt className="text-yellow-600 w-16 h-16 drop-shadow-md" />;

        return <FaCloudSun className="text-blue-500 w-16 h-16 drop-shadow-md" />;
    };

    // Format Date: "February 01, 2026 | Sunday | 07:48PM"
    const formatDate = (date) => {
        const optionsDate = { month: 'long', day: '2-digit', year: 'numeric' };
        const optionsDay = { weekday: 'long' };
        const optionsTime = { hour: '2-digit', minute: '2-digit', hour12: true };

        const dateStr = date.toLocaleDateString('en-US', optionsDate);
        const dayStr = date.toLocaleDateString('en-US', optionsDay);
        const timeStr = date.toLocaleTimeString('en-US', optionsTime);

        // Remove space from time if needed (e.g. 07:48 PM -> 07:48PM) or keep as is
        return `${dateStr} | ${dayStr} | ${timeStr}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center mt-1">
                <div className="bg-white rounded-lg border border-gray-300 p-6 w-full shadow-sm animate-pulse min-h-[200px] flex items-center justify-center">
                    <span className="text-gray-400">Loading Weather...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center mt-1">
                <div className="bg-white rounded-lg border border-gray-300 p-6 w-full shadow-sm min-h-[200px] flex items-center justify-center">
                    <span className="text-red-400">{error}</span>
                </div>
            </div>
        );
    }

    // Calculate temperature based on unit
    const displayTemp = unit === 'C'
        ? weatherData.temp
        : Math.round((weatherData.temp * 9 / 5) + 32);

    return (
        <div className="flex items-center justify-center mt-1">
            <div className="bg-white rounded-lg border border-gray-300 p-6 w-full shadow-sm">
                <div className="flex items-center border rounded-xl p-2 border-gray-200 justify-between mb-2 px-4">
                    {/* Left: Icon & Temp */}
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            {getWeatherIcon(weatherData.weatherCode)}
                        </div>
                        <div className="flex items-start leading-none">
                            <span className="text-[5rem] font-normal text-gray-800 -tracking-wide">
                                {displayTemp}
                            </span>
                            <div className="flex items-center text-xl text-gray-500 mt-3 font-light gap-2 ml-2">
                                <span
                                    className={`font-medium cursor-pointer ${unit === 'C' ? 'text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
                                    onClick={() => setUnit('C')}
                                >
                                    °C
                                </span>
                                <span className="text-gray-300">|</span>
                                <span
                                    className={`font-medium cursor-pointer ${unit === 'F' ? 'text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
                                    onClick={() => setUnit('F')}
                                >
                                    °F
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Stats */}
                    <div className="text-sm font-medium text-gray-500 space-y-1 min-w-max">
                        <div>Precipitation: {weatherData.precipitation}%</div>
                        <div>Humidity: {weatherData.humidity}%</div>
                        <div>Wind: {weatherData.wind} km/h</div>
                    </div>
                </div>

                {/* Bottom: Location & Date */}
                <div className="text-center mt-2 space-y-1">
                    <h2 className="font-serif text-xl font-bold text-black tracking-wide">
                        {weatherData.location}
                    </h2>
                    <p className="text-base font-bold text-gray-800">
                        {formatDate(currentTime)}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Weather;