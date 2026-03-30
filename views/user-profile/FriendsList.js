"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  FaEllipsisH,
  FaUserPlus,
  FaUserMinus,
  FaSearch,
} from "react-icons/fa";
import FeedHeader from "@/components/common/FeedHeader";
import { useDispatch, useSelector } from "react-redux";
import { followTo, getMyProfile, getUserFollowers, getUserFollowing, getUserProfile, getUserProfileByUsername, unFollowTo } from "../settings/store";
import { useParams } from "next/navigation";
import FeedLayout from "@/components/common/FeedLayout";

const FriendsList = () => {
  const { userProfileData, userFollowers, userFollowing, followLoading } = useSelector(({ settings }) => settings);
  const dispatch = useDispatch();
  const params = useParams();
  const [activeTab, setActiveTab] = useState('followers');
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    // Initial profile load
    dispatch(getMyProfile());
    dispatch(getUserProfileByUsername(params?.username));
  }, [dispatch, params?.username]);

  useEffect(() => {
    // Handle tab changes - wait for userProfileData to load first
    if (userProfileData?.client?.id) {
      if (activeTab === 'followers') {
        dispatch(getUserFollowers(userProfileData.client.id));
      } else if (activeTab === 'following') {
        dispatch(getUserFollowing(userProfileData.client.id));
      }
    }
  }, [activeTab, userProfileData?.client?.id, dispatch]);

  const tabs = [
    { id: 'followers', label: 'Followers' },
    { id: 'following', label: 'Following' }
  ];

  const [followingStates, setFollowingStates] = useState({});
  const [loadingStates, setLoadingStates] = useState({});

  const handleFollowToggle = async (id, isFollowing) => {
    setLoadingStates(prev => ({ ...prev, [id]: true }));
    try {
      if (isFollowing) {
        await dispatch(unFollowTo({ following_id: id }));
        setFollowingStates(prev => ({ ...prev, [id]: false }));
      } else {
        await dispatch(followTo({ following_id: id }));
        setFollowingStates(prev => ({ ...prev, [id]: true }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingStates(prev => ({ ...prev, [id]: false }));
    }
  };

  const FriendCard = ({ friend }) => {
    // For followers tab: friend.follower_client contains the follower's info
    // For following tab: friend.following_client contains the person being followed
    const clientData = friend?.following_client || friend?.follower_client;
    const clientImage = clientData?.image;
    const clientName = `${clientData?.fname || ''} ${clientData?.last_name || ''}`.trim();
    const clientTagline = clientData?.tagline || friend?.tagline || 'No tagline';
    const clientUsername = clientData?.username;
    
    // Default following state depends on tab
    const defaultIsFollowing = activeTab === 'following';
    const isFollowing = followingStates[clientData?.id] !== undefined 
      ? followingStates[clientData?.id] 
      : defaultIsFollowing;
      
    const isLoading = loadingStates[clientData?.id] || false;

    return (
      <div className="col-span-1">
        <div className="bg-white rounded-lg p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
              <img
                src={clientImage ? process.env.NEXT_PUBLIC_FILE_PATH + clientImage : "/common-avator.jpg"}
                alt={clientName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/common-avator.jpg";
                }}
              />
            </div>
            <div>
              <Link href={`/${clientUsername || ''}`} className="hover:underline">
                <h3 className="font-semibold text-gray-900">{clientName || 'Unknown User'}</h3>
              </Link>
              <p className="text-sm text-gray-500">{clientTagline}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => handleFollowToggle(clientData?.id || friend?.id, isFollowing)} 
              disabled={isLoading}
              className={`px-3 py-1 cursor-pointer text-white rounded-md transition-colors flex items-center space-x-2 ${
                isFollowing ? "bg-gray-500 hover:bg-gray-600" : "bg-blue-500 hover:bg-blue-600"
              } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isFollowing ? <FaUserMinus className="text-sm" /> : <FaUserPlus className="text-sm" />}
              <span>
                {isLoading 
                  ? (isFollowing ? "Unfollowing..." : "Following...") 
                  : (isFollowing ? "Unfollow" : "Follow")}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  };


  const friendsToDisplay = activeTab === 'followers' ? (userFollowers || []) : (userFollowing || []);

  return (
    <FeedLayout showMsgBtn={true} showFriends={true} userProfile={true}>
      <div className="about-content">


        <div className="bg-white rounded-lg shadow-sm mt-4 p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Friends</h1>
            {/* <div className="relative">
            <input
              type="text"
              placeholder="Search friends..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div> */}
          </div>

          <div className="mb-6">
            <nav className="flex space-x-8">
              {tabs?.map((tab) => (
                <button
                  key={tab?.id}
                  onClick={() => setActiveTab(tab?.id)}
                  className={`py-4 px-1 cursor-pointer border-b-2 font-medium text-sm ${activeTab === tab?.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  {tab?.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {friendsToDisplay?.map((friend, index) => {
              return (
                <FriendCard
                  key={index}
                  friend={friend}
                />
              );
            })}

          </div>

          {/* Show empty state if no friends */}
          {(!friendsToDisplay || friendsToDisplay?.length === 0) && (
            <div className="text-center py-8">
              <p className="text-gray-500 text-lg">No {activeTab} to display</p>
              <p className="text-gray-400 text-sm mt-2">Start connecting with people to build your network</p>
            </div>
          )}
        </div>
      </div>
    </FeedLayout>
  );
};

export default FriendsList;
