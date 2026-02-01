"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FaTimes, FaImage, FaGlobe, FaLock, FaCaretDown, FaChevronLeft, FaChevronRight, FaBold, FaItalic, FaUnderline, FaHeading } from 'react-icons/fa';
import { useDispatch, useSelector } from 'react-redux';
import { bindPostData, getGathering, getPosts, initialPostData, setPostModalOpen, storePost, updatePost } from '@/views/gathering/store';
import { getMyProfile, getPostBackgrounds, getUserProfile } from '@/views/settings/store';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { MdPhotoAlbum, MdPhotoLibrary } from 'react-icons/md';
import { LuMapPinCheckInside } from 'react-icons/lu';
import { getImageUrl } from '@/utility';
import { useVideoUpload } from '@/contexts/VideoUploadContext';

const PostModal = () => {
  const { profile, backgroundOptions } = useSelector(({ settings }) => settings)
  const { basicPostData, loading, isPostModalOpen } = useSelector(({ gathering }) => gathering)
  const dispatch = useDispatch();
  const { id } = basicPostData;
  const { startUpload, isUploading } = useVideoUpload();
  const [filePreviews, setFilePreviews] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPrivacyDropdown, setShowPrivacyDropdown] = useState(false);
  const fileInputRef = useRef(null);
  const messageEditorRef = useRef(null);
  const previousMessageRef = useRef(basicPostData?.message ?? '');
  const storedRichMessageRef = useRef('');
  const prevBackgroundActiveRef = useRef(false);
  const [removeFiles, setRemoveFiles] = useState([]);
  const [isShowImageSection, setIsShowImageSection] = useState(id ? true : false);
  const [selectedBackground, setSelectedBackground] = useState(/\/post_background\/.+/.test(basicPostData?.background_url) ? basicPostData?.background_url : null);
  const [backgroundScrollIndex, setBackgroundScrollIndex] = useState(0);
  const [isVisibleBg, setIsVisibleBg] = useState(true);
  const [showBackgroundOptions, setShowBackgroundOptions] = useState(false);

  // Route / Check-in state
  const [showRoute, setShowRoute] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInMode, setCheckInMode] = useState('checkin'); // 'checkin' or 'route'
  const [showLocationModal, setShowLocationModal] = useState(false); // Controls the sliding modal
  const routeMapContainerRef = useRef(null);
  const routeMapRef = useRef(null);
  const routeMarkersRef = useRef({ origin: null, destination: null, checkin: null });
  const routeLineRef = useRef(null);
  const [routeOrigin, setRouteOrigin] = useState(null); // { lat, lng }
  const [routeDestination, setRouteDestination] = useState(null); // { lat, lng }

  // Check-in state
  const [checkInLocation, setCheckInLocation] = useState(null); // { place_name, lat, lng, address }
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');
  const [placeSearchResults, setPlaceSearchResults] = useState([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [showPlaceSearch, setShowPlaceSearch] = useState(false);
  const placeSearchTimeoutRef = useRef(null);

  // Travel state (separate from check-in)
  const [travelFrom, setTravelFrom] = useState(null); // { place_name, lat, lng, address }
  const [travelTo, setTravelTo] = useState(null); // { place_name, lat, lng, address }
  const [travelFromQuery, setTravelFromQuery] = useState('');
  const [travelToQuery, setTravelToQuery] = useState('');
  const [travelFromResults, setTravelFromResults] = useState([]);
  const [travelToResults, setTravelToResults] = useState([]);
  const [isSearchingTravelFrom, setIsSearchingTravelFrom] = useState(false);
  const [isSearchingTravelTo, setIsSearchingTravelTo] = useState(false);
  const [showTravelFromSearch, setShowTravelFromSearch] = useState(false);
  const [showTravelToSearch, setShowTravelToSearch] = useState(false);
  const travelFromTimeoutRef = useRef(null);
  const travelToTimeoutRef = useRef(null);

  const params = useParams();

  const isBackgroundActive = useMemo(() => {
    if (!selectedBackground) {
      return false;
    }

    if (typeof selectedBackground === 'string') {
      return true;
    }

    return selectedBackground?.id !== 'white';
  }, [selectedBackground]);

  const visibleBackgrounds = backgroundOptions.slice(backgroundScrollIndex, backgroundScrollIndex + 8);

  const loadLeafletAssets = () => {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.L) return Promise.resolve();

    return new Promise((resolve, reject) => {
      // CSS
      const existingCss = document.querySelector('link[href*="leaflet.css"]');
      if (!existingCss) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        link.crossOrigin = '';
        document.head.appendChild(link);
      }

      // JS
      const existingJs = document.querySelector('script[src*="leaflet@1.9.4"]');
      if (existingJs) {
        existingJs.addEventListener('load', () => resolve());
        existingJs.addEventListener('error', reject);
        if (window.L) resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => resolve();
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };

  const resetRoute = () => {
    if (routeMarkersRef.current.origin && routeMapRef.current) {
      routeMapRef.current.removeLayer(routeMarkersRef.current.origin);
      routeMarkersRef.current.origin = null;
    }
    if (routeMarkersRef.current.destination && routeMapRef.current) {
      routeMapRef.current.removeLayer(routeMarkersRef.current.destination);
      routeMarkersRef.current.destination = null;
    }
    if (routeMarkersRef.current.checkin && routeMapRef.current) {
      routeMapRef.current.removeLayer(routeMarkersRef.current.checkin);
      routeMarkersRef.current.checkin = null;
    }
    if (routeMarkersRef.current.travelFrom && routeMapRef.current) {
      routeMapRef.current.removeLayer(routeMarkersRef.current.travelFrom);
      routeMarkersRef.current.travelFrom = null;
    }
    if (routeMarkersRef.current.travelTo && routeMapRef.current) {
      routeMapRef.current.removeLayer(routeMarkersRef.current.travelTo);
      routeMarkersRef.current.travelTo = null;
    }
    if (routeLineRef.current && routeMapRef.current) {
      routeMapRef.current.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    setRouteOrigin(null);
    setRouteDestination(null);
    setCheckInLocation(null);
    setTravelFrom(null);
    setTravelTo(null);
  };

  const resetCheckIn = () => {
    if (routeMarkersRef.current.checkin && routeMapRef.current) {
      routeMapRef.current.removeLayer(routeMarkersRef.current.checkin);
      routeMarkersRef.current.checkin = null;
    }
    setCheckInLocation(null);
    setPlaceSearchQuery('');
    setPlaceSearchResults([]);
  };

  // Search for places using Google Geocoding API
  const searchPlaces = async (query) => {
    if (!query || query.trim().length < 3) {
      setPlaceSearchResults([]);
      return;
    }

    setIsSearchingPlaces(true);
    try {
      const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      if (googleApiKey) {
        // Use Google Geocoding API
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${googleApiKey}&limit=5`
        );
        const data = await response.json();

        if (data.status === 'OK' && data.results) {
          const results = data.results.map((place) => ({
            place_name: place.formatted_address,
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            address: place.formatted_address,
            type: place.types[0] || '',
            place_id: place.place_id || null,
            place_rank: 0,
            name: place.address_components[0]?.short_name || place.formatted_address.split(',')[0] || ''
          }));
          setPlaceSearchResults(results);
        } else {
          console.error('Google Geocoding API error:', data.status);
          setPlaceSearchResults([]);
        }
      } else {
        // Fallback to Nominatim (OpenStreetMap)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
        );
        const data = await response.json();

        const results = data.map((place) => ({
          place_name: place.display_name,
          lat: parseFloat(place.lat),
          lng: parseFloat(place.lon),
          address: place.display_name,
          type: place.type,
          osm_id: place.osm_id
        }));

        setPlaceSearchResults(results);
      }
    } catch (error) {
      console.error('Error searching places:', error);
      setPlaceSearchResults([]);
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  // Handle place search input with debounce
  useEffect(() => {
    if (placeSearchTimeoutRef.current) {
      clearTimeout(placeSearchTimeoutRef.current);
    }

    if (placeSearchQuery.trim().length >= 3) {
      placeSearchTimeoutRef.current = setTimeout(() => {
        searchPlaces(placeSearchQuery);
      }, 500);
    } else {
      setPlaceSearchResults([]);
    }

    return () => {
      if (placeSearchTimeoutRef.current) {
        clearTimeout(placeSearchTimeoutRef.current);
      }
    };
  }, [placeSearchQuery]);

  // Search for travel from places
  const searchTravelFromPlaces = async (query) => {
    if (!query || query.trim().length < 3) {
      setTravelFromResults([]);
      return;
    }

    setIsSearchingTravelFrom(true);
    try {
      const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      if (googleApiKey) {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${googleApiKey}&limit=5`
        );
        const data = await response.json();

        if (data.status === 'OK' && data.results) {
          const results = data.results.map((place) => ({
            place_name: place.formatted_address,
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            address: place.formatted_address,
            type: place.types[0] || '',
            place_id: place.place_id || null,
            place_rank: 0,
            name: place.address_components[0]?.short_name || place.formatted_address.split(',')[0] || ''
          }));
          setTravelFromResults(results);
        } else {
          setTravelFromResults([]);
        }
      } else {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
        );
        const data = await response.json();

        const results = data.map((place) => ({
          place_name: place.display_name,
          lat: parseFloat(place.lat),
          lng: parseFloat(place.lon),
          address: place.display_name,
          type: place.type,
          osm_id: place.osm_id
        }));

        setTravelFromResults(results);
      }
    } catch (error) {
      console.error('Error searching travel from places:', error);
      setTravelFromResults([]);
    } finally {
      setIsSearchingTravelFrom(false);
    }
  };

  // Search for travel to places
  const searchTravelToPlaces = async (query) => {
    if (!query || query.trim().length < 3) {
      setTravelToResults([]);
      return;
    }

    setIsSearchingTravelTo(true);
    try {
      const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      if (googleApiKey) {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${googleApiKey}&limit=5`
        );
        const data = await response.json();

        if (data.status === 'OK' && data.results) {
          const results = data.results.map((place) => ({
            place_name: place.formatted_address,
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            address: place.formatted_address,
            type: place.types[0] || '',
            place_id: place.place_id || null,
            place_rank: 0,
            name: place.address_components[0]?.short_name || place.formatted_address.split(',')[0] || ''
          }));
          setTravelToResults(results);
        } else {
          setTravelToResults([]);
        }
      } else {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
        );
        const data = await response.json();

        const results = data.map((place) => ({
          place_name: place.display_name,
          lat: parseFloat(place.lat),
          lng: parseFloat(place.lon),
          address: place.display_name,
          type: place.type,
          osm_id: place.osm_id
        }));

        setTravelToResults(results);
      }
    } catch (error) {
      console.error('Error searching travel to places:', error);
      setTravelToResults([]);
    } finally {
      setIsSearchingTravelTo(false);
    }
  };

  // Handle travel from search with debounce
  useEffect(() => {
    if (travelFromTimeoutRef.current) {
      clearTimeout(travelFromTimeoutRef.current);
    }

    if (travelFromQuery.trim().length >= 3) {
      travelFromTimeoutRef.current = setTimeout(() => {
        searchTravelFromPlaces(travelFromQuery);
      }, 500);
    } else {
      setTravelFromResults([]);
    }

    return () => {
      if (travelFromTimeoutRef.current) {
        clearTimeout(travelFromTimeoutRef.current);
      }
    };
  }, [travelFromQuery]);

  // Handle travel to search with debounce
  useEffect(() => {
    if (travelToTimeoutRef.current) {
      clearTimeout(travelToTimeoutRef.current);
    }

    if (travelToQuery.trim().length >= 3) {
      travelToTimeoutRef.current = setTimeout(() => {
        searchTravelToPlaces(travelToQuery);
      }, 500);
    } else {
      setTravelToResults([]);
    }

    return () => {
      if (travelToTimeoutRef.current) {
        clearTimeout(travelToTimeoutRef.current);
      }
    };
  }, [travelToQuery]);

  // Close place search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showPlaceSearch && !event.target.closest('.place-search-container')) {
        setShowPlaceSearch(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPlaceSearch]);

  // Close travel search dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showTravelFromSearch && !event.target.closest('.travel-from-search-container')) {
        setShowTravelFromSearch(false);
      }
      if (showTravelToSearch && !event.target.closest('.travel-to-search-container')) {
        setShowTravelToSearch(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTravelFromSearch, showTravelToSearch]);

  // Select a place from search results
  const selectPlace = (place) => {
    if (checkInMode === 'destination') {
      setRouteDestination(place);
    } else {
      setCheckInLocation(place);
    }
    setPlaceSearchQuery(place.place_name);
    setPlaceSearchResults([]);
    setShowPlaceSearch(false);
  };

  const drawRouteLine = (from, to) => {
    if (!window.L || !routeMapRef.current) return;
    if (routeLineRef.current) {
      routeMapRef.current.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    routeLineRef.current = window.L.polyline([
      [from.lat, from.lng],
      [to.lat, to.lng]
    ], { color: '#2563eb', weight: 4, opacity: 0.7 }).addTo(routeMapRef.current);
    routeMapRef.current.fitBounds(routeLineRef.current.getBounds(), { padding: [30, 30] });
  };

  // Reset map when mode changes
  useEffect(() => {
    if (showLocationModal && routeMapRef.current) {
      try {
        routeMapRef.current.remove();
      } catch (e) {
        console.error('Error removing map:', e);
      }
      routeMapRef.current = null;

      // Clean up the container to allow re-initialization
      if (routeMapContainerRef.current) {
        routeMapContainerRef.current._leaflet_id = null;
        routeMapContainerRef.current.innerHTML = '';
      }

      resetRoute();
      resetCheckIn();
    }
  }, [checkInMode]);


  useEffect(() => {
    // Initialize map when location modal is open OR when location is selected in main modal
    const shouldShowMap = showLocationModal || (!showLocationModal && (checkInLocation || routeDestination || travelFrom || travelTo));

    if (!shouldShowMap) {
      // Clean up map when not needed
      if (routeMapRef.current) {
        try {
          routeMapRef.current.remove();
        } catch (e) {
          console.error('Error removing map:', e);
        }
        routeMapRef.current = null;
      }

      // Clean up the container
      if (routeMapContainerRef.current) {
        routeMapContainerRef.current._leaflet_id = null;
        routeMapContainerRef.current.innerHTML = '';
      }
      return;
    }

    let mapInstance = null;
    let timeoutId = null;
    let retryTimeoutId = null;

    const initMap = () => {
      const container = routeMapContainerRef.current;

      console.log('Attempting to init map...', {
        showLocationModal,
        hasContainer: !!container,
        containerWidth: container?.offsetWidth,
        containerHeight: container?.offsetHeight,
        hasMapRef: !!routeMapRef.current,
        checkInLocation,
        routeDestination
      });

      if (!container) {
        console.log('Container not found, retrying...');
        setTimeout(() => initMap(), 200);
        return;
      }

      // Check if container has dimensions
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        console.log('Container has no dimensions, retrying...');
        setTimeout(() => initMap(), 200);
        return;
      }

      // If map already exists, just update it
      if (routeMapRef.current) {
        console.log('Map already initialized, updating...');
        try {
          routeMapRef.current.invalidateSize();
        } catch (e) {
          console.error('Error invalidating map size:', e);
        }
        return;
      }

      loadLeafletAssets().then(() => {
        if (routeMapRef.current || !container) return;

        const L = window.L;
        try {
          // Clear any existing leaflet instance
          if (container._leaflet_id) {
            container._leaflet_id = null;
            container.innerHTML = '';
          }

          mapInstance = L.map(container).setView([23.8103, 90.4125], 5);

          // Use OpenStreetMap tiles (free, no API key required)
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
          }).addTo(mapInstance);

          routeMapRef.current = mapInstance;

          console.log('Map initialized successfully', {
            hasMap: !!mapInstance,
            containerSize: { width: container.offsetWidth, height: container.offsetHeight }
          });

          setTimeout(() => {
            if (mapInstance) {
              mapInstance.invalidateSize();
              console.log('Map size invalidated');
            }
          }, 100);

          // Add markers for selected locations
          if (checkInLocation) {
            const marker = L.marker([checkInLocation.lat, checkInLocation.lng], {
              icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
              })
            }).addTo(mapInstance);
            marker.bindPopup(`<b>${checkInLocation.place_name}</b>`);
            routeMarkersRef.current.checkin = marker;
          }

          if (routeDestination) {
            const marker = L.marker([routeDestination.lat, routeDestination.lng], {
              icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
              })
            }).addTo(mapInstance);
            marker.bindPopup(`<b>${routeDestination.place_name}</b>`);
            routeMarkersRef.current.destination = marker;
          }

          // Add markers for travel locations
          if (travelFrom) {
            const marker = L.marker([travelFrom.lat, travelFrom.lng], {
              icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
              })
            }).addTo(mapInstance);
            marker.bindPopup(`<b>Traveling From: ${travelFrom.place_name}</b>`);
            routeMarkersRef.current.travelFrom = marker;
          }

          if (travelTo) {
            const marker = L.marker([travelTo.lat, travelTo.lng], {
              icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
              })
            }).addTo(mapInstance);
            marker.bindPopup(`<b>Traveling To: ${travelTo.place_name}</b>`);
            routeMarkersRef.current.travelTo = marker;
          }

          // Draw route line if both locations exist
          if (checkInLocation && routeDestination) {
            drawRouteLine(checkInLocation, routeDestination);
          }

          // Draw travel route line if both travel locations exist
          if (travelFrom && travelTo) {
            if (routeLineRef.current) {
              mapInstance.removeLayer(routeLineRef.current);
            }
            routeLineRef.current = L.polyline([
              [travelFrom.lat, travelFrom.lng],
              [travelTo.lat, travelTo.lng]
            ], { color: '#8b5cf6', weight: 4, opacity: 0.7 }).addTo(mapInstance);
          }

          // Fit bounds to show all markers
          if (checkInLocation || routeDestination || travelFrom || travelTo) {
            const bounds = [];
            if (checkInLocation) bounds.push([checkInLocation.lat, checkInLocation.lng]);
            if (routeDestination) bounds.push([routeDestination.lat, routeDestination.lng]);
            if (travelFrom) bounds.push([travelFrom.lat, travelFrom.lng]);
            if (travelTo) bounds.push([travelTo.lat, travelTo.lng]);
            if (bounds.length > 0) {
              mapInstance.fitBounds(bounds, { padding: [50, 50] });
            }
          }

          // Only allow click interactions in location modal
          if (showLocationModal) {
            if (checkInMode === 'checkin' || checkInMode === 'destination' || checkInMode === 'travel') {
              mapInstance.on('click', (e) => {
                const { latlng } = e;
                const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

                if (googleApiKey) {
                  // Use Google Reverse Geocoding
                  fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latlng.lat},${latlng.lng}&key=${googleApiKey}`)
                    .then(res => res.json())
                    .then(data => {
                      if (data.status === 'OK' && data.results && data.results.length > 0) {
                        const place = {
                          place_name: data.results[0].formatted_address,
                          lat: latlng.lat,
                          lng: latlng.lng,
                          address: data.results[0].formatted_address,
                          place_id: data.results[0].place_id || null,
                          name: data.results[0].address_components[0]?.short_name || ''
                        };
                        selectPlace(place);
                      } else {
                        // Fallback if Google API fails
                        const place = {
                          place_name: `Location (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`,
                          lat: latlng.lat,
                          lng: latlng.lng,
                          address: `Location (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`
                        };
                        selectPlace(place);
                      }
                    })
                    .catch(() => {
                      // Fallback to Nominatim if Google fails
                      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`)
                        .then(res => res.json())
                        .then(data => {
                          const place = {
                            place_name: data.display_name || 'Selected Location',
                            lat: latlng.lat,
                            lng: latlng.lng,
                            address: data.display_name || 'Selected Location'
                          };
                          selectPlace(place);
                        })
                        .catch(() => {
                          const place = {
                            place_name: `Location (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`,
                            lat: latlng.lat,
                            lng: latlng.lng,
                            address: `Location (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`
                          };
                          selectPlace(place);
                        });
                    });
                } else {
                  // Use Nominatim (existing code)
                  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`)
                    .then(res => res.json())
                    .then(data => {
                      const place = {
                        place_name: data.display_name || 'Selected Location',
                        lat: latlng.lat,
                        lng: latlng.lng,
                        address: data.display_name || 'Selected Location'
                      };
                      selectPlace(place);
                    })
                    .catch(() => {
                      const place = {
                        place_name: `Location (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`,
                        lat: latlng.lat,
                        lng: latlng.lng,
                        address: `Location (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`
                      };
                      selectPlace(place);
                    });
                }
              });
            }
          }
        } catch (error) {
          console.error('Error initializing map:', error);
        }
      }).catch((error) => {
        console.error('Error loading map assets:', error);
      });
    };

    // Give the modal time to render before initializing map
    let secondRetryId = null;

    timeoutId = setTimeout(() => {
      console.log('Starting map initialization...');
      initMap();

      // Multiple retries to ensure map loads
      retryTimeoutId = setTimeout(() => {
        if (!routeMapRef.current) {
          console.log('First retry: map initialization...');
          initMap();
        }
      }, 400);

      // Second retry
      secondRetryId = setTimeout(() => {
        if (!routeMapRef.current) {
          console.log('Second retry: map initialization...');
          initMap();
        }
      }, 1000);
    }, 200);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      if (secondRetryId) clearTimeout(secondRetryId);

      const mapToRemove = routeMapRef.current || mapInstance;
      if (mapToRemove && mapToRemove._container) {
        try {
          mapToRemove.remove();
        } catch (e) {
          console.log('Map cleanup skipped (already removed)');
        }
      }

      routeMapRef.current = null;
      mapInstance = null;

      if (routeMapContainerRef.current) {
        routeMapContainerRef.current._leaflet_id = null;
        routeMapContainerRef.current.innerHTML = '';
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLocationModal, checkInMode, checkInLocation, routeDestination, travelFrom, travelTo]);

  // Force map update when location is selected
  useEffect(() => {
    if (!routeMapRef.current) return;

    const L = window.L;
    if (!L) return;

    console.log('Updating map markers...', { checkInLocation, routeDestination });

    // Update markers when location changes
    if (checkInLocation) {
      // Remove existing checkin marker
      if (routeMarkersRef.current.checkin && routeMapRef.current) {
        routeMapRef.current.removeLayer(routeMarkersRef.current.checkin);
        routeMarkersRef.current.checkin = null;
      }

      // Add new checkin marker
      if (routeMapRef.current) {
        const marker = L.marker([checkInLocation.lat, checkInLocation.lng], {
          icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })
        }).addTo(routeMapRef.current);

        marker.bindPopup(`<b>${checkInLocation.place_name}</b>`);
        if (showLocationModal) {
          marker.openPopup();
        }
        routeMarkersRef.current.checkin = marker;

        // Center map on location
        routeMapRef.current.setView([checkInLocation.lat, checkInLocation.lng], 15);
      }
    }

    if (routeDestination) {
      // Remove existing destination marker
      if (routeMarkersRef.current.destination && routeMapRef.current) {
        routeMapRef.current.removeLayer(routeMarkersRef.current.destination);
        routeMarkersRef.current.destination = null;
      }

      // Add new destination marker
      if (routeMapRef.current) {
        const marker = L.marker([routeDestination.lat, routeDestination.lng], {
          icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })
        }).addTo(routeMapRef.current);

        marker.bindPopup(`<b>${routeDestination.place_name}</b>`);
        routeMarkersRef.current.destination = marker;
      }
    }

    // Draw route line if both exist
    if (checkInLocation && routeDestination && routeMapRef.current) {
      drawRouteLine(checkInLocation, routeDestination);
    }

    // Update travel markers
    if (travelFrom) {
      if (routeMarkersRef.current.travelFrom && routeMapRef.current) {
        routeMapRef.current.removeLayer(routeMarkersRef.current.travelFrom);
        routeMarkersRef.current.travelFrom = null;
      }

      if (routeMapRef.current) {
        const marker = L.marker([travelFrom.lat, travelFrom.lng], {
          icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })
        }).addTo(routeMapRef.current);

        marker.bindPopup(`<b>Traveling From: ${travelFrom.place_name}</b>`);
        if (showLocationModal) {
          marker.openPopup();
        }
        routeMarkersRef.current.travelFrom = marker;
      }
    }

    if (travelTo) {
      if (routeMarkersRef.current.travelTo && routeMapRef.current) {
        routeMapRef.current.removeLayer(routeMarkersRef.current.travelTo);
        routeMarkersRef.current.travelTo = null;
      }

      if (routeMapRef.current) {
        const marker = L.marker([travelTo.lat, travelTo.lng], {
          icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })
        }).addTo(routeMapRef.current);

        marker.bindPopup(`<b>Traveling To: ${travelTo.place_name}</b>`);
        routeMarkersRef.current.travelTo = marker;
      }
    }

    // Draw travel route line if both exist
    if (travelFrom && travelTo && routeMapRef.current) {
      if (routeLineRef.current) {
        routeMapRef.current.removeLayer(routeLineRef.current);
      }
      routeLineRef.current = L.polyline([
        [travelFrom.lat, travelFrom.lng],
        [travelTo.lat, travelTo.lng]
      ], { color: '#8b5cf6', weight: 4, opacity: 0.7 }).addTo(routeMapRef.current);

      // Fit bounds to show both travel markers
      routeMapRef.current.fitBounds([
        [travelFrom.lat, travelFrom.lng],
        [travelTo.lat, travelTo.lng]
      ], { padding: [50, 50] });
    }
  }, [checkInLocation, routeDestination, travelFrom, travelTo, showLocationModal]);

  const handleBackgroundSelect = (background) => {
    const editor = messageEditorRef.current;
    if (!editor) return;

    // Get the current plain text content
    const plainText = getPlainTextFromHtml(editor.innerHTML || "");

    // Set the plain text content directly (don't clear the editor)
    // This preserves the text when switching between backgrounds
    editor.innerText = plainText;

    // Update Redux state
    dispatch(bindPostData({ ...basicPostData, message: plainText }));
    setSelectedBackground(background);
  };

  const handleBackgroundClear = () => {
    // Restore text when removing background
    if (messageEditorRef.current) {
      const currentPlainText = messageEditorRef.current.innerText || '';

      // Convert plain text to HTML paragraphs
      let contentToRestore;
      if (currentPlainText.trim()) {
        contentToRestore = currentPlainText.split('\n').map(line =>
          line.trim() ? `<p>${line.trim()}</p>` : '<p><br></p>'
        ).join('');
      } else {
        // If no text, restore stored content
        contentToRestore = storedRichMessageRef.current || '';
      }

      messageEditorRef.current.innerHTML = contentToRestore;
      dispatch(bindPostData({ ...basicPostData, message: contentToRestore }));
      previousMessageRef.current = contentToRestore;
      storedRichMessageRef.current = '';
    }
    setSelectedBackground(null);
  };

  const scrollBackgrounds = (direction) => {
    if (direction === 'left' && backgroundScrollIndex > 0) {
      setBackgroundScrollIndex(backgroundScrollIndex - 1);
    } else if (direction === 'right' && backgroundScrollIndex < backgroundOptions.length - 8) {
      setBackgroundScrollIndex(backgroundScrollIndex + 1);
    }
  };

  const getPlainTextLength = (html) => {
    if (!html) {
      return 0;
    }

    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .length;
  };

  const getPlainTextFromHtml = (html) => {
    if (!html) {
      return '';
    }

    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(div|p|li|tr|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/�/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
  };

  const normalizeEditorHtml = (html) => {
    if (!html) {
      return '';
    }

    const trimmed = html.trim();
    if (!trimmed) {
      return '';
    }

    const divToParagraph = trimmed
      .replace(/<div(\s|>)/gi, '<p$1')
      .replace(/<\/div>/gi, '</p>')
      .replace(/<p><\/p>/gi, '');

    const hasBlockTags = /<(p|div|ul|ol|li|blockquote|h[1-6]|pre|table|tbody|thead|tr|td|th)\b/i.test(divToParagraph);
    const hasAnyTag = /<[^>]+>/i.test(divToParagraph);

    if (!hasAnyTag || !hasBlockTags) {
      const rawSegments = divToParagraph.split(/(?:<br\s*\/?>|\r?\n)+/i);

      const paragraphs = rawSegments
        .map((segment) => {
          const content = segment.trim();

          if (!content) {
            return '<p><br></p>';
          }

          return `<p>${content}</p>`;
        });

      if (paragraphs.length === 0) {
        return '';
      }

      return paragraphs.join('');
    }

    return divToParagraph;
  };



  const plainMessageLength = useMemo(() => getPlainTextLength(basicPostData?.message), [basicPostData?.message]);


  useEffect(() => {
    dispatch(getMyProfile())
    dispatch(getPostBackgrounds())

    if (isPostModalOpen && id && basicPostData?.files?.length > 0) {
      const previews = basicPostData?.files?.map(file => ({
        id: file.id || (Date.now() + Math.random().toString(36).substring(2, 9)),
        src: getImageUrl(file.file_path, 'post'),
        file_type: file?.file_type
      }));
      setFilePreviews(previews);
    }

    return () => {
      setFilePreviews([]);
    }
  }, []);

  useEffect(() => {
    const editor = messageEditorRef.current;
    const nextHtml = basicPostData?.message ?? '';

    if (editor && editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml;
    }

    previousMessageRef.current = nextHtml;
  }, [basicPostData?.message, isPostModalOpen]);

  useEffect(() => {
    const wasBackgroundActive = prevBackgroundActiveRef.current;

    if (isBackgroundActive && !wasBackgroundActive) {
      const currentHtml = messageEditorRef.current?.innerHTML ?? basicPostData?.message ?? '';
      storedRichMessageRef.current = currentHtml;
      const plainText = getPlainTextFromHtml(currentHtml);

      if (messageEditorRef.current) {
        messageEditorRef.current.innerText = plainText;
      }

      previousMessageRef.current = plainText;

      if (basicPostData?.message !== plainText) {
        dispatch(bindPostData({ ...basicPostData, message: plainText }));
      }
    } else if (!isBackgroundActive && wasBackgroundActive) {
      const restoredHtml = storedRichMessageRef.current || basicPostData?.message || '';

      if (messageEditorRef.current) {
        messageEditorRef.current.innerHTML = restoredHtml;
      }

      previousMessageRef.current = restoredHtml;

      if (basicPostData?.message !== restoredHtml) {
        dispatch(bindPostData({ ...basicPostData, message: restoredHtml }));
      }

      storedRichMessageRef.current = '';
    }

    prevBackgroundActiveRef.current = isBackgroundActive;
  }, [basicPostData, dispatch, isBackgroundActive]);

  const handleEditorInput = () => {

    const editor = messageEditorRef.current;
    if (!editor) {
      return;
    }


    const html = editor.innerHTML;
    const plainLength = getPlainTextLength(html);

    if (selectedBackground) {
      editor.style.color = "white"
      editor.style.fontWeight = "bold"
      editor.style.fontSize = "24px"
      editor.style.textAlign = "center"
    }

    if (plainLength > 280) {
      setIsVisibleBg(false);
      setSelectedBackground(null);
      storedRichMessageRef.current = '';
    } else {
      setIsVisibleBg(true);
    }

    previousMessageRef.current = html;

    if (basicPostData?.message !== html) {
      dispatch(bindPostData({ ...basicPostData, message: html }));
    }
  };

  const handleEditorPaste = (event) => {
    event.preventDefault();

    // Check if there are files (images) in the clipboard
    const items = event.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Handle image files
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            // Add the image file to the post data
            dispatch(bindPostData({
              ...basicPostData,
              files: [...(basicPostData.files || []), file]
            }));

            // Generate preview for the pasted image
            const reader = new FileReader();
            reader.onloadend = () => {
              setFilePreviews(prev => [...prev, {
                id: Date.now() + Math.random().toString(36).substring(2, 9),
                src: reader.result,
                file: file
              }]);
            };
            reader.readAsDataURL(file);

            // Show image section when image is pasted
            setIsShowImageSection(true);

            // Show success message
            toast.success('Image pasted successfully!');
            return;
          }
        }
      }
    }

    // If no images, handle text paste
    const textData = event.clipboardData?.getData('text/plain') ?? '';

    if (typeof document !== 'undefined') {
      document.execCommand('insertText', false, textData);
    }

    handleEditorInput();
  };

  const applyTextFormatting = (command, value = null) => {
    if (isBackgroundActive) {
      return;
    }

    const editor = messageEditorRef.current;

    if (!editor || typeof document === 'undefined') {
      return;
    }

    editor.focus();
    document.execCommand(command, false, value);
    handleEditorInput();
  };

  const handleFilesChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      // Clear background when images are uploaded
      if (selectedBackground) {
        handleBackgroundClear();
      }

      dispatch(bindPostData({
        ...basicPostData,
        files: [...(basicPostData.files || []), ...selectedFiles]
      }));

      // Generate previews for the new files
      selectedFiles.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreviews(prev => [...prev, {
            id: Date.now() + Math.random().toString(36).substring(2, 9),
            src: reader.result,
            file: file
          }]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files.length > 0) {
      // Clear background when images are dropped
      if (selectedBackground) {
        handleBackgroundClear();
      }

      const droppedFiles = Array.from(e.dataTransfer.files);
      dispatch(bindPostData({
        ...basicPostData,
        files: [...(basicPostData.files || []), ...droppedFiles]
      }));

      // Generate previews for the new files
      droppedFiles.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreviews(prev => [...prev, {
            id: Date.now() + Math.random().toString(36).substring(2, 9),
            src: reader.result,
            file: file
          }]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleRemoveFile = (idToRemove) => {
    const previewToRemove = filePreviews?.find(preview => preview.id === idToRemove);
    if (previewToRemove) {
      // If the file has an id (existing file), add to removeFiles
      if (previewToRemove.id && typeof previewToRemove.id === 'number') {
        setRemoveFiles(prev => [...prev, previewToRemove.id]);
      }
      // Remove from previews
      setFilePreviews(filePreviews.filter(preview => preview.id !== idToRemove));
      // Remove from basicPostData.files as well
      dispatch(bindPostData({
        ...basicPostData,
        files: basicPostData.files.filter(file => {
          // For new files, compare by object reference
          if (file instanceof File) {
            return file !== previewToRemove.file;
          }
          // For existing files, compare by id
          return file.id !== previewToRemove.id;
        })
      }));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handlePrivacyChange = (mode) => {
    dispatch(bindPostData({ ...basicPostData, privacy_mode: mode }))
    setShowPrivacyDropdown(false);
  };



  const handlePost = async () => {
    try {
      setIsSubmitting(true);

      // Create FormData for API request
      const editorContent = messageEditorRef.current ? messageEditorRef.current.innerHTML : basicPostData?.message ?? '';
      const editorPlainText = messageEditorRef.current ? messageEditorRef.current.innerText.replace(/\r/g, '') : getPlainTextFromHtml(editorContent);

      const normalizedContent = isBackgroundActive
        ? editorPlainText
        : normalizeEditorHtml(editorContent);

      const messageContent = isBackgroundActive
        ? editorPlainText.trim()
        : getPlainTextLength(normalizedContent) === 0 ? '' : normalizedContent;

      if (basicPostData?.message !== messageContent) {
        dispatch(bindPostData({ ...basicPostData, message: messageContent }));
      }


      const formData = new FormData();
      formData.append('message', messageContent);
      formData.append('privacy_mode', basicPostData.privacy_mode);

      // Build post_locations array
      const postLocations = [];

      // Add check-in location OR traveling from (both use post_type: 1)
      const fromLocation = checkInLocation || travelFrom;
      if (fromLocation) {
        postLocations.push({
          post_type: 1,
          place_name: fromLocation.place_name || '',
          lat: fromLocation.lat,
          lon: fromLocation.lng, // API uses 'lon' not 'lng'
          address: fromLocation.address || fromLocation.place_name || '',
          type: fromLocation.type || '',
          place_id: fromLocation.osm_id || fromLocation.place_id || null,
          place_rank: fromLocation.place_rank || 0,
          name: fromLocation.name || fromLocation.place_name.split(',')[0] || ''
        });
      }

      // Add destination location OR traveling to (both use post_type: 2)
      const toLocation = routeDestination || travelTo;
      if (toLocation) {
        postLocations.push({
          post_type: 2,
          place_name: toLocation.place_name || '',
          lat: toLocation.lat,
          lon: toLocation.lng, // API uses 'lon' not 'lng'
          address: toLocation.address || toLocation.place_name || '',
          type: toLocation.type || '',
          place_id: toLocation.osm_id || toLocation.place_id || null,
          place_rank: toLocation.place_rank || 0,
          name: toLocation.name || toLocation.place_name.split(',')[0] || ''
        });
      }

      // Add post_locations to FormData as array
      if (postLocations.length > 0) {
        postLocations.forEach((location, index) => {
          formData.append(`post_locations[${index}][post_type]`, location.post_type);
          formData.append(`post_locations[${index}][place_name]`, location.place_name);
          formData.append(`post_locations[${index}][lat]`, String(location.lat));
          formData.append(`post_locations[${index}][lon]`, String(location.lon));
          formData.append(`post_locations[${index}][address]`, location.address);
          formData.append(`post_locations[${index}][type]`, location.type);
          formData.append(`post_locations[${index}][place_id]`, String(location.place_id || ''));
          formData.append(`post_locations[${index}][place_rank]`, String(location.place_rank));
          formData.append(`post_locations[${index}][name]`, location.name);
        });
      }

      if (messageContent?.length < 280 && selectedBackground) {
        formData.append('background_url', selectedBackground?.image?.path);
      }

      // Add files if present (only images - videos are uploaded directly to S3)
      if (basicPostData.files?.length > 0) {
        let imageIndex = 0;
        let videoIndex = 0;
        basicPostData.files.forEach((file) => {
          if (file instanceof File) {
            if (file.type.startsWith('video/')) {
              // For videos, send metadata only (not the actual file)
              // Backend will use this to generate presigned URLs for direct S3 upload
              // formData.append(`video_metadata[${videoIndex}][name]`, file.name);
              // formData.append(`video_metadata[${videoIndex}][size]`, file.size);
              // formData.append(`video_metadata[${videoIndex}][type]`, file.type);
              videoIndex++;
            } else {
              // For images, send the actual file
              formData.append(`files[${imageIndex}]`, file);
              imageIndex++;
            }
          }
        });
      }

      // Add remove_files if any
      if (removeFiles.length > 0) {
        formData.append('removefiles', removeFiles);
      }

      // Use background upload for all posts (closes modal immediately with processing notification)
      // Close modal immediately and reset state
      dispatch(bindPostData(initialPostData));
      setFilePreviews([]);
      setRemoveFiles([]);
      setSelectedBackground(null);
      setBackgroundScrollIndex(0);
      setShowCheckIn(false);
      setShowRoute(false);
      setShowLocationModal(false);
      setCheckInLocation(null);
      setPlaceSearchQuery('');
      setPlaceSearchResults([]);
      setTravelFrom(null);
      setTravelTo(null);
      setTravelFromQuery('');
      setTravelToQuery('');
      setTravelFromResults([]);
      setTravelToResults([]);
      resetRoute();
      resetCheckIn();
      dispatch(setPostModalOpen(false));
      setIsSubmitting(false);

      // Start background upload (fire and forget)
      // Pass basicPostData.files to help identify/upload videos
      startUpload(formData, id || null, basicPostData.files || []).catch((error) => {
        console.error('Background post upload failed:', error);
      });

    } catch (error) {
      console.error('Error posting:', error);
      setIsSubmitting(false);
    }
  };

  const close = () => {
    dispatch(setPostModalOpen(false));
    dispatch(bindPostData(initialPostData));
    setSelectedBackground(null);
    setBackgroundScrollIndex(0);
    setShowCheckIn(false);
    setShowRoute(false);
    setShowLocationModal(false);
    setCheckInLocation(null);
    setPlaceSearchQuery('');
    setPlaceSearchResults([]);
    setTravelFrom(null);
    setTravelTo(null);
    setTravelFromQuery('');
    setTravelToQuery('');
    setTravelFromResults([]);
    setTravelToResults([]);
    resetRoute();
    resetCheckIn();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30">
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl flex flex-col relative overflow-hidden" style={{ height: '600px', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex justify-center border-b border-gray-200 p-4 relative flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            {showLocationModal && (
              <button
                onClick={() => setShowLocationModal(false)}
                className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <FaChevronLeft size={20} />
              </button>
            )}
            <h2 className="text-2xl font-bold flex-1 text-center text-gray-900">
              {showLocationModal
                ? (checkInMode === 'checkin' ? 'Check in at a place' : checkInMode === 'destination' ? 'Add destination' : 'Add travel route')
                : (id ? "Edit Post" : "Create post")}
            </h2>
            <button
              onClick={() => {
                close();
              }}
              className="text-gray-500 bg-gray-200 hover:bg-gray-300 p-2 rounded-full cursor-pointer transition-colors"
            >
              <FaTimes size={20} />
            </button>
          </div>
        </div>

        {/* Slider Container */}
        <div className="relative flex-1" style={{ minHeight: 0, position: 'relative', overflow: 'visible' }}>
          {/* Main Post Modal Content */}
          <div
            className={`w-full h-full flex flex-col transition-transform duration-300 ease-in-out ${showLocationModal ? 'absolute inset-0 -translate-x-full' : 'relative translate-x-0'
              }`}
            style={{ zIndex: showLocationModal ? 0 : 2 }}
          >
            <div className="p-4 overflow-y-auto flex-1">
              {/* User Profile Section */}
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-blue-400 flex items-center justify-center text-white mr-3 flex-shrink-0">
                  <img
                    src={
                      profile?.client?.image
                        ? process.env.NEXT_PUBLIC_FILE_PATH + profile?.client?.image
                        : "/common-avator.jpg"
                    }
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/common-avator.jpg";
                    }}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 text-base">
                    {profile?.client?.fname + " " + profile?.client?.last_name}
                  </div>
                  <div className="relative mt-1">
                    <button
                      onClick={() => setShowPrivacyDropdown(!showPrivacyDropdown)}
                      className="flex items-center text-sm font-medium bg-gray-200 px-3 py-1 rounded-md cursor-pointer hover:bg-gray-300 transition-colors"
                    >
                      {basicPostData?.privacy_mode === "public" ? (
                        <>
                          <FaGlobe size={12} className="mr-1" />
                          <span>Public</span>
                        </>
                      ) : (
                        <>
                          <FaLock size={12} className="mr-1" />
                          <span>Private</span>
                        </>
                      )}
                      <FaCaretDown className="ml-1" />
                    </button>

                    {showPrivacyDropdown && (
                      <div className="absolute left-0 mt-1 bg-white shadow-lg rounded-lg z-10 w-40 overflow-hidden border border-gray-200">
                        <button
                          onClick={() => handlePrivacyChange("public")}
                          className="flex items-center w-full px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                        >
                          <FaGlobe className="mr-2" />
                          <span>Public</span>
                        </button>
                        <button
                          onClick={() => handlePrivacyChange("private")}
                          className="flex items-center w-full px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                        >
                          <FaLock className="mr-2" />
                          <span>Private</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1 mb-4">
                {plainMessageLength > 280 ? (
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.preventDefault();
                        applyTextFormatting("bold");
                      }}
                      className="p-2 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 focus:outline-none"
                      aria-label="Bold"
                      title="Bold"
                    >
                      <FaBold size={14} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.preventDefault();
                        applyTextFormatting("italic");
                      }}
                      className="p-2 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 focus:outline-none"
                      aria-label="Italic"
                      title="Italic"
                    >
                      <FaItalic size={14} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.preventDefault();
                        applyTextFormatting("underline");
                      }}
                      className="p-2 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 focus:outline-none"
                      aria-label="Underline"
                      title="Underline"
                    >
                      <FaUnderline size={14} />
                    </button>
                    {/* <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  applyTextFormatting('formatBlock', 'H1');
                }}
                className="p-2 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 focus:outline-none"
                aria-label="Heading level 1"
                title="Heading 1"
              >
                <FaHeading size={14} />
              </button> */}
                  </div>
                ) : (
                  ""
                )}
                {selectedBackground &&
                  selectedBackground?.id !== "white" &&
                  plainMessageLength < 280 ? (
                  <div
                    className="relative w-full min-h-[400px] rounded-lg flex items-center justify-center bg-cover bg-center bg-no-repeat"
                    style={{
                      backgroundImage: selectedBackground?.image?.url
                        ? `url(${selectedBackground.image.url})`
                        : `url(${basicPostData?.background_url})`,
                      paddingBottom: "100px",
                    }}
                  >
                    <div className="relative w-full max-w-md">
                      {!plainMessageLength && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute left-30 top-10 text-white/70"
                        >{`What's on your mind, ${profile?.client?.fname}? Post anything!`}</span>
                      )}
                      <div
                        ref={messageEditorRef}
                        className="w-full border-0 resize-none outline-none p-4 text-white text-center bg-transparent min-h-[120px] max-h-[200px] text-[24px] font-medium whitespace-pre-wrap break-words"
                        contentEditable
                        role="textbox"
                        aria-multiline="true"
                        onInput={handleEditorInput}
                        onBlur={handleEditorInput}
                        onPaste={handleEditorPaste}
                        suppressContentEditableWarning
                      />
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    {!plainMessageLength && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-4 top-4 text-gray-400"
                      >{`What's on your mind, ${profile?.client?.fname}? Post anything!`}</span>
                    )}
                    <div
                      ref={messageEditorRef}
                      className="w-full border-0 outline-none p-4 transition-all duration-200 text-lg text-gray-700 bg-transparent min-h-[120px] whitespace-pre-wrap break-words"
                      contentEditable
                      role="textbox"
                      aria-multiline="true"
                      onInput={handleEditorInput}
                      onBlur={handleEditorInput}
                      onPaste={handleEditorPaste}
                      suppressContentEditableWarning
                    />
                  </div>
                )}
              </div>


              {/* Image/Video Previews - Show only when files are uploaded */}
              {filePreviews?.length > 0 && (
                <div className="mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    {filePreviews?.map((preview) => (
                      <div key={preview.id} className="relative rounded-lg overflow-hidden">
                        {preview?.file?.type.startsWith("video/") ? (
                          <video
                            controls
                            className="w-full h-48 object-cover"
                          >
                            <source src={preview?.src} />
                          </video>
                        ) : (
                          <img
                            src={preview?.src}
                            alt="Upload preview"
                            className="w-full h-48 object-cover"
                          />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(preview.id);
                          }}
                          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 transition-colors"
                        >
                          <FaTimes size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFilesChange}
                accept="image/*,video/*"
                className="hidden"
                multiple
              />



              {(!showLocationModal && (checkInLocation || routeDestination || travelFrom || travelTo)) && (
                <div className="mb-3">
                  <div
                    ref={routeMapContainerRef}
                    id="checkin-map-container"
                    className="w-full rounded-md border border-gray-200 bg-gray-100"
                    style={{
                      height: '384px',
                      width: '100%',
                      position: 'relative',
                      zIndex: 0
                    }}
                  />
                </div>
              )}
            </div>


            {/* Background Selection - Button on Left */}
            <div className='ms-4'>
              {(!checkInLocation && !routeDestination && filePreviews?.length === 0) && (
                <div className="mb-3">
                  <div className="flex items-center space-x-2">
                    {/* Toggle Button on Left */}
                    <button
                      onClick={() => setShowBackgroundOptions(!showBackgroundOptions)}
                      className="flex-shrink-0 w-9 h-9 bg-gray-200 rounded-md flex items-center justify-center hover:bg-gray-300 transition-colors"
                      title="Background options"
                    >
                      {showBackgroundOptions ?
                        <FaChevronLeft size={14} className="text-gray-600" />
                        :
                        <FaChevronRight size={14} className="text-gray-600" />}
                    </button>

                    {/* Background Options Bar - Only show when toggled */}
                    {showBackgroundOptions && (
                      <div className="flex items-center space-x-1 flex-1  rounded-xl">
                        {/* Left Arrow */}
                        {backgroundScrollIndex > 0 && (
                          <button
                            onClick={() => scrollBackgrounds("left")}
                            className="flex-shrink-0 w-9 h-9  rounded-lg flex items-center justify-center hover:bg-gray-300 transition-colors"
                          >
                            <FaChevronLeft size={14} className="text-gray-600" />
                          </button>
                        )}

                        {/* Background Swatches */}
                        <div className="flex items-center space-x-2 flex-1 overflow-hidden">
                          {isVisibleBg &&
                            visibleBackgrounds?.map((bg) => (
                              <button
                                key={bg.id}
                                onClick={() => {
                                  handleBackgroundSelect(bg);
                                  setShowBackgroundOptions(false);
                                }}
                                className={`flex-shrink-0 w-8 h-8 rounded-md border-3 overflow-hidden transition-all duration-200 hover:scale-105 ${selectedBackground?.id === bg.id
                                  ? "border-blue-500 ring-2 ring-blue-400 scale-105"
                                  : "border-transparent"
                                  }`}
                                style={{
                                  backgroundImage: `url(${bg?.image?.url})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center'
                                }}
                                title={bg.name}
                              />
                            ))}
                        </div>

                        {/* Right Arrow */}
                        {backgroundScrollIndex < backgroundOptions.length - 8 && (
                          <button
                            onClick={() => scrollBackgrounds("right")}
                            className="flex-shrink-0 w-9 h-9  rounded-lg flex items-center justify-center hover:bg-gray-300 transition-colors"
                          >
                            <FaChevronRight size={14} className="text-gray-600" />
                          </button>
                        )}

                        {/* Clear Background */}
                        {selectedBackground && selectedBackground?.id !== "white" && (
                          <button
                            onClick={() => {
                              handleBackgroundClear();
                              setShowBackgroundOptions(false);
                            }}
                            className="flex-shrink-0 w-9 h-9 bg-white border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                            title="Clear background"
                          >
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Add to your post Section */}
            <div className="px-4 pb-2 flex-shrink-0">
              <div className="border border-gray-300 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-900 font-medium text-sm">Add to your post</span>
                  <div className="flex items-center gap-1">
                    {/* Photo/Video */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      title="Photo/Video"
                    >
                      <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                    </button>

                    {/* Tag People */}
                    {/* <button
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      title="Tag people"
                    >
                      <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                    </button> */}

                    {/* Product/Feeling */}
                    {/* <button
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      title="Feeling/Activity"
                    >
                      <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                      </svg>
                    </button> */}

                    {/* Check-in/Location */}
                    <button
                      onClick={() => {
                        setCheckInMode('checkin');
                        setShowLocationModal(true);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      title="Check in"
                    >
                      <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                    </button>

                    {/* Travel Route */}
                    <button
                      onClick={() => {
                        setCheckInMode('travel');
                        setShowLocationModal(true);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      title="Add travel route"
                    >
                      <svg className="w-6 h-6 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    </button>

                    {/* More options */}
                    {/* <button
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      title="More"
                    >
                      <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button> */}
                  </div>
                </div>
              </div>
            </div>

            {/* Next Button */}
            <div className="px-4 pb-4 flex-shrink-0">
              <button
                onClick={handlePost}
                className={`px-4 py-3 w-full rounded-lg transition font-semibold text-base ${loading ||
                  (plainMessageLength === 0 && !basicPostData?.files?.length && !checkInLocation && !routeDestination && !travelFrom && !travelTo)
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600 cursor-pointer"
                  }`}
                disabled={
                  loading ||
                  (plainMessageLength === 0 && !basicPostData?.files?.length && !checkInLocation && !routeDestination && !travelFrom && !travelTo)
                }
              >
                {loading ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </div>

        {/* Inner Sliding Panel for Check-in / Destination */}
        {showLocationModal && (
          <div
            className="absolute inset-0 bg-white flex flex-col"
            style={{ zIndex: 10, height: '100%' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0" style={{ flexShrink: 0 }}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowLocationModal(false)}
                  className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <FaChevronLeft size={18} />
                </button>
                <h3 className="text-lg font-semibold text-gray-900">
                  {checkInMode === 'checkin' ? 'Check in at a place' : checkInMode === 'destination' ? 'Add Destination' : 'Add Travel Route'}
                </h3>
              </div>
              <button
                onClick={() => setShowLocationModal(false)}
                className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <FaTimes size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4" style={{ flex: 1, minHeight: 0, overflowY: 'auto', backgroundColor: '#f9fafb' }}>

              {checkInMode === 'travel' ? (
                <>
                  {/* Travel Mode UI */}
                  <div className="mb-4">
                    {/* Traveling From Search */}
                    <div className="relative mb-4 travel-from-search-container">
                      {/* <label className="block text-sm font-medium text-gray-700 mb-2">
                          Traveling From
                        </label> */}
                      <input
                        type="text"
                        placeholder="Your current location"
                        value={travelFromQuery}
                        onChange={(e) => {
                          setTravelFromQuery(e.target.value);
                          setShowTravelFromSearch(true);
                        }}
                        onFocus={() => setShowTravelFromSearch(true)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />

                      {/* Travel From Search Results */}
                      {showTravelFromSearch && travelFromResults?.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {isSearchingTravelFrom && (
                            <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>
                          )}
                          {travelFromResults?.map((place, index) => (
                            <div
                              key={index}
                              onClick={() => {
                                setTravelFrom(place);
                                setTravelFromQuery(place.place_name);
                                setTravelFromResults([]);
                                setShowTravelFromSearch(false);
                              }}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="text-sm font-medium text-gray-900">
                                {place.place_name.split(',')[0]}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {place.place_name}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected Travel From */}
                    {travelFrom && (
                      <div className="mb-4 p-3 rounded-md border bg-blue-50 border-blue-200">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start flex-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                From: {travelFrom.place_name.split(',')[0]}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {travelFrom.place_name}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setTravelFrom(null);
                              setTravelFromQuery('');
                            }}
                            className="text-gray-500 hover:text-gray-700 ml-2"
                          >
                            <FaTimes size={14} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Traveling To Search */}
                    <div className="relative mb-4 travel-to-search-container">
                      {/* <label className="block text-sm font-medium text-gray-700 mb-2">
                          Traveling To
                        </label> */}
                      <input
                        type="text"
                        placeholder="Your next destination"
                        value={travelToQuery}
                        onChange={(e) => {
                          setTravelToQuery(e.target.value);
                          setShowTravelToSearch(true);
                        }}
                        onFocus={() => setShowTravelToSearch(true)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />

                      {/* Travel To Search Results */}
                      {showTravelToSearch && travelToResults?.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {isSearchingTravelTo && (
                            <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>
                          )}
                          {travelToResults?.map((place, index) => (
                            <div
                              key={index}
                              onClick={() => {
                                setTravelTo(place);
                                setTravelToQuery(place.place_name);
                                setTravelToResults([]);
                                setShowTravelToSearch(false);
                              }}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="text-sm font-medium text-gray-900">
                                {place.place_name.split(',')[0]}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {place.place_name}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected Travel To */}
                    {travelTo && (
                      <div className="mb-4 p-3 rounded-md border bg-purple-50 border-purple-200">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start flex-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                To: {travelTo.place_name.split(',')[0]}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {travelTo.place_name}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setTravelTo(null);
                              setTravelToQuery('');
                            }}
                            className="text-gray-500 hover:text-gray-700 ml-2"
                          >
                            <FaTimes size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Map for Travel */}
                  <div className="mb-4">
                    <div
                      ref={checkInMode === 'travel' ? routeMapContainerRef : null}
                      id="travel-map-container"
                      className="w-full rounded-md border border-gray-200"
                      style={{ height: '384px', width: '100%', position: 'relative', zIndex: 0 }}
                    />
                    <div className="mt-2 text-xs text-gray-600">
                      {!travelFrom && !travelTo
                        ? "Search for locations above or click on the map to set your travel route."
                        : travelFrom && !travelTo
                          ? "Now select your destination."
                          : travelFrom && travelTo
                            ? `Route: ${travelFrom.place_name.split(',')[0]} → ${travelTo.place_name.split(',')[0]}`
                            : "Search for a starting location."}
                    </div>
                  </div>
                </>
              ) : (checkInMode === 'checkin' || checkInMode === 'destination') ? (
                <>
                  <div className="mb-4">
                    {/* Place Search */}
                    <div className="relative mb-3 place-search-container">
                      <input
                        type="text"
                        placeholder="Search for a place..."
                        value={placeSearchQuery}
                        onChange={(e) => {
                          setPlaceSearchQuery(e.target.value);
                          setShowPlaceSearch(true);
                        }}
                        onFocus={() => setShowPlaceSearch(true)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />


                      {/* Search Results Dropdown */}
                      {showPlaceSearch && placeSearchResults?.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {isSearchingPlaces && (
                            <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>
                          )}
                          {placeSearchResults?.map((place, index) => (
                            <div
                              key={index}
                              onClick={() => {
                                selectPlace(place);
                                // setShowLocationModal(true);
                              }}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="text-sm font-medium text-gray-900">
                                {place.place_name.split(',')[0]}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {place.place_name}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Set Destination Button - After Check-in */}
                    {/* {(checkInMode === 'checkin' && checkInLocation && !routeDestination) && (
                        <div className="mb-3">
                          <button 
                            className='w-full border py-3 border-green-400 cursor-pointer bg-green-200 hover:bg-green-300 font-semibold text-base rounded-md transition-colors flex items-center justify-center gap-2' 
                            onClick={() => {
                              setCheckInMode("destination");
                              setPlaceSearchQuery('');
                              setPlaceSearchResults([]);
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Set Destination
                          </button>
                        </div>
                      )} */}

                    {/* Selected Location Display */}
                    {((checkInMode === 'checkin' && checkInLocation) || (checkInMode === 'destination' && routeDestination)) && (
                      <div className={`mb-3 p-3 rounded-md border ${checkInMode === 'destination'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-blue-50 border-blue-200'
                        }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start flex-1">
                            {checkInMode === 'destination' ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            ) : (
                              <LuMapPinCheckInside size={20} className="text-red-600 mr-2 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                {checkInMode === 'destination'
                                  ? routeDestination?.place_name.split(',')[0]
                                  : checkInLocation?.place_name.split(',')[0]
                                }
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {checkInMode === 'destination'
                                  ? routeDestination?.place_name
                                  : checkInLocation?.place_name
                                }
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (checkInMode === 'destination') {
                                setRouteDestination(null);
                              } else {
                                resetCheckIn();
                              }
                            }}
                            className="text-gray-500 hover:text-gray-700 ml-2"
                          >
                            <FaTimes size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Map for Check-in */}
                  <div className="mb-4">
                    <div
                      ref={(checkInMode === 'checkin' || checkInMode === 'destination') ? routeMapContainerRef : null}
                      id="checkin-map-container"
                      className="w-full rounded-md border border-gray-200"
                      style={{ height: '384px', width: '100%', position: 'relative', zIndex: 0 }}
                    />
                    <div className="mt-2 text-xs text-gray-600">
                      {(checkInMode === 'checkin' && !checkInLocation) || (checkInMode === 'destination' && !routeDestination)
                        ? "Search for a place above or click on the map to select a location."
                        : checkInMode === 'destination' && routeDestination
                          ? `Selected: ${routeDestination.place_name}`
                          : checkInLocation
                            ? `Selected: ${checkInLocation.place_name}`
                            : "Search for a place above or click on the map to select a location."}
                    </div>

                  </div>

                </>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Please select a mode
                </div>
              )}
            </div>

            {/* Fixed Done Button at Bottom */}
            {((checkInMode === 'checkin' && checkInLocation) || (checkInMode === 'destination' && routeDestination) || (checkInMode === 'travel' && travelFrom && travelTo)) && (
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
                <button
                  onClick={() => setShowLocationModal(false)}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Done
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PostModal;



