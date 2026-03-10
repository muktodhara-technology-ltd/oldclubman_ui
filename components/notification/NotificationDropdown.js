"use client";

import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChatBox } from "@/contexts/ChatBoxContext";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "@/views/notification/store";
import { FaTrash, FaCheck, FaCheckDouble, FaHeart, FaComment, FaShare, FaCommentAlt, FaGift, FaMoneyBillWave } from "react-icons/fa";

const NotificationDropdown = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { openChatByConversationId } = useChatBox();
  const { notifications, loading, unreadCount } = useSelector(
    ({ notification }) => notification
  );
  const { allChat } = useSelector(({ chat }) => chat);
  const dropdownRef = useRef(null);
  const [activeTab, setActiveTab] = useState("all"); // all, unread

  useEffect(() => {
    if (isOpen) {
      dispatch(getNotifications({ page: 1, perPage: 20 }));
      // Load chat conversations if not already loaded
      if (!allChat || allChat.length === 0) {
        import('@/views/message/store').then(({ getAllChat }) => {
          dispatch(getAllChat());
        });
      }
    }
  }, [isOpen, dispatch, allChat]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleMarkAsRead = (notificationId) => {
    dispatch(markAsRead(notificationId));
  };

  const handleMarkAllAsRead = () => {
    dispatch(markAllAsRead());
  };

  const handleDelete = (notificationId) => {
    dispatch(deleteNotification(notificationId));
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "like":
        return <FaHeart className="text-red-500" />;
      case "comment":
        return <FaComment className="text-blue-500" />;
      case "share":
        return <FaShare className="text-green-500" />;
      case "message":
        return <FaCommentAlt className="text-purple-500" />;
      case "gift_card":
      case "gift_card_received":
        return <FaGift className="text-pink-500" />;
      case "wallet":
      case "wallet_transaction":
      case "deposit":
      case "withdrawal":
        return <FaMoneyBillWave className="text-green-500" />;
      default:
        return <FaCheck className="text-gray-500" />;
    }
  };

  const getImageUrl = (image) => {
    if (!image) return "/common-avator.jpg";
    if (image.startsWith('http')) return image;
    return `${process.env.NEXT_PUBLIC_FILE_PATH}${image}`;
  };

  const filteredNotifications =
    activeTab === "unread"
      ? notifications.filter((n) => !n.is_read)
      : notifications;

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-bold text-gray-800">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <FaCheckDouble size={14} />
              Mark all read
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "all"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setActiveTab("unread")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "unread"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="overflow-y-auto flex-1">
        {loading && notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="animate-pulse">Loading notifications...</div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-2">🔔</div>
            <p className="font-medium">
              {activeTab === "unread"
                ? "No unread notifications"
                : "No notifications yet"}
            </p>
            <p className="text-sm mt-1">
              When you get notifications, they'll show up here
            </p>
          </div>
        ) : (
          <div>
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${!notification.is_read ? "bg-blue-50" : ""
                  }`}
              >
                <div className="flex items-start gap-3">
                  {/* Actor Avatar */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={getImageUrl(notification.actor?.avatar)}
                      alt={notification.actor?.fname || "User"}
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "/common-avator.jpg";
                      }}
                    />
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div
                      onClick={async () => {
                        if (!notification.is_read) {
                          handleMarkAsRead(notification.id);
                        }

                        // Handle message notifications differently - open ChatBox
                        if (notification.type === 'message') {
                          // Extract conversation ID from action_url
                          const conversationId = notification.action_url?.split('conversation=')[1];
                          if (conversationId && allChat) {
                            openChatByConversationId(conversationId, allChat);
                          } else {
                            // Fallback to navigation if can't extract ID
                            router.push(notification.action_url || '/user/messages');
                          }
                        } else if (notification.type === 'like' || notification.type === 'comment') {
                          // Handle like/comment notifications - navigate to post page
                          // Prefer post UUID: post.id (from API), then action_url, then post_id (may be legacy numeric)
                          const postId =
                            notification.post?.id ||
                            notification.action_url?.match(/post\/([^/?]+)/)?.[1] ||
                            notification.post_id;
                          if (postId) {
                            router.push(`/post/${postId}`);
                          } else {
                            router.push(notification.action_url || '/');
                          }
                        } else {
                          // For other notifications, navigate normally
                          router.push(notification.action_url || '#');
                        }

                        onClose();
                      }}
                      className="cursor-pointer"
                    >
                      <p className="text-sm text-gray-800 font-medium">
                        {notification.title}
                      </p>
                      {notification.message && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {notification.time_ago}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!notification.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="text-blue-600 hover:text-blue-700 p-1"
                        title="Mark as read"
                      >
                        <FaCheck size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(notification.id)}
                      className="text-red-500 hover:text-red-600 p-1"
                      title="Delete"
                    >
                      <FaTrash size={12} />
                    </button>
                    {!notification.is_read && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-gray-200 text-center">
          <Link
            href="/user/notifications"
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            onClick={onClose}
          >
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;

