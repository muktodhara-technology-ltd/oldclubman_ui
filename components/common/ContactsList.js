"use client";
import React, { useState, useEffect } from 'react';
import { FaSearch, FaEllipsisV } from 'react-icons/fa';
import { useDispatch, useSelector } from 'react-redux';
import { getAllFollowers, getUserProfile } from '@/views/settings/store';
import { startConversation, getMessage } from '@/views/message/store';
import Link from 'next/link';
import ChatBox from './ChatBox';

// Helper function to get client image URL without duplication
const getClientImageUrl = (imagePath, fallback = "/common-avator.jpg") => {
  if (!imagePath) return fallback;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  return process.env.NEXT_PUBLIC_FILE_PATH + imagePath;
};

const ContactsList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showChatBox, setShowChatBox] = useState(false);
  const [currentChat, setCurrentChat] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const dispatch = useDispatch();
  const { myFollowers, loading, profile } = useSelector(({ settings }) => settings);

  useEffect(() => {
    dispatch(getAllFollowers());
  }, [dispatch]);

  // Transform followers data to match the expected format and filter out current user
  const contacts = myFollowers?.map(follower => ({
    id: follower.id,
    name: `${follower.follower_client?.fname || ''} ${follower.follower_client?.last_name || ''}`.trim(),
    avatar: getClientImageUrl(follower.follower_client?.image),
    isOnline: follower.follower_client?.is_online || false,
    lastSeen: follower.follower_client?.last_seen || "Unknown",
    email: follower.follower_client?.email,
    userId: follower.follower_client?.id
  })).filter(contact => contact.userId !== profile?.client?.id) || [];

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle contact click to open chat
  const handleContactClick = async (contact) => {
    try {
      const profileResponse = await dispatch(getUserProfile(contact.userId)).unwrap();
      const userData = profileResponse?.client;

      if (!userData) {
        console.error('No user data received');
        return;
      }

      const newChat = {
        is_group: 0,
        name: userData?.fname + " " + userData?.last_name,
        avatar: getClientImageUrl(userData?.image),
        user_ids: userData?.id
      };

      const conversationResponse = await dispatch(startConversation(newChat)).unwrap();

      if (conversationResponse?.conversation) {
        setCurrentChat(conversationResponse.conversation);
        setSelectedUser(userData);
        await dispatch(getMessage({ id: conversationResponse.conversation.id }));
        setShowChatBox(true);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      alert('Failed to start conversation. Please try again.');
    }
  };

  return (
    <div className="hidden ml-2 mt-2 rounded-md md:block border border-gray-200 flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-0.5">Chattings</h2>
            <p className="text-xs text-gray-600">
              {filteredContacts.filter(c => c.isOnline).length} online now
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Link
              href="/messages"
              className="p-2 hover:bg-white rounded-lg transition-all duration-200"
              title="View all messages"
            >
              <FaEllipsisV className="text-gray-600" size={16} />
            </Link>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <FaSearch className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 bg-white text-gray-700 placeholder-gray-400 text-sm shadow-sm transition-all"
          />
        </div>
      </div>

      {/* Contacts List */}
      <style jsx>{`
        .contacts-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .contacts-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .contacts-scroll::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 10px;
        }
        .contacts-scroll:hover::-webkit-scrollbar-thumb {
          background: #CBD5E0;
        }
        .contacts-scroll::-webkit-scrollbar-thumb:hover {
          background: #94A3B8;
        }
        .contacts-scroll {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
        }
        .contacts-scroll:hover {
          scrollbar-color: #CBD5E0 #F7FAFC;
        }
      `}</style>
      <div className="contacts-scroll max-h-[400px] overflow-y-auto scroll-smooth bg-gray-50">
        {loading ? (
          // Loading state
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 bg-blue-600 rounded-full animate-pulse"></div>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-4 font-medium">Loading contacts...</p>
          </div>
        ) : (
          <div className="p-3 space-y-1">
            {filteredContacts.map((contact, index) => (
              <div
                key={contact.id}
                className="flex items-center p-3 bg-white hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 rounded-xl cursor-pointer transition-all duration-200 border border-transparent hover:border-blue-200 hover:shadow-md group"
                onClick={() => handleContactClick(contact)}
              >
                {/* Avatar with Online Status */}
                <div className="relative flex-shrink-0 mr-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 ring-2 ring-white group-hover:ring-blue-200 transition-all">
                    <img
                      src={contact.avatar}
                      alt={contact.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "/common-avator.jpg";
                      }}
                    />
                  </div>
                  {/* Online Status Indicator */}
                  {contact.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
                  )}
                </div>

                {/* Contact Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                      {contact.name || 'Unknown User'}
                    </h3>
                    {contact.isOnline && (
                      <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
                        Online
                      </span>
                    )}
                  </div>
                  {contact.email && (
                    <p className="text-xs text-gray-500 truncate group-hover:text-gray-700">
                      @{contact.email.split('@')[0]}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )

        }

        {/* Empty State */}
        {!loading && filteredContacts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6 bg-white m-3 rounded-2xl border-2 border-dashed border-gray-200">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
              {searchTerm ? (
                <FaSearch className="w-8 h-8 text-blue-600" />
              ) : (
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              )}
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-2">
              {searchTerm ? 'No contacts found' : 'No followers yet'}
            </h3>
            <p className="text-sm text-gray-500 text-center max-w-[200px]">
              {searchTerm
                ? 'Try a different search term'
                : 'When people follow you, they will appear here'
              }
            </p>
          </div>
        )}
      </div>



      {/* Chat Box */}
      {showChatBox && currentChat && selectedUser && (
        <ChatBox
          user={selectedUser}
          currentChat={currentChat}
          onClose={() => {
            setShowChatBox(false);
            setCurrentChat(null);
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
};

export default ContactsList; 