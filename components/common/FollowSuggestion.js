import { getFollowSuggestions, followTo, unFollowTo } from "@/views/settings/store";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

// Helper function to get client image URL without duplication
const getClientImageUrl = (imagePath, fallback = "/common-avator.jpg") => {
  if (!imagePath) return fallback;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  return process.env.NEXT_PUBLIC_FILE_PATH + imagePath;
};

const FollowSuggestion = () => {
  const { followSuggestion } = useSelector(({ settings }) => settings);
  const dispatch = useDispatch();
  const [followingStates, setFollowingStates] = useState({});
  const [loadingStates, setLoadingStates] = useState({});

  useEffect(() => {
    dispatch(getFollowSuggestions());
  }, [dispatch]);

  const handleFollowToggle = async (userId, isCurrentlyFollowed) => {
    // Set loading state for this specific user
    setLoadingStates(prev => ({ ...prev, [userId]: true }));

    try {
      if (isCurrentlyFollowed) {
        await dispatch(unFollowTo({ following_id: userId }));
        setFollowingStates(prev => ({ ...prev, [userId]: false }));
      } else {
        await dispatch(followTo({ following_id: userId }));
        setFollowingStates(prev => ({ ...prev, [userId]: true }));
      }
      // Refresh suggestions after follow/unfollow
      dispatch(getFollowSuggestions());
    } catch (error) {
      console.error('Follow/Unfollow error:', error);
    } finally {
      // Clear loading state for this specific user
      setLoadingStates(prev => ({ ...prev, [userId]: false }));
    }
  };

  const getFollowStatus = (user) => {
    return followingStates[user.id] !== undefined
      ? followingStates[user.id]
      : user.is_followed || false;
  };

  const isUserLoading = (userId) => {
    return loadingStates[userId] || false;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 mb-4">
      <h3 className="text-base sm:text-lg font-semibold mb-3">Who to follow</h3>

      {followSuggestion && followSuggestion.length > 0 ? (
        <div className="space-y-3">
          {followSuggestion?.map((user, index) => {
            const isFollowed = getFollowStatus(user);
            const isLoading = isUserLoading(user.id);

            return (
              <div key={user.id || index} className="flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                  {/* Profile Picture */}
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                    <img
                      src={getClientImageUrl(user?.image)}
                      alt={user?.fname || "User"}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.src = "/common-avator.jpg"; }}
                    />
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <Link href={`/${user?.username}`}>
                      <p className="text-xs sm:text-sm hover:underline font-semibold text-gray-900 truncate">
                        {user?.fname + " " + user?.last_name || "Unknown User"}
                      </p>
                    </Link>
                    {user?.email && (
                      <p className="text-xs text-gray-500 truncate">
                        @{user.email.split('@')[0]}
                      </p>
                    )}
                  </div>
                </div>

                {/* Follow Button */}
                <button
                  onClick={() => handleFollowToggle(user.id, isFollowed)}
                  disabled={isLoading}
                  className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-full transition-colors min-w-[60px] sm:min-w-[70px] flex-shrink-0 ${isFollowed
                    ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                    } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-3 h-3 border-2 border-gray-300 border-t-white rounded-full animate-spin"></div>
                    </div>
                  ) : isFollowed ? (
                    <span className="hidden sm:inline">Following</span>
                  ) : (
                    "Follow"
                  )}
                </button>
              </div>
            );
          })}

          {followSuggestion.length > 5 && (
            <button
              onClick={() => dispatch(getFollowSuggestions())}
              className="w-full text-blue-500 hover:text-blue-600 text-sm font-medium py-2 mt-2"
            >
              Show more
            </button>
          )}
        </div>
      ) : (
        <div className="text-gray-400 text-sm py-4 text-center">
          <div className="mb-2">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          No suggestions available
        </div>
      )}
    </div>
  );
};

export default FollowSuggestion;
