"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { FaMapMarkerAlt, FaHeart, FaGraduationCap, FaUsers, FaTint, FaCheckCircle } from 'react-icons/fa';
import { useDispatch, useSelector } from 'react-redux';
import { followTo, unFollowTo } from '@/views/settings/store';
import { setSearchResults, removeQuery } from '@/views/search/store';

const SearchResults = () => {
  const dispatch = useDispatch();
  const { results, loading, query } = useSelector(state => state.search);
  const [loadingStates, setLoadingStates] = useState({});
  const clearResults = () => {
    dispatch(setSearchResults([]));
    dispatch(removeQuery());
  };

  // Function to handle following a user
  const handleFollow = async (userId) => {
    try {
      setLoadingStates(prev => ({ ...prev, [userId]: true }));
      await dispatch(followTo({ following_id: userId }));
      // You might want to refresh search results here
    } catch (error) {
      console.error('Error following user:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Function to handle unfollowing a user
  const handleUnFollow = async (userId) => {
    try {
      setLoadingStates(prev => ({ ...prev, [userId]: true }));
      await dispatch(unFollowTo({ following_id: userId }));
      // You might want to refresh search results here
    } catch (error) {
      console.error('Error unfollowing user:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Only show results if there's a query and we're in advanced search mode
  // We'll check if the results contain advanced search data (demo data or advanced search results)
  const isAdvancedSearch = results.length > 0 && (
    results.some(result => result.is_blood_donor !== undefined || result.is_spouse_need !== undefined) ||
    query === 'Demo Search' ||
    query === 'Advanced Search'
  );

  if (!query || results.length === 0 || !isAdvancedSearch) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Search Results ({results.length})
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            Found {results.length} results for &quot;{query}&quot;
          </span>
          <button
            onClick={clearResults}
            aria-label="Clear search results"
            title="Clear"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300"
          >
            ✕
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-500">Searching...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((result) => (
            <div
              key={result.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center flex-1 min-w-0">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mr-4 flex-shrink-0">
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
                    <div className="font-medium text-gray-900 text-lg hover:underline truncate cursor-pointer">
                      {(result.fname || '') + (result.middle_name ? ' ' + result.middle_name : '') + (result.last_name ? ' ' + result.last_name : '')}
                    </div>
                  </Link>
                  {result?.is_verified && (
                    <FaCheckCircle className="text-blue-500 text-sm" />
                  )}

                  <div className="text-sm text-gray-600 mt-1">
                    {result?.email && (
                      <span className="block">{result.email}</span>
                    )}
                    {result?.designation && (
                      <span className="block">{result.designation}</span>
                    )}
                    {result?.blood_group && (
                      <span className="inline-flex items-center mr-3">
                        <FaTint className="mr-1 text-red-500" size={12} />
                        {result.blood_group}
                      </span>
                    )}
                    {result?.is_blood_donor && (
                      <span className="inline-flex items-center mr-3 text-red-600">
                        <FaTint className="mr-1" size={12} />
                        Blood Donor
                      </span>
                    )}
                    {result?.is_spouse_need && (
                      <span className="inline-flex items-center mr-3 text-pink-600">
                        <FaHeart className="mr-1" size={12} />
                        Looking for Spouse
                      </span>
                    )}
                  </div>

                  {result?.followers?.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {result.followers
                        .map(f => f.displayName || [f.fname, f.middle_name, f.lname].filter(Boolean).join(' '))
                        .filter(Boolean)
                        .join(', ')} Following
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 ml-4">
                {result?.followed === "followed" ? (
                  <button
                    onClick={() => handleUnFollow(result.id)}
                    disabled={loadingStates[result.id]}
                    className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 disabled:opacity-50 whitespace-nowrap min-w-[80px]"
                  >
                    {loadingStates[result.id] ? 'Unfollowing...' : 'Unfollow'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleFollow(result.id)}
                    disabled={loadingStates[result.id]}
                    className="px-4 py-2 text-sm bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 whitespace-nowrap min-w-[80px]"
                  >
                    {loadingStates[result.id] ? 'Following...' : 'Follow'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchResults;
