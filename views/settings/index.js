"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FaUser, FaShieldAlt, FaIdCard, FaKey } from 'react-icons/fa';
import BasicInformation from './basic-information';
import ProfileSettings from './profile-settings';
import PasswordChange from './change-password';
import { useDispatch, useSelector } from 'react-redux';
import { getMyProfile, getUserProfile } from './store';
import FeedLayout from '@/components/common/FeedLayout';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('basic-information');
  const { profile } = useSelector(({ settings }) => settings)
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getMyProfile());
    dispatch(getUserProfile(profile?.client?.id));
  }, [dispatch])

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // Render the appropriate content based on the active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'basic-information':
        return <BasicInformation />;
      case 'profile-settings':
        return <ProfileSettings />;
      case 'ocm-id':
        return <div className="p-6 bg-white rounded-lg shadow-sm">OCM-ID Content (Coming Soon)</div>;
      case 'password-change':
        return <PasswordChange />;
      default:
        return <BasicInformation />;
    }
  };

  return (
    <FeedLayout showMsgBtn={false} showFriends={true} userProfile={true} hideSearch>
      <div className="mx-auto pt-3 px-2">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <div className="w-full h-full md:w-60 bg-white rounded-lg shadow-sm overflow-hidden">
            <div>
              <div
                className={`p-4 cursor-pointer ${activeTab === 'basic-information' ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50 border-l-4 border-transparent'}`}
                onClick={() => handleTabChange('basic-information')}
              >
                <div className="flex items-center gap-3">
                  <div className="text-blue-500">
                    <FaUser size={20} />
                  </div>
                  <span className={`font-medium ${activeTab === 'basic-information' ? 'text-blue-500' : 'text-gray-600'}`}>
                    Basic Information
                  </span>
                </div>
              </div>

              <div
                className={`p-4 cursor-pointer ${activeTab === 'profile-settings' ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50 border-l-4 border-transparent'}`}
                onClick={() => handleTabChange('profile-settings')}
              >
                <div className="flex items-center gap-3">
                  <div className="text-amber-500">
                    <FaShieldAlt size={20} />
                  </div>
                  <span className={`font-medium ${activeTab === 'profile-settings' ? 'text-blue-500' : 'text-gray-600'}`}>
                    Profile Settings
                  </span>
                </div>
              </div>

              <div
                className={`p-4 cursor-pointer ${activeTab === 'ocm-id' ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50 border-l-4 border-transparent'}`}
                onClick={() => handleTabChange('ocm-id')}
              >
                <div className="flex items-center gap-3">
                  <div className="text-amber-500">
                    <FaIdCard size={20} />
                  </div>
                  <span className={`font-medium ${activeTab === 'ocm-id' ? 'text-blue-500' : 'text-gray-600'}`}>
                    OCM-ID
                  </span>
                </div>
              </div>

              <div
                className={`p-4 cursor-pointer ${activeTab === 'password-change' ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50 border-l-4 border-transparent'}`}
                onClick={() => handleTabChange('password-change')}
              >
                <div className="flex items-center gap-3">
                  <div className="text-green-500">
                    <FaKey size={20} />
                  </div>
                  <span className={`font-medium ${activeTab === 'password-change' ? 'text-blue-500' : 'text-gray-600'}`}>
                    Password Change
                  </span>
                </div>
              </div>

              <div className="p-4 text-center border-t">
                <Link href={`/${profile?.client?.username}`} className="text-blue-500 hover:underline">
                  View Profile
                </Link>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            {renderContent()}
          </div>
        </div>
      </div>
    </FeedLayout>
  );
};

export default Settings;
