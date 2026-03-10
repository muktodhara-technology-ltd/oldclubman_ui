"use client";

import React, { useEffect, useState } from "react";
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
  deleteAllNotifications,
} from "./store";
import {
  FaTrash,
  FaCheck,
  FaCheckDouble,
  FaHeart,
  FaComment,
  FaShare,
  FaCommentAlt,
  FaUserPlus,
  FaInbox,
  FaFilter,
} from "react-icons/fa";

const NotificationsView = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { openChatByConversationId } = useChatBox();
  const { notifications, loading, unreadCount, hasMore, currentPage } = useSelector(
    ({ notification }) => notification
  );
  const { allChat } = useSelector(({ chat }) => chat);
  const [activeTab, setActiveTab] = useState("all"); // all, unread
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    dispatch(getNotifications({ page: 1, perPage: 20 }));
    dispatch(getUnreadCount());
    // Load chat conversations if not already loaded
    if (!allChat || allChat.length === 0) {
      import('@/views/message/store').then(({ getAllChat }) => {
        dispatch(getAllChat());
      });
    }
  }, [dispatch, allChat]);

  const handleMarkAsRead = (notificationId) => {
    dispatch(markAsRead(notificationId));
  };

  const handleMarkAllAsRead = () => {
    dispatch(markAllAsRead());
  };

  const handleDelete = (notificationId) => {
    dispatch(deleteNotification(notificationId));
  };

  const handleDeleteAll = () => {
    dispatch(deleteAllNotifications());
    setShowDeleteConfirm(false);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      dispatch(
        getNotifications({
          page: currentPage + 1,
          perPage: 20,
          isRead: activeTab === "unread" ? false : null,
        })
      );
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    dispatch(
      getNotifications({
        page: 1,
        perPage: 20,
        isRead: tab === "unread" ? false : null,
      })
    );
  };

  const getNotificationIcon = (type) => {
    const iconProps = { size: 20 };
    switch (type) {
      case "like":
        return <FaHeart {...iconProps} className="text-red-500" />;
      case "comment":
        return <FaComment {...iconProps} className="text-blue-500" />;
      case "share":
        return <FaShare {...iconProps} className="text-green-500" />;
      case "message":
        return <FaCommentAlt {...iconProps} className="text-purple-500" />;
      case "follow":
        return <FaUserPlus {...iconProps} className="text-indigo-500" />;
      default:
        return <FaCheck {...iconProps} className="text-gray-500" />;
    }
  };

  const getImageUrl = (image) => {
    if (!image) return "/common-avator.jpg";
    if (image.startsWith("http")) return image;
    return `${process.env.NEXT_PUBLIC_FILE_PATH}${image}`;
  };

  const filteredNotifications =
    activeTab === "unread"
      ? notifications.filter((n) => !n.is_read)
      : notifications;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
              <p className="text-sm text-gray-600 mt-1">
                {unreadCount > 0
                  ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                  : "You're all caught up!"}
              </p>
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FaCheckDouble size={14} />
                  <span className="hidden sm:inline">Mark all read</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <FaTrash size={14} />
                  <span className="hidden sm:inline">Clear all</span>
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => handleTabChange("all")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === "all"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
            >
              <FaInbox size={14} />
              All ({notifications.length})
            </button>
            <button
              onClick={() => handleTabChange("unread")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === "unread"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
            >
              <FaFilter size={14} />
              Unread ({unreadCount})
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading && filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🔔</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {activeTab === "unread"
                  ? "No unread notifications"
                  : "No notifications yet"}
              </h3>
              <p className="text-gray-600">
                {activeTab === "unread"
                  ? "You're all caught up!"
                  : "When you get notifications, they'll show up here"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${!notification.is_read ? "bg-blue-50" : ""
                    }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Actor Avatar with Icon */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={getImageUrl(notification.actor?.avatar)}
                        alt={notification.actor?.fname || "User"}
                        className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "/common-avator.jpg";
                        }}
                      />
                      <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-md">
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
                            // Prefer post UUID: post.id (from API), then action_url (may have correct UUID), then post_id (may be legacy numeric)
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
                        }}
                        className="block cursor-pointer"
                      >
                        <p className="text-sm text-gray-800 font-medium mb-1">
                          {notification.title}
                        </p>
                        {notification.message && (
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                            {notification.message}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          {notification.time_ago}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Mark as read"
                        >
                          <FaCheck size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <FaTrash size={14} />
                      </button>
                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full ml-1"></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Load More Button */}
          {hasMore && filteredNotifications.length > 0 && (
            <div className="p-4 text-center border-t border-gray-100">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete All Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Clear all notifications?
            </h3>
            <p className="text-gray-600 mb-6">
              This will permanently delete all your notifications. This action cannot
              be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsView;

