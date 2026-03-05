"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSearchQuery, setSearchResults, setSearchLoading, removeQuery } from '@/views/search/store';
import api from '@/helpers/axios';
import { followTo, unFollowTo } from '@/views/settings/store';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FaSearch, FaEllipsisV, FaMapMarkerAlt, FaHeart, FaGraduationCap, FaUsers, FaTint, FaChevronDown, FaChevronUp, FaCheckCircle } from 'react-icons/fa';

// General people search API
const searchApi = async (query) => {
  const response = await api.get(`/client/search_by_people?search=${query}`);
  console.log('response of search', response);
  return response.data.data.follow_connections;
};

// Advanced search profile API
const advanceSearchProfile = async (filters) => {
  const params = new URLSearchParams();

  // Add parameters only if they exist and are not empty
  if (filters.state_id) params.append('state_id', filters.state_id);
  if (filters.city_id) params.append('city_id', filters.city_id);
  if (filters.country_id) params.append('country_id', filters.country_id);
  if (filters.school) params.append('school', filters.school);
  if (filters.blood_group) params.append('blood_group', filters.blood_group);
  if (filters.community) params.append('community', filters.community);
  if (filters.is_single) params.append('is_single', filters.is_single);

  // Build query string
  let queryString = params.toString();

  // Keep '+' sign visible for blood_group (A+, B+, AB+, O+)
  if (filters.blood_group && filters.blood_group.includes('+')) {
    queryString = queryString.replace(/%2B/g, '+');
  }

  console.log('Advanced Search API:', `/client/advance_search_profile?${queryString}`);

  const response = await api.get(`/client/advance_search_profile?${queryString}`);
  return response?.data?.data?.search_results || [];
};

const SidebarSearch = () => {
  const dispatch = useDispatch();
  const { query, results, loading } = useSelector(state => state.search);
  const { profileData } = useSelector(({ settings }) => settings);
  const dropdownRef = useRef(null);
  const [loadingStates, setLoadingStates] = useState({});
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchCategory, setSearchCategory] = useState('general');
  const pathname = usePathname();
  const router = useRouter();
  const [locationCountries, setLocationCountries] = useState([]);
  const [locationStates, setLocationStates] = useState([]);
  const [locationCities, setLocationCities] = useState([]);
  const [advancedFilters, setAdvancedFilters] = useState({
    city: '',
    country: '',
    community: '',
    school: '',
    ageRange: { min: 18, max: 65 },
    bloodType: '',
    relationshipStatus: 'single',
    radius: 10, // km
    state_id: '',
    city_id: '',
    country_id: '',
    blood_group: ''
  });

  useEffect(() => {
    return () => (
      dispatch(removeQuery())
    );
  }, []);

  // Fetch location options for By Location category
  useEffect(() => {
    if (!showAdvancedSearch || searchCategory !== 'location') return;
    const fetchCountries = async () => {
      try {
        const response = await api.get(`${process.env.NEXT_PUBLIC_API_URL}/location/country`);
        const options = response?.data?.data?.map(c => ({ value: String(c.id), label: c.name })) || [];
        setLocationCountries(options);
      } catch (e) {
        console.error('Failed to load countries', e);
      }
    };
    fetchCountries();
  }, [showAdvancedSearch, searchCategory]);

  const fetchStates = async (countryId) => {
    try {
      const response = await api.get(`${process.env.NEXT_PUBLIC_API_URL}/location/state?country_id=${countryId}`);
      const options = response?.data?.data?.map(s => ({ value: String(s.id), label: s.name })) || [];
      setLocationStates(options);
    } catch (e) {
      console.error('Failed to load states', e);
    }
  };

  const fetchCities = async (stateId) => {
    try {
      const response = await api.get(`${process.env.NEXT_PUBLIC_API_URL}/location/city?state_id=${stateId}`);
      const options = response?.data?.data?.map(c => ({ value: String(c.id), label: c.name })) || [];
      setLocationCities(options);
    } catch (e) {
      console.error('Failed to load cities', e);
    }
  };

  // Function to handle following a user
  const handleFollow = async (userId) => {
    try {
      setLoadingStates(prev => ({ ...prev, [userId]: true }));
      await dispatch(followTo({ following_id: userId }));

      // Reload search results after successful follow
      dispatch(setSearchLoading(true));
      const newResults = await searchApi(query);
      dispatch(setSearchResults(newResults));
    } catch (error) {
      console.error('Error following user:', error);
    } finally {
      dispatch(setSearchLoading(false));
      setLoadingStates(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Function to handle unfollowing a user
  const handleUnFollow = async (userId) => {
    try {
      setLoadingStates(prev => ({ ...prev, [userId]: true }));
      await dispatch(unFollowTo({ following_id: userId }));

      // Reload search results after successful unfollow
      dispatch(setSearchLoading(true));
      const newResults = await searchApi(query);
      dispatch(setSearchResults(newResults));
    } catch (error) {
      console.error('Error unfollowing user:', error);
    } finally {
      dispatch(setSearchLoading(false));
      setLoadingStates(prev => ({ ...prev, [userId]: false }));
    }
  };


  // Handle advanced search
  const handleAdvancedSearch = async () => {
    dispatch(setSearchLoading(true));
    try {
      let searchResults = [];

      switch (searchCategory) {
        case 'singles': {
          // Singles search - is_single parameter
          const params = { is_single: 'yes' };
          searchResults = await advanceSearchProfile(params);
          dispatch(setSearchQuery('Singles Search'));
          break;
        }
        case 'blood_donors': {
          if (!advancedFilters.blood_group) {
            searchResults = [];
            dispatch(setSearchQuery('Blood Donors Search'));
            break;
          }
          // Blood donors - send actual blood type like A+, B+, etc.
          const params = { blood_group: advancedFilters.blood_group };
          searchResults = await advanceSearchProfile(params);
          dispatch(setSearchQuery(`Blood Donors (${advancedFilters.blood_group})`));
          break;
        }
        case 'location': {
          if (!advancedFilters.country_id || !advancedFilters.state_id || !advancedFilters.city_id) {
            searchResults = [];
            dispatch(setSearchQuery('Location Search'));
            break;
          }
          // Location search - country_id, state_id, city_id
          const params = {
            country_id: advancedFilters.country_id,
            state_id: advancedFilters.state_id,
            city_id: advancedFilters.city_id
          };
          searchResults = await advanceSearchProfile(params);
          dispatch(setSearchQuery('Location Search'));
          break;
        }
        case 'school': {
          // School friends - school: yes
          const params = { school: 'yes' };
          searchResults = await advanceSearchProfile(params);
          dispatch(setSearchQuery('School Friends Search'));
          break;
        }
        case 'community': {
          // Community - if user entered community name, use it; otherwise send 'yes'
          const params = {
            community: advancedFilters.community || 'yes'
          };
          searchResults = await advanceSearchProfile(params);
          dispatch(setSearchQuery('Community Search'));
          break;
        }
        case 'advance': {
          // Advanced search with all filters
          searchResults = await advanceSearchProfile(advancedFilters);
          dispatch(setSearchQuery('Advanced Search'));
          break;
        }
        default: {
          // Fallback to basic search
          searchResults = await searchApi(query);
        }
      }

      dispatch(setSearchResults(searchResults));
    } catch (error) {
      console.error('Advanced search error:', error);
      dispatch(setSearchResults([]));
    } finally {
      dispatch(setSearchLoading(false));
    }
  };

  useEffect(() => {
    if (query.trim() === '') {
      dispatch(setSearchResults([]));
      return;
    }

    // Only do general search if not in advanced mode
    if (!showAdvancedSearch) {
      dispatch(setSearchLoading(true));
      searchApi(query)
        .then(res => {
          dispatch(setSearchResults(res));
          dispatch(setSearchLoading(false));
        })
        .catch(() => {
          dispatch(setSearchResults([]));
          dispatch(setSearchLoading(false));
        });
    }
  }, [query, dispatch, showAdvancedSearch]);

  // Auto-trigger advanced search for category shortcuts
  useEffect(() => {
    if (!showAdvancedSearch) return;
    // Auto trigger only the selected category's call
    if (['singles', 'school', 'community'].includes(searchCategory)) {
      handleAdvancedSearch();
    } else if (searchCategory === 'blood_donors' && advancedFilters.blood_group) {
      handleAdvancedSearch();
    } else if (searchCategory === 'location' && advancedFilters.country_id && advancedFilters.state_id && advancedFilters.city_id) {
      handleAdvancedSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCategory, showAdvancedSearch, advancedFilters.blood_group, advancedFilters.country_id, advancedFilters.state_id, advancedFilters.city_id]);

  // Clear results when route changes
  useEffect(() => {
    if (!pathname) return;
    dispatch(setSearchResults([]));
    // Do not forcibly remove query; let user keep it unless navigating away
    // If you want to fully reset on route change, uncomment next line
    // dispatch(removeQuery());
  }, [pathname, dispatch]);

  return (
    <div className="p-4 ml-2 hidden md:block border-b border-gray-200 relative bg-white rounded-md" ref={dropdownRef}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          {showAdvancedSearch ? 'Advanced Search' : 'Search People'}
        </h2>
        <div className="flex items-center gap-2">
          {query && (
            <button
              onClick={() => {
                dispatch(setSearchResults([]));
                dispatch(removeQuery());
              }}
              className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-white hover:bg-red-600 border border-red-600 rounded-lg transition-all duration-200"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${showAdvancedSearch
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
          >
            <span className="font-semibold">Advanced</span>
            {showAdvancedSearch ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
          </button>
        </div>
      </div>

      {/* Advanced Search Options */}
      {showAdvancedSearch && (
        <div className="mb-4 p-4 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border border-gray-200 shadow-sm">
          {/* Category Selector */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Search Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSearchCategory('blood_donors')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-medium transition-all duration-200 ${searchCategory === 'blood_donors'
                  ? 'bg-red-500 text-white shadow-lg shadow-red-200 scale-105'
                  : 'bg-white text-gray-700 hover:bg-red-50 hover:text-red-600 border border-gray-200'
                  }`}
              >
                <FaTint size={16} />
                <span>Blood Donors</span>
              </button>
              <button
                onClick={() => setSearchCategory('location')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-medium transition-all duration-200 ${searchCategory === 'location'
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-200 scale-105'
                  : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-gray-200'
                  }`}
              >
                <FaMapMarkerAlt size={16} />
                <span>By Location</span>
              </button>
              <button
                onClick={() => setSearchCategory('community')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-medium transition-all duration-200 ${searchCategory === 'community'
                  ? 'bg-green-500 text-white shadow-lg shadow-green-200 scale-105'
                  : 'bg-white text-gray-700 hover:bg-green-50 hover:text-green-600 border border-gray-200'
                  }`}
              >
                <FaUsers size={16} />
                <span>Community</span>
              </button>
              <button
                onClick={() => setSearchCategory('school')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-medium transition-all duration-200 ${searchCategory === 'school'
                  ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-200 scale-105'
                  : 'bg-white text-gray-700 hover:bg-yellow-50 hover:text-yellow-600 border border-gray-200'
                  }`}
              >
                <FaGraduationCap size={16} />
                <span>School Friends</span>
              </button>
              <button
                onClick={() => setSearchCategory('singles')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-medium transition-all duration-200 col-span-2 ${searchCategory === 'singles'
                  ? 'bg-pink-500 text-white shadow-lg shadow-pink-200 scale-105'
                  : 'bg-white text-gray-700 hover:bg-pink-50 hover:text-pink-600 border border-gray-200'
                  }`}
              >
                <FaHeart size={16} />
                <span>Singles</span>
              </button>
            </div>
          </div>

          {/* Dynamic Filter Fields */}
          <div className="space-y-3">

            {searchCategory === 'blood_donors' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Blood Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={advancedFilters.blood_group}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, blood_group: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                >
                  <option value="">Select Blood Type</option>
                  <option value="A+">A+ (Positive)</option>
                  <option value="A-">A- (Negative)</option>
                  <option value="B+">B+ (Positive)</option>
                  <option value="B-">B- (Negative)</option>
                  <option value="AB+">AB+ (Positive)</option>
                  <option value="AB-">AB- (Negative)</option>
                  <option value="O+">O+ (Positive)</option>
                  <option value="O-">O- (Negative)</option>
                </select>
              </div>
            )}

            {searchCategory === 'community' && (
              <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                <FaUsers className="text-green-600 mt-0.5 flex-shrink-0" size={16} />
                <div>
                  <p className="text-sm font-medium text-green-900">Community Search</p>
                  <p className="text-xs text-green-700 mt-1">Find people in your community network</p>
                </div>
              </div>
            )}

            {searchCategory === 'school' && (
              <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg">
                <FaGraduationCap className="text-yellow-600 mt-0.5 flex-shrink-0" size={16} />
                <div>
                  <p className="text-sm font-medium text-yellow-900">School Friends</p>
                  <p className="text-xs text-yellow-700 mt-1">Find people who went to the same school as you</p>
                </div>
              </div>
            )}

            {searchCategory === 'singles' && (
              <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 rounded-lg">
                <FaHeart className="text-pink-600 mt-0.5 flex-shrink-0" size={16} />
                <div>
                  <p className="text-sm font-medium text-pink-900">Singles Search</p>
                  <p className="text-xs text-pink-700 mt-1">Find single people looking for relationships</p>
                </div>
              </div>
            )}



            {searchCategory === 'location' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={advancedFilters.country_id}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAdvancedFilters({ ...advancedFilters, country_id: val, state_id: '', city_id: '' });
                      if (val) fetchStates(val);
                    }}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="">Select Country</option>
                    {locationCountries.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    State/Province <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={advancedFilters.state_id}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAdvancedFilters({ ...advancedFilters, state_id: val, city_id: '' });
                      if (val) fetchCities(val);
                    }}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={!advancedFilters.country_id}
                  >
                    <option value="">Select State</option>
                    {locationStates.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    City <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={advancedFilters.city_id}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, city_id: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={!advancedFilters.state_id}
                  >
                    <option value="">Select City</option>
                    {locationCities.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <button
              onClick={handleAdvancedSearch}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3.5 px-6 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
            >
              <FaSearch size={14} />
              <span>
                {searchCategory === 'blood_donors' ? 'Search Blood Donors' :
                  searchCategory === 'location' ? 'Search By Location' :
                    searchCategory === 'community' ? 'Search Community' :
                      searchCategory === 'school' ? 'Search School Friends' :
                        searchCategory === 'singles' ? 'Search Singles' :
                          'Search'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* General Search Box */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <FaSearch className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search people by name..."
          className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all shadow-sm"
          value={query}
          onChange={e => dispatch(setSearchQuery(e.target.value))}
          autoComplete="off"
        />
      </div>

      {/* Search Results Dropdown - Only show for normal search, not advanced search */}
      {query && results.length > 0 && !showAdvancedSearch && !results.some(result => result.is_blood_donor !== undefined || result.is_spouse_need !== undefined) && query !== 'Demo Search' && !query.includes('Search') && (
        <div className="absolute left-0 right-0 mt-2 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-96 overflow-y-auto">
          <div className="py-3 px-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <FaSearch className="text-blue-600" size={14} />
              Search Results ({results.length})
            </h3>
          </div>
          <div className="py-2">
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                <p className="text-sm text-gray-500">Searching...</p>
              </div>
            ) : (
              results?.map(result => (
                <div
                  key={result.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 gap-3"
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mr-3 flex-shrink-0">
                      {result?.image ? (
                        <img
                          src={process.env.NEXT_PUBLIC_FILE_PATH + result?.image}
                          alt={result.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "/common-avator.jpg";
                          }}
                        />
                      ) : (
                        <img
                          src="/common-avator.jpg"
                          alt="Default avatar"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/${result?.username}`}>
                        <div
                          className="font-medium text-gray-900 text-sm hover:underline truncate"
                        >
                          {result.fname + " " + result.last_name}
                        </div>
                      </Link>
                      {result?.is_verified && (
                        <FaCheckCircle className="text-blue-500 text-xs" />
                      )}
                      {result?.followers?.length > 0 && (
                        <div className="text-xs text-gray-500 truncate">
                          {result.followers.map(f => `${f.follower_client.display_name}`).join(', ')} Following
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {result?.followed === "followed" ? (
                      <button
                        onClick={() => handleUnFollow(result.id)}
                        disabled={loadingStates[result.id]}
                        className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 disabled:opacity-50 whitespace-nowrap min-w-[70px]"
                      >
                        {loadingStates[result.id] ? 'Unfollowing...' : 'Unfollow'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleFollow(result.id)}
                        disabled={loadingStates[result.id]}
                        className="px-3 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 whitespace-nowrap min-w-[70px]"
                      >
                        {loadingStates[result.id] ? 'Following...' : 'Follow'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* No results message */}
      {query && !loading && results.length === 0 && (
        <div className="absolute left-0 right-0 mt-2 z-50 bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-6 text-center">
            <div className="mb-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100">
                <FaSearch className="text-gray-400" size={20} />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">No results found</p>
            <p className="text-xs text-gray-500">Try searching with different keywords</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SidebarSearch; 