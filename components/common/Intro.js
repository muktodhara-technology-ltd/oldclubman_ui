import Link from 'next/link'
import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { getMyProfile } from '@/views/settings/store';

import { getWalletBalance } from '@/views/wallet/store';
import Weather from './Weather';
import { QRCodeSVG } from 'qrcode.react';

// Helper function to get client image URL without duplication
const getClientImageUrl = (imagePath, fallback = "/common-avator.jpg") => {
  if (!imagePath) return fallback;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  return process.env.NEXT_PUBLIC_FILE_PATH + imagePath;
};

const Intro = () => {
  const { profile } = useSelector(({ settings }) => settings)
  const { giftCardTotalValue } = useSelector(({ wallet }) => wallet)
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getMyProfile());
    dispatch(getWalletBalance());
  }, [dispatch])

  return (
    <div className="w-full">
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="flex flex-col items-center pt-6">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-blue-100 mb-5">
            <img
              src={profile?.client?.image ? process.env.NEXT_PUBLIC_FILE_PATH + profile?.client?.image : "/common-avator.jpg"}
              alt="Profile" className="w-full h-full object-cover" />
          </div>

          <h2 className="text-xl font-bold mb-5">
            {profile?.client ? profile?.client?.fname + " " + profile?.client?.last_name : "Loading..."}
          </h2>

          <div className="flex justify-between items-center w-full px-8 border-b border-b-gray-100 pb-5">
            <div className="text-center">
              <div className="font-bold text-lg">{profile?.post?.total || 0}</div>
              <div className="text-gray-500 text-sm">Post</div>
            </div>

            <div className="h-10 w-px bg-gray-200"></div>

            <div className="text-center relative">
              <div className="font-bold text-lg">{profile?.followers && profile?.followers || 0}</div>
              <div className="text-gray-500 text-sm">Followers</div>
            </div>

            <div className="h-10 w-px bg-gray-200"></div>

            <div className="text-center">
              <div className="font-bold text-lg">{profile?.following && profile?.following || 0}</div>
              <div className="text-gray-500 text-sm">Following</div>
            </div>
          </div>

          <Link href={`/${profile?.client?.username}`} className="w-full py-2 text-blue-500 text-center font-medium hover:bg-blue-50">
            View Profile
          </Link>
        </div>
      </div>

      <Weather />

      {/* QR Code Section */}
      {profile?.client?.username && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mt-1 p-4">
          <h3 className="text-sm font-semibold text-gray-700 text-center mb-3">Scan to view profile</h3>
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-lg border border-gray-100">
              <QRCodeSVG
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/${profile.client.username}`}
                size={140}
                level="H"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#1a1a2e"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">@{profile.client.username}</p>
        </div>
      )}
    </div>
  )
}

export default Intro
