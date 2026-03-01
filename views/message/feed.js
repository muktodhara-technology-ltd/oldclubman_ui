"use client";

import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FaSearch, FaUserFriends, FaSmile, FaPaperclip, FaPaperPlane,
  FaCheckCircle, FaImage, FaFile, FaFileAlt, FaFilePdf,
  FaFileWord, FaFileExcel, FaFileImage, FaFileArchive, FaFileAudio,
  FaFileVideo, FaTimesCircle, FaCommentAlt, FaAddressBook,
  FaEnvelope, FaBars, FaArrowLeft, FaDownload, FaCircle
} from 'react-icons/fa';
import { useDispatch, useSelector } from 'react-redux';
import { getAllChat, getMessage, sendMessage, startConversation, setCurrentConversation, addMessageToChat, incrementUnreadCount, clearUnreadCount } from './store';
import { getMyProfile, getUserFollowers, getUserFollowing, getUserProfile, getAllFollowers, getFollowSuggestions } from '../settings/store';
import api from '@/helpers/axios';
import toast from 'react-hot-toast';
import { useChatPusher } from '@/components/custom/useChatPusher';
import { useOnlineStatus } from '@/components/custom/useOnlineStatus';
import { OnlineStatusToggle } from '@/components/custom/OnlineStatusToggle';
import { useTypingIndicator } from '@/components/custom/useTypingIndicator';
import { TypingIndicator, TypingText } from '@/components/custom/TypingIndicator';
import { MessageNotificationContainer } from '@/components/custom/MessageNotification';
import { pusherService } from '@/utility/pusher';
import { ClientSegmentRoot } from 'next/dist/client/components/client-segment';
import moment from 'moment';
import ChatPostPreview from '@/components/common/ChatPostPreview';

const MessagingContentInner = () => {
  const searchParams = useSearchParams();
  const { allChat, prevChat, convarsationData, unreadCounts } = useSelector(({ chat }) => chat);
  const { userFollowers, profile, userProfileData, myFollowers } = useSelector(({ settings }) => settings);
  const dispatch = useDispatch();

  // Online status tracking
  const { isUserOnline, onlineUsers, appearOnline, toggleOnlineStatus } = useOnlineStatus();

  // State for active chats
  const [currentChat, setCurrentChat] = useState(null);
  const [activeTab, setActiveTab] = useState('chats');
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);
  const [allContacts, setAllContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true); // Mobile: show sidebar or chat
  const [notifications, setNotifications] = useState([]); // Message notifications
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Debug: Log notifications changes
  useEffect(() => {
    console.log('📊 Notifications state:', notifications);
  }, [notifications]);

  // Initialize Pusher service when component mounts
  useEffect(() => {
    pusherService.initialize();

    // Request notification permission (for browser notifications)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      pusherService.disconnect();
    };
  }, []);

  // Initial data fetching
  useEffect(() => {
    dispatch(getAllChat());
    dispatch(getMyProfile());
  }, [dispatch]);

  // Typing indicator
  const {
    handleTyping,
    handleStopTyping,
    isAnyoneTyping
  } = useTypingIndicator(currentChat?.id, profile?.client?.id);

  // Handle window resize - show sidebar on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setShowSidebar(true);
      } else if (!currentChat) {
        // On mobile, show sidebar if no chat is selected
        setShowSidebar(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentChat]);

  // Show sidebar on mobile when no chat is selected
  useEffect(() => {
    if (window.innerWidth < 768 && !currentChat) {
      setShowSidebar(true);
    }
  }, [currentChat]);

  // Fetch all contacts when contacts tab is active
  useEffect(() => {
    const fetchAllContacts = async () => {
      if (activeTab === 'contacts') {
        setContactsLoading(true);
        try {
          // Fetch "who to follow" users
          const whoToFollowRes = await dispatch(getFollowSuggestions(1)).unwrap();

          const contactsMap = new Map();
          const currentUserId = profile?.client?.id;

          // Add users from "who to follow"
          if (whoToFollowRes && Array.isArray(whoToFollowRes)) {
            whoToFollowRes.forEach(user => {
              const userId = user.id;
              if (userId && userId !== currentUserId) {
                contactsMap.set(userId, {
                  id: userId,
                  name: `${user.fname || ''} ${user.last_name || ''}`.trim(),
                  avatar: user.image
                    ? `${process.env.NEXT_PUBLIC_FILE_PATH}${user.image}`
                    : "/common-avator.jpg",
                  isOnline: user.is_online || false,
                  userId: userId,
                  source: 'suggestion'
                });
              }
            });
          }

          // If search term exists, search for users
          if (searchTerm && searchTerm.length >= 2) {
            try {
              const searchResponse = await api.get(`/client/search_by_people?search=${encodeURIComponent(searchTerm)}`);
              const searchResults = searchResponse.data?.data?.follow_connections || [];

              // Clear existing contacts and only show search results
              contactsMap.clear();

              searchResults.forEach(result => {
                const userId = result.id;
                if (userId && userId !== currentUserId) {
                  contactsMap.set(userId, {
                    id: userId,
                    name: `${result.fname || ''} ${result.last_name || ''}`.trim(),
                    avatar: result.image
                      ? `${process.env.NEXT_PUBLIC_FILE_PATH}${result.image}`
                      : "/common-avator.jpg",
                    isOnline: result.is_online || false,
                    userId: userId,
                    source: 'search'
                  });
                }
              });
            } catch (searchError) {
              console.error('Search error:', searchError);
            }
          }

          setAllContacts(Array.from(contactsMap.values()));
        } catch (error) {
          console.error('Error fetching contacts:', error);
        } finally {
          setContactsLoading(false);
        }
      }
    };

    fetchAllContacts();
  }, [activeTab, dispatch, profile?.client?.id, searchTerm]);

  // Handle chat selection
  const handleChatSelect2 = useCallback(async (conversation) => {
    try {
      // Get the other user in the conversation (not the current user)
      const otherUser = conversation?.users?.find(user => String(user.id) !== String(profile?.client?.id));

      // Construct the display name from the other user
      const displayName = otherUser
        ? `${otherUser.fname || ''} ${otherUser.last_name || ''}`.trim() || otherUser.display_name || otherUser.username || 'Unknown User'
        : conversation?.name || 'Unknown User';

      // Get avatar from the other user
      const displayAvatar = otherUser?.image
        ? getImageUrl(otherUser.image)
        : conversation?.avatar || "/common-avator.jpg";

      // Enhanced conversation object with correct display data
      const enhancedConversation = {
        ...conversation,
        name: displayName,
        avatar: displayAvatar,
        isOnline: otherUser?.is_online || false,
        _otherUser: otherUser // Store for reference
      };

      setCurrentChat(enhancedConversation);

      // Clear unread count for this conversation
      dispatch(clearUnreadCount(conversation.id));

      const response = await dispatch(getMessage({ id: conversation.id })).unwrap();

      if (response) {
        // On mobile, hide sidebar and show chat
        if (window.innerWidth < 768) {
          setShowSidebar(false);
        }
      }
    } catch (error) {
      console.error('Error loading chat messages:', error);
    }
  }, [dispatch, profile?.client?.id]);

  // Handle conversation query parameter (from product page redirect or notification)
  useEffect(() => {
    const conversationId = searchParams?.get('conversation');
    if (conversationId && allChat && allChat.length > 0) {
      // Compare as strings since conversation IDs are UUIDs
      const conversation = allChat.find(chat => String(chat.id) === String(conversationId));
      if (conversation) {
        handleChatSelect2(conversation);
      }
    }
  }, [searchParams, allChat, handleChatSelect2]);

  // Handle new message received via Pusher
  const handleMessageReceived = useCallback((data) => {
    // Compare as strings since they're UUIDs
    if (String(data.conversation_id) === String(convarsationData?.id)) {
      // Add the message directly instead of refetching all messages
      if (data.message) {
        dispatch(addMessageToChat(data.message));
        // Scroll to bottom
        setTimeout(() => {
          scrollToBottom();
        }, 50);
      }
    } else {
      // Message for a different conversation - increment unread count
      if (data.message && data.conversation_id) {
        dispatch(incrementUnreadCount(data.conversation_id));
      }
    }
  }, [convarsationData?.id, dispatch]);

  // Handle typing event
  // DON'T sync convarsationData to currentChat - keep them separate!
  // currentChat holds the display data (name, avatar, isOnline)
  // convarsationData holds the conversation ID for messaging
  // This prevents Redux updates from overwriting our carefully set display data


  // Subscribe to current conversation for real-time messages
  useChatPusher(
    convarsationData?.id,
    handleMessageReceived,
    handleTyping
  );

  // Subscribe to ALL conversations for unread counts
  useEffect(() => {
    console.log('🔔 Setting up notification subscriptions...', {
      allChatLength: allChat?.length,
      currentConv: convarsationData?.id,
      hasPusher: !!pusherService.pusher
    });

    if (!allChat || allChat.length === 0 || !pusherService.pusher) {
      console.log('🔔 Cannot subscribe: missing data');
      return;
    }

    const subscriptions = [];

    allChat.forEach(chat => {
      if (chat.id && chat.id !== convarsationData?.id) {
        const channelName = `private-conversation.${chat.id}`;
        console.log(`🔔 Subscribing to ${channelName} for notifications`);
        const channel = pusherService.pusher.subscribe(channelName);

        const messageHandler = (data) => {
          console.log(`🔔 Message received on ${channelName}:`, data);

          if (data.message) {
            dispatch(incrementUnreadCount(chat.id));

            // Show notification
            const otherUser = chat?.users?.find(user => String(user.id) !== String(profile?.client?.id));
            const senderName = otherUser
              ? `${otherUser.fname || ''} ${otherUser.last_name || ''}`.trim() || 'Unknown User'
              : chat?.name || 'Unknown User';
            const senderAvatar = otherUser?.image
              ? getImageUrl(otherUser.image)
              : chat?.avatar || '/common-avator.jpg';

            console.log('🔔 Calling showNotification with:', {
              chatId: chat.id,
              message: data.message,
              senderInfo: { name: senderName, avatar: senderAvatar }
            });

            showNotification(chat.id, data.message, {
              name: senderName,
              avatar: senderAvatar
            });
          }
        };

        channel.bind('MessageSent', messageHandler);
        subscriptions.push({ channel, handler: messageHandler });
      }
    });

    console.log(`🔔 Subscribed to ${subscriptions.length} conversation(s) for notifications`);

    return () => {
      console.log('🔔 Cleaning up notification subscriptions');
      subscriptions.forEach(({ channel, handler }) => {
        channel.unbind('MessageSent', handler);
      });
    };
  }, [allChat, convarsationData?.id, dispatch, profile]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [prevChat]);

  // Filter chats based on search term
  const filteredChats = allChat?.filter(chat =>
    chat.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter contacts based on search term
  const filteredContacts = allContacts?.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];


  // Handle contact selection - using the same robust logic from FeedHeader
  const handleContactSelect = async (contactId) => {
    try {
      const profileResponse = await dispatch(getUserProfile(contactId)).unwrap();
      const userData = profileResponse?.client;

      if (!userData) {
        console.error('No user data received');
        toast.error('User data not available');
        return;
      }

      // Don't allow messaging yourself
      if (contactId === profile?.client?.id) {
        toast.error("You cannot message yourself");
        return;
      }

      // Helper function to find conversation by user ID
      const findConversationByUserId = (chats, userId) => {
        if (!chats || !Array.isArray(chats)) return null;

        return chats.find(chat => {
          if (chat.user_ids) {
            const userIds = Array.isArray(chat.user_ids) ? chat.user_ids : [chat.user_ids];
            if (userIds.some(id => Number(id) === Number(userId))) return true;
          }
          if (chat.participants?.some(p =>
            Number(p.id) === Number(userId) ||
            Number(p.user_id) === Number(userId) ||
            Number(p.client_id) === Number(userId)
          )) return true;
          if (chat.other_user && (
            chat.other_user.id === Number(userId) ||
            chat.other_user.user_id === Number(userId) ||
            chat.other_user.client_id === Number(userId)
          )) return true;
          return false;
        });
      };

      // First, check if conversation already exists
      let conversation = null;

      try {
        const allChats = await dispatch(getAllChat()).unwrap();
        conversation = findConversationByUserId(allChats, userData.id);

        if (!conversation) {
          const directResponse = await api.get('/chat');
          const directChats = directResponse.data?.data || directResponse.data || [];
          conversation = findConversationByUserId(directChats, userData.id);
        }
      } catch (e) {
        console.error('Error fetching chats:', e);
      }

      // If conversation doesn't exist, create it
      if (!conversation) {
        const newChat = {
          is_group: 0,
          name: `${userData.fname} ${userData.last_name}`,
          avatar: userData?.image ? process.env.NEXT_PUBLIC_FILE_PATH + userData.image : "/common-avator.jpg",
          user_ids: userData.id
        };

        try {
          const createResponse = await api.post('/chat', newChat);

          // Handle different response structures
          if (createResponse.data?.data?.conversation?.id) {
            conversation = createResponse.data.data.conversation;
          } else if (createResponse.data?.data?.id) {
            conversation = { id: createResponse.data.data.id };
          } else if (createResponse.data?.conversation?.id) {
            conversation = createResponse.data.conversation;
          } else if (createResponse.data?.id) {
            conversation = { id: createResponse.data.id };
          } else if (createResponse.data?.data) {
            const data = createResponse.data.data;
            if (data.id) {
              conversation = { id: data.id };
            } else if (typeof data === 'object' && Object.keys(data).length > 0) {
              conversation = data;
            }
          }

          if (conversation?.id) {
            await dispatch(getAllChat());
          } else {
            const refreshedChats = await dispatch(getAllChat()).unwrap();
            conversation = findConversationByUserId(refreshedChats, userData.id);
          }
        } catch (err) {
          // Handle "conversation already exists" error
          const errorStatus = err?.response?.status;
          const errorMessage = err?.response?.data?.message || '';
          const isAlreadyExistsError =
            errorStatus === 400 &&
            (errorMessage.toLowerCase().includes("already exists") ||
              errorMessage.toLowerCase().includes("conversation"));

          if (isAlreadyExistsError) {
            // Try to extract conversation ID from error or refresh and find it
            const errorData = err?.response?.data;
            let convId = errorData?.data?.conversation_id ||
              errorData?.data?.id ||
              errorData?.conversation_id ||
              errorData?.id ||
              errorData?.conversation?.id ||
              errorData?.data?.conversation?.id;

            if (!convId && errorMessage) {
              const idMatch = errorMessage.match(/conversation[_\s]*id[:\s]*(\d+)/i) ||
                errorMessage.match(/id[:\s]*(\d+)/i);
              if (idMatch) {
                convId = idMatch[1];
              }
            }

            if (convId) {
              conversation = { id: Number(convId) };
            } else {
              // Refresh and find it
              const updatedChats = await dispatch(getAllChat()).unwrap();
              conversation = findConversationByUserId(updatedChats, userData.id);

              if (!conversation) {
                const directResponse = await api.get('/chat');
                const directChats = directResponse.data?.data || directResponse.data || [];
                conversation = findConversationByUserId(directChats, userData.id);
              }
            }
          } else {
            toast.error(err?.response?.data?.message || 'Failed to start conversation. Please try again.');
            return;
          }
        }
      }

      // If we have a conversation, open it
      if (conversation?.id) {
        // Enrich conversation with user data if not already present
        const enrichedConversation = {
          ...conversation,
          name: conversation.name || `${userData.fname} ${userData.last_name}`,
          avatar: conversation.avatar || (userData?.image ? process.env.NEXT_PUBLIC_FILE_PATH + userData.image : "/common-avator.jpg"),
          isOnline: userData.is_online || false,
          user_ids: conversation.user_ids || userData.id
        };

        setCurrentChat(enrichedConversation);
        try {
          await dispatch(getMessage({ id: conversation.id }));
          setActiveTab('chats'); // Switch to chats tab to show the conversation
          // On mobile, hide sidebar and show chat
          if (window.innerWidth < 768) {
            setShowSidebar(false);
          }
        } catch (msgError) {
          console.error('Error loading messages:', msgError);
          // Still set current chat even if messages fail
          setCurrentChat(enrichedConversation);
          setActiveTab('chats');
          // On mobile, hide sidebar and show chat
          if (window.innerWidth < 768) {
            setShowSidebar(false);
          }
        }
      } else {
        // Create minimal conversation object for pending conversation
        const minimalConversation = {
          id: null,
          user_ids: userData.id,
          name: `${userData.fname} ${userData.last_name}`,
          avatar: userData?.image ? process.env.NEXT_PUBLIC_FILE_PATH + userData.image : "/common-avator.jpg",
          is_group: 0,
          _userData: userData,
          _pendingConversation: true
        };

        setCurrentChat(minimalConversation);
        setActiveTab('chats');
        // On mobile, hide sidebar and show chat
        if (window.innerWidth < 768) {
          setShowSidebar(false);
        }
        toast.success('Opening conversation. You can now send a message.');
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error('Failed to start conversation. Please try again.');
    }
  };

  // Get file icon based on type
  const getFileIcon = (fileName) => {
    const extension = fileName?.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return <FaFilePdf className="text-red-500" size={28} />;
      case 'doc':
      case 'docx':
        return <FaFileWord className="text-blue-500" size={28} />;
      case 'xls':
      case 'xlsx':
        return <FaFileExcel className="text-green-500" size={28} />;
      case 'ppt':
      case 'pptx':
        return <FaFileAlt className="text-orange-500" size={28} />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'svg':
        return <FaFileImage className="text-purple-500" size={28} />;
      case 'zip':
      case 'rar':
      case '7z':
        return <FaFileArchive className="text-yellow-600" size={28} />;
      case 'mp3':
      case 'wav':
      case 'ogg':
        return <FaFileAudio className="text-pink-500" size={28} />;
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
        return <FaFileVideo className="text-indigo-500" size={28} />;
      case 'txt':
      case 'csv':
        return <FaFileAlt className="text-gray-500" size={28} />;
      default:
        return <FaFileAlt className="text-gray-400" size={28} />;
    }
  };

  // Parse file information from message
  const parseMessageFile = (message) => {
    // If already has file object, return it
    if (message.file) return message.file;

    // Parse file_name JSON if it exists
    if (message.file_name) {
      try {
        const files = typeof message.file_name === 'string'
          ? JSON.parse(message.file_name)
          : message.file_name;

        // Return first file from array
        if (Array.isArray(files) && files.length > 0) {
          const fileInfo = files[0];
          return {
            name: fileInfo.file_name || fileInfo.name,
            path: fileInfo.path,
            size: fileInfo.file_size || fileInfo.size,
            type: fileInfo.mime_type || fileInfo.type
          };
        }
      } catch (e) {
        console.error('Error parsing file_name:', e);
        return null;
      }
    }

    return null;
  };

  // Check if file is an image
  const isImageFile = (fileName) => {
    const extension = fileName?.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension);
  };

  // Get image URL with proper path
  const getImageUrl = (imagePath) => {
    if (!imagePath) return '/common-avator.jpg';

    // If it's already a full URL (http:// or https://), return as-is
    if (/^https?:\/\//i.test(imagePath)) {
      return imagePath;
    }

    // Clean up malformed paths that start with domain name or dots
    let cleanPath = imagePath;

    // Remove leading dots and domain names (e.g., ".oldclubman.com/" or "oldclubman.com/")
    cleanPath = cleanPath.replace(/^\.?[a-zA-Z0-9.-]+\.(com|net|org|io)(\/|$)/i, '');

    // Remove leading /api/ if present
    cleanPath = cleanPath.replace(/^\/api\//, '');

    // Remove leading slashes
    cleanPath = cleanPath.replace(/^\/+/, '');

    // Get base URL without /api suffix and remove trailing slashes
    const apiUrl = (process.env.NEXT_PUBLIC_FILE_PATH || '').replace(/\/+$/, '');
    // const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/api\/?$/, '');

    // Construct final URL with single slash between base URL and path
    const fullUrl = `${apiUrl}/${cleanPath}`;

    console.log('🖼️ Image URL:', { original: imagePath, cleaned: cleanPath, final: fullUrl });
    return fullUrl;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  // Show notification for new message
  const showNotification = (conversationId, message, senderInfo) => {
    console.log('🔔 showNotification called:', { conversationId, message, senderInfo });

    const notificationId = `notif-${Date.now()}`;
    const messagePreview = message?.content || (message?.type === 'file' ? '📎 Sent a file' : 'New message');

    const newNotification = {
      id: notificationId,
      conversationId,
      senderName: senderInfo?.name || 'Unknown User',
      avatar: senderInfo?.avatar || '/common-avator.jpg',
      messagePreview,
      timestamp: new Date()
    };

    console.log('🔔 Creating notification:', newNotification);

    // Add to toast notifications
    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, 5);
      console.log('🔔 Notifications state updated:', updated);
      return updated;
    });

    // Also show browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotif = new Notification(senderInfo?.name || 'New Message', {
        body: messagePreview,
        icon: senderInfo?.avatar || '/common-avator.jpg',
        tag: conversationId, // Prevents duplicate notifications for same conversation
        requireInteraction: false
      });

      // Click to open chat
      browserNotif.onclick = () => {
        window.focus();
        const chat = allChat.find(c => c.id === conversationId);
        if (chat) {
          handleChatSelect2(chat);
        }
        browserNotif.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => browserNotif.close(), 5000);
    }
  };

  // Close notification
  const closeNotification = (notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  // Handle notification click - open that chat
  const handleNotificationClick = (notification) => {
    const chat = allChat.find(c => c.id === notification.conversationId);
    if (chat) {
      handleChatSelect2(chat);
    }
    closeNotification(notification.id);
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedFile) return;

    if (!convarsationData?.id) {
      toast.error('Please select a conversation first');
      return;
    }

    const messageContent = newMessage.trim();
    const fileToSend = selectedFile;

    // Determine message type based on file
    let optimisticMessageType = 'text';
    if (selectedFile) {
      if (selectedFile.type.startsWith('image/')) {
        optimisticMessageType = 'image';
      } else if (selectedFile.type.startsWith('video/')) {
        optimisticMessageType = 'video';
      } else {
        optimisticMessageType = 'file';
      }
    }

    // Create optimistic message for instant display
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      content: messageContent,
      user_id: profile?.client?.id,
      conversation_id: convarsationData.id,
      type: optimisticMessageType,
      created_at: new Date().toISOString(),
      user: {
        id: profile?.client?.id,
        fname: profile?.client?.fname,
        last_name: profile?.client?.last_name,
        image: profile?.client?.image
      },
      _optimistic: true
    };

    // Add file info to optimistic message if file is being sent
    if (selectedFile) {
      optimisticMessage.file_name = JSON.stringify([{
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        // For images, we can use the preview
        url: filePreview || null
      }]);
    }

    console.log('🚀 Adding optimistic message:', {
      id: optimisticMessage.id,
      user_id: optimisticMessage.user_id,
      currentUserId: profile?.client?.id,
      shouldShowOnRight: optimisticMessage.user_id === profile?.client?.id
    });

    try {
      // Determine file type: image, video, or file
      let messageType = "text";
      if (selectedFile) {
        // Check if it's an image
        if (selectedFile.type.startsWith('image/')) {
          messageType = "image";
        } else if (selectedFile.type.startsWith('video/')) {
          messageType = "video";
        } else {
          messageType = "file";
        }
      }

      const chatData = {
        chatId: convarsationData.id,
        type: messageType,
        content: messageContent,
        file: selectedFile,
        onProgress: (progress) => {
          setUploadProgress(progress);
        }
      };

      console.log('📤 Sending message with file:', selectedFile?.name, selectedFile?.type, selectedFile?.size);

      // Clear message input immediately
      setNewMessage("");
      if (selectedFile) {
        setSelectedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }

      // Add optimistic message immediately
      dispatch(addMessageToChat(optimisticMessage));

      // Scroll to bottom
      setTimeout(() => {
        scrollToBottom();
      }, 50);

      // Send to server
      const response = await dispatch(sendMessage(chatData)).unwrap();
      console.log('✅ Message sent successfully:', response);

      // Reset upload progress
      setUploadProgress(0);

    } catch (error) {
      console.error('❌ Error sending message:', error);
      console.error('Error details:', error.response?.data || error.message);

      // Reset upload progress on error
      setUploadProgress(0);
      toast.error(error.message || 'Failed to send message. Please try again.');
      // Restore message if failed
      if (messageContent) {
        setNewMessage(messageContent);
      }
      if (fileToSend) {
        setSelectedFile(fileToSend);
      }
    }
  };

  // Handle paste event
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;

    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = items[i].getAsFile();

          if (file) {
            // Check file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
              toast.error('File size must be less than 10MB');
              return;
            }

            setSelectedFile(file);
            toast.success(`Image pasted: ${file.name}`);

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
              setFilePreview(reader.result);
            };
            reader.readAsDataURL(file);

            // Allow only one file for now
            return;
          }
        }
      }
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      e.target.value = ''; // Clear the file input
      return;
    }

    // Expanded allowed file types
    const allowedTypes = [
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Text files
      'text/plain',
      'text/csv',
      // Archives
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      // Audio/Video
      'audio/mpeg',
      'audio/mp3',
      'video/mp4',
      'video/mpeg'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('File type not supported. Supported types: Images, PDF, Word, Excel, PowerPoint, Text, ZIP, Audio, Video');
      e.target.value = '';
      return;
    }

    // Create preview URL for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target.result);
        setSelectedFile(file);
        toast.success(`File selected: ${file.name}`);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
      setSelectedFile(file);
      toast.success(`File selected: ${file.name}`);
    }
  };

  // Download file
  const handleFileDownload = async (fileUrl, fileName) => {
    try {
      // Try direct download first (works for same-origin or CORS-enabled files)
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName || 'download';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file. Please try opening in a new tab.');
    }
  };

  // Remove selected file
  const removeSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Open image modal
  const openImageModal = (imageUrl) => {
    setSelectedImageUrl(imageUrl);
    setImageModalOpen(true);
  };

  // Close image modal
  const closeImageModal = () => {
    setImageModalOpen(false);
    setSelectedImageUrl(null);
  };

  // Close modal on ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && imageModalOpen) {
        closeImageModal();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [imageModalOpen]);

  // Handle key press to send message
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle input change and send typing event
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);

    // Trigger typing indicator
    if (e.target.value.length > 0) {
      handleTyping();
    } else {
      handleStopTyping();
    }
  };

  // Tab switching
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchTerm('');
    if (tab === "chats") {
      dispatch(getAllChat());
    }
    // Contacts are fetched automatically in useEffect when activeTab changes
  };

  // Effect to scroll to bottom when messages change
  useEffect(() => {
    if (prevChat?.length > 0) {
      scrollToBottom();
    }
  }, [prevChat]);

  // REMOVED: This was overwriting currentChat with convarsationData
  // currentChat is set by handleChatSelect2 and handleContactSelect with full user data
  // convarsationData is just for messaging ID - they should stay separate!


  // Sync currentChat to convarsationData for message sending
  useEffect(() => {
    if (currentChat?.id && currentChat?.id !== convarsationData?.id) {
      dispatch(setCurrentConversation(currentChat));
    }
  }, [currentChat, convarsationData?.id, dispatch]);


  // Removed unused filteredChatsUsers - was causing error when profile.client is undefined
  // const filteredChatsUsers = allChat?.map(mp => mp?.user_id === mp.users?.filter(ddd => ddd?.id === Number(profile?.client?.id)))

  return (
    <>
      {/* Message Notifications */}
      <MessageNotificationContainer
        notifications={notifications}
        onClose={closeNotification}
        onClick={handleNotificationClick}
      />

      <div className="h-full w-full overflow-hidden bg-gray-50" style={{ height: '100%' }}>
        <div className="bg-white h-full w-full shadow-lg overflow-hidden rounded-lg" style={{ height: '100%', maxHeight: '100vh' }}>
          <div className="flex h-full w-full overflow-hidden" style={{ height: '100%' }}>
            {/* Left Sidebar */}
            <div className={`flex flex-col border-r border-gray-200 ${showSidebar ? 'block' : 'hidden'} md:block ${showSidebar ? 'w-full md:w-auto' : ''} absolute md:relative z-30 md:z-auto bg-white h-full`}>

              {/* Content area */}
              <div className="w-full sm:w-80 flex flex-col bg-gray-50 h-full overflow-hidden">
                {/* Tabs */}
                <div className="flex items-center justify-center gap-3 p-3 bg-gradient-to-r from-blue-600 to-blue-700 border-b border-blue-800">
                  <button
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all duration-200 ${activeTab === 'chats'
                      ? 'bg-white text-blue-600 shadow-lg'
                      : 'bg-blue-500 bg-opacity-50 text-white hover:bg-opacity-70'
                      }`}
                    onClick={() => handleTabChange('chats')}
                  >
                    <FaCommentAlt className="w-4 h-4" />
                    <span className="text-sm">Chats</span>
                  </button>
                  <button
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all duration-200 ${activeTab === 'contacts'
                      ? 'bg-white text-blue-600 shadow-lg'
                      : 'bg-blue-500 bg-opacity-50 text-white hover:bg-opacity-70'
                      }`}
                    onClick={() => handleTabChange('contacts')}
                  >
                    <FaUserFriends className="w-4 h-4" />
                    <span className="text-sm">Contacts</span>
                  </button>
                </div>

                {/* Online Status Control */}
                <div className="p-3 bg-white border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FaCircle className={`text-xs ${appearOnline ? 'text-green-500' : 'text-gray-400'}`} />
                    <span className="text-sm text-gray-600">Your Status:</span>
                  </div>
                  <OnlineStatusToggle
                    isOnline={appearOnline}
                    onToggle={toggleOnlineStatus}
                  />
                </div>

                {/* Search */}
                <div className="p-4 md:p-5 bg-white border-b border-gray-200">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaSearch className="text-gray-400 text-sm" />
                    </div>
                    <input
                      type="text"
                      placeholder={activeTab === 'chats' ? "Search conversations..." : "Search contacts..."}
                      className="bg-gray-100 w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200 border border-transparent hover:border-gray-300"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                {/* Chats List */}
                {activeTab === 'chats' && (
                  <div className="overflow-y-auto flex-1 bg-white">
                    {allChat?.length > 0 ? (
                      allChat?.map(chat => {
                        // Get the other user in the conversation (not the current user)
                        const otherUser = chat?.users?.find(user => String(user.id) !== String(profile?.client?.id))

                        // Construct the display name from the other user
                        const displayName = otherUser
                          ? `${otherUser.fname || ''} ${otherUser.last_name || ''}`.trim() || otherUser.display_name || otherUser.username || 'Unknown User'
                          : chat?.name || 'Unknown User';

                        // Get avatar from the other user
                        const displayAvatar = otherUser?.image
                          ? getImageUrl(otherUser.image)
                          : chat?.avatar || "/common-avator.jpg";

                        const unreadCount = unreadCounts[chat?.id] || 0;

                        return (
                          <div
                            key={chat?.id}
                            className={`flex items-center p-3 md:p-4 border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-all duration-200 ${chat?.id === currentChat?.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'
                              }`}
                            onClick={() => handleChatSelect2(chat)}
                          >
                            <div className="relative mr-3 flex-shrink-0">
                              {displayAvatar && displayAvatar !== "/common-avator.jpg" ? (
                                <div className="w-11 h-11 md:w-12 md:h-12 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600 shadow-md ring-2 ring-white">
                                  <img
                                    src={displayAvatar}
                                    alt={displayName}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.src = '/common-avator.jpg';
                                      e.target.onerror = null;
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm md:text-base font-semibold shadow-md ring-2 ring-white">
                                  {(displayName || 'U').charAt(0).toUpperCase()}
                                </div>
                              )}
                              {isUserOnline(otherUser?.id) && (
                                <div className="absolute bottom-0 right-0 w-3 h-3 md:w-3.5 md:h-3.5 bg-green-500 rounded-full border-2 border-white shadow-md"></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                <h3 className="text-sm md:text-base font-semibold text-gray-800 truncate">{displayName}</h3>
                                <span className="text-[10px] md:text-xs text-gray-400 ml-2 font-medium">{chat?.time}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <p className="text-xs md:text-sm text-gray-500 truncate flex-1">{chat?.message}</p>
                                {unreadCount > 0 && (
                                  <span className="ml-2 bg-blue-500 text-white text-[10px] md:text-xs rounded-full min-w-[18px] h-[18px] md:min-w-[20px] md:h-5 flex items-center justify-center px-1.5 font-semibold shadow-sm">
                                    {unreadCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 text-gray-400">
                        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                          <FaEnvelope className="text-4xl text-gray-300" />
                        </div>
                        <p className="text-base font-medium text-gray-500">No conversations yet</p>
                        <p className="text-sm text-gray-400 mt-1">Start a new conversation from contacts</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Contacts List */}
                {activeTab === 'contacts' && (
                  <div className="overflow-y-auto flex-1 bg-white">
                    {contactsLoading ? (
                      <div className="flex flex-col items-center justify-center p-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
                        <p className="mt-4 text-gray-500 font-medium">Loading contacts...</p>
                      </div>
                    ) : filteredContacts.length > 0 ? (
                      filteredContacts.map(contact => (
                        <div
                          key={contact.id}
                          className="flex items-center p-3 md:p-4 border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-all duration-200 group"
                          onClick={() => handleContactSelect(contact.userId)}
                        >
                          <div className="relative mr-3 flex-shrink-0">
                            <div className="w-11 h-11 md:w-12 md:h-12 rounded-full overflow-hidden bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-sm md:text-base font-semibold shadow-md ring-2 ring-white group-hover:ring-blue-200 transition-all">
                              {contact.avatar && contact.avatar !== "/common-avator.jpg" ? (
                                <img
                                  src={contact.avatar}
                                  alt={contact.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.src = '/common-avator.jpg';
                                    e.target.onerror = null;
                                  }}
                                />
                              ) : (
                                <span>{contact.name.charAt(0) || 'U'}</span>
                              )}
                            </div>
                            {isUserOnline(contact.userId) && (
                              <div className="absolute bottom-0 right-0 w-3 h-3 md:w-3.5 md:h-3.5 bg-green-500 rounded-full border-2 border-white shadow-md"></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm md:text-base font-semibold text-gray-800 truncate">
                              {contact.name || 'Unknown User'}
                            </h3>
                            <p className="text-xs md:text-sm text-gray-500 truncate flex items-center">
                              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${isUserOnline(contact.userId) ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                              {isUserOnline(contact.userId) ? 'Online' : 'Offline'}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 text-gray-400">
                        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                          <FaAddressBook className="text-4xl text-gray-300" />
                        </div>
                        <p className="text-base font-medium text-gray-500">{searchTerm ? 'No contacts found' : 'No contacts available'}</p>
                        {!searchTerm && (
                          <p className="text-sm text-gray-400 mt-1">Start following people to see them here</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col ${!showSidebar ? 'flex' : 'hidden'} md:flex w-full bg-gray-50`} style={{ height: '100%' }}>
              {/* Chat Header */}
              <div className="px-4 md:px-6 py-4 md:py-5 border-b border-gray-200 bg-white flex items-center justify-between shadow-sm shrink-0">
                <div className="flex items-center flex-1 min-w-0">
                  {/* Back button for mobile */}
                  <button
                    onClick={() => setShowSidebar(true)}
                    className="md:hidden mr-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Back to chats"
                  >
                    <FaArrowLeft className="text-gray-600 w-5 h-5" />
                  </button>
                  <div className="relative mr-3 md:mr-4 flex-shrink-0">
                    {currentChat?.avatar || userProfileData?.client?.image ? (
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600 shadow-md ring-2 ring-white">
                        <img
                          src={currentChat?.avatar || getImageUrl(userProfileData?.client?.image)}
                          alt={currentChat?.name || userProfileData?.client?.fname || 'User'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = '/common-avator.jpg';
                            e.target.onerror = null;
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm md:text-base font-semibold shadow-md ring-2 ring-white">
                        {(currentChat?.name || userProfileData?.client?.fname || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    {currentChat?._otherUser && isUserOnline(currentChat._otherUser.id) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 md:w-3.5 md:h-3.5 bg-green-500 rounded-full border-2 border-white shadow-md"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base md:text-lg font-bold text-gray-900 truncate">
                      {currentChat ? (currentChat.name || 'Unknown User') : 'Select a chat'}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                      {currentChat ? (
                        isAnyoneTyping ? (
                          <TypingText userName={currentChat.name} />
                        ) : (
                          <>
                            <span className={`inline-block w-2 h-2 rounded-full ${currentChat?._otherUser && isUserOnline(currentChat._otherUser.id) ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                            <span className="font-medium">{currentChat?._otherUser && isUserOnline(currentChat._otherUser.id) ? 'Active now' : 'Offline'}</span>
                          </>
                        )
                      ) : (
                        <span className="font-medium text-gray-400">No chat selected</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6 bg-gradient-to-b from-gray-50 to-gray-100" style={{ minHeight: 0 }}>
                {!currentChat ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-100 to-blue-200 flex items-center justify-center mb-6 shadow-inner">
                      <FaCommentAlt className="text-purple-400 text-6xl" />
                    </div>
                    <p className="text-xl font-bold text-gray-600 mb-2">Welcome to Messages</p>
                    <p className="text-sm text-gray-400 mb-6 text-center max-w-sm">
                      Select a conversation from your chats or choose a contact to start messaging
                    </p>
                    <button
                      onClick={() => setActiveTab('contacts')}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      Browse Contacts
                    </button>
                  </div>
                ) : prevChat?.length > 0 ? (
                  <div className="space-y-2 md:space-y-3">
                    {prevChat?.map((message, index) => {
                      // Simple and clear ID comparison
                      const messageSenderId = String(message.user_id || message.user?.id || '');
                      const currentUserId = String(profile?.client?.id || '');
                      const isCurrentUser = messageSenderId === currentUserId;

                      // Group messages from the same user
                      const prevMessageSenderId = index > 0 ?
                        String(prevChat[index - 1]?.user_id || prevChat[index - 1]?.user?.id || '')
                        : null;
                      const isSameUser = index > 0 && prevMessageSenderId === messageSenderId;

                      // Parse file information
                      const fileInfo = parseMessageFile(message);

                      // Debug logging for file/image/video messages
                      if (message.type === 'file' || message.type === 'image' || message.type === 'video') {
                        console.log('📎 File/Image/Video message:', {
                          id: message.id,
                          type: message.type,
                          file_name: message.file_name,
                          fileInfo: fileInfo,
                          hasContent: !!message.content
                        });
                      }

                      return (
                        <div
                          key={message.id}
                          className={`flex items-end ${isCurrentUser ? 'justify-end' : 'justify-start'} ${isSameUser ? 'mt-1' : 'mt-4'}`}
                        >
                          {/* Only render message bubble if there's content or file/image/video */}
                          {(message.content || ((message.type === 'file' || message.type === 'image' || message.type === 'video') && fileInfo)) && (
                            <div className={`max-w-[75%] md:max-w-sm lg:max-w-lg ${isCurrentUser
                              ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-br-md shadow-md'
                              : 'bg-white border border-gray-200 rounded-2xl rounded-bl-md shadow-sm'
                              } p-3 md:p-3.5 hover:shadow-lg transition-all duration-200`}>
                              {(message.type === 'file' || message.type === 'image' || message.type === 'video') && fileInfo && (
                                <div className="mb-2">
                                  {message.type === 'image' || isImageFile(fileInfo.name) ? (
                                    // Image preview
                                    <div
                                      className="rounded-xl overflow-hidden mb-2 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => openImageModal(getImageUrl(fileInfo.path))}
                                    >
                                      <img
                                        src={getImageUrl(fileInfo.path)}
                                        alt={fileInfo.name}
                                        className="w-full h-auto max-h-64 object-cover"
                                        onError={(e) => {
                                          e.target.src = '/common-avator.jpg';
                                          e.target.onerror = null;
                                        }}
                                      />
                                    </div>
                                  ) : message.type === 'video' ? (
                                    // Video preview
                                    <div className="rounded-xl overflow-hidden mb-2 shadow-sm">
                                      <video
                                        src={getImageUrl(fileInfo.path)}
                                        controls
                                        className="w-full h-auto max-h-64 object-cover"
                                        onError={(e) => {
                                          console.error('❌ Video load error:', getImageUrl(fileInfo.path));
                                        }}
                                      >
                                        Your browser does not support the video tag.
                                      </video>
                                    </div>
                                  ) : (
                                    // File attachment
                                    <div className={`p-3 rounded-lg ${isCurrentUser ? 'bg-blue-600 bg-opacity-50' : 'bg-gray-100'}`}>
                                      <div className="flex items-center">
                                        {getFileIcon(fileInfo.name)}
                                        <div className="ml-3 flex-1 min-w-0">
                                          <p className={`text-sm font-semibold truncate ${isCurrentUser ? 'text-white' : 'text-gray-800'}`}>
                                            {fileInfo.name}
                                          </p>
                                          <p className={`text-xs ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
                                            {formatFileSize(fileInfo.size)}
                                          </p>
                                        </div>
                                        <button
                                          onClick={() => handleFileDownload(getImageUrl(fileInfo.path), fileInfo.name)}
                                          className={`ml-2 text-xs px-3 py-1.5 rounded-md font-medium transition-all ${isCurrentUser
                                            ? 'bg-white text-blue-600 hover:bg-blue-50'
                                            : 'bg-blue-500 text-white hover:bg-blue-600'
                                            } shadow-sm`}
                                        >
                                          Download
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              {message.content && (
                                <p className={`text-sm md:text-base break-words whitespace-pre-wrap leading-relaxed ${isCurrentUser ? 'text-white' : 'text-gray-800'}`}>
                                  {(() => {
                                    const content = message.content;
                                    if (!content) return null;

                                    // Regex to match <a href="...">...</a>
                                    const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"(?:[^>]*?\s+)?target="([^"]*)"[^>]*>(.*?)<\/a>|<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/g;

                                    const parts = [];
                                    let lastIndex = 0;
                                    let match;

                                    while ((match = linkRegex.exec(content)) !== null) {
                                      const [fullMatch, href1, target1, text1, href2, text2] = match;
                                      const href = href1 || href2;
                                      const target = target1 || "_blank";
                                      const text = text1 || text2;

                                      // Add text before the link
                                      if (match.index > lastIndex) {
                                        parts.push(content.substring(lastIndex, match.index));
                                      }

                                      // Add the link
                                      parts.push(
                                        <a
                                          key={match.index}
                                          href={href}
                                          target={target}
                                          rel="noopener noreferrer"
                                          className={`hover:underline ${isCurrentUser ? 'text-blue-100 underline' : 'text-blue-600'}`}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {text}
                                        </a>
                                      );

                                      lastIndex = linkRegex.lastIndex;
                                    }

                                    // Add remaining text
                                    if (lastIndex < content.length) {
                                      parts.push(content.substring(lastIndex));
                                    }

                                    return parts.length > 0 ? parts : content;
                                  })()}
                                </p>
                              )}

                              {/* Rich Post Preview */}
                              {(() => {
                                // Helper to extract UUID or numeric ID from post URL
                                const extractPostId = (content) => {
                                  if (!content) return null;
                                  // Regex to match /post/UUID or /post/ID
                                  // Handles optional domain prefix
                                  const match = content.match(/\/post\/([a-fA-F0-9-]{36}|[a-zA-Z0-9]+)/);
                                  return match ? match[1] : null;
                                };

                                const postId = extractPostId(message.content);
                                // console.log('Message content:', message.content, 'Extracted postId:', postId);
                                if (postId) {
                                  return (
                                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                      <ChatPostPreview postId={postId} />
                                    </div>
                                  );
                                }
                                return null;
                              })()}

                              <div className={`text-[10px] md:text-xs mt-2 flex justify-end items-center gap-1.5 ${isCurrentUser ? 'text-blue-100' : 'text-gray-400'}`}>
                                <span className="font-medium">
                                  {moment(message.created_at).format('hh:mm a')}
                                </span>
                                {message.is_read && isCurrentUser && (
                                  <FaCheckCircle className="text-xs" />
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Typing Indicator */}
                    {isAnyoneTyping && currentChat && (
                      <TypingIndicator
                        userName={currentChat.name}
                        showAvatar={true}
                        avatarUrl={currentChat.avatar}
                      />
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center mb-6 shadow-inner">
                      <FaCommentAlt className="text-blue-400 text-5xl" />
                    </div>
                    <p className="text-lg font-semibold text-gray-600 mb-2">No messages yet</p>
                    <p className="text-sm text-gray-400">Send a message to start the conversation</p>
                  </div>
                )}
              </div>

              {/* File Preview */}
              {currentChat && selectedFile && (
                <div className="px-4 md:px-6 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-t border-blue-200 shrink-0">
                  <div className="flex items-center p-3 bg-white border-2 border-blue-300 rounded-lg shadow-md">
                    <div className="flex-shrink-0">
                      {filePreview ? (
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg overflow-hidden border-2 border-gray-200">
                          <img
                            src={filePreview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center bg-gray-100 rounded-lg">
                          {getFileIcon(selectedFile.name)}
                        </div>
                      )}
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                      <p className="text-sm md:text-base font-semibold text-gray-800 truncate flex items-center">
                        <FaPaperclip className="mr-2 text-blue-500" />
                        {selectedFile.name}
                      </p>
                      {uploadProgress > 0 && uploadProgress < 100 ? (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>Uploading...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1">
                          {formatFileSize(selectedFile.size)} • Ready to send
                        </p>
                      )}
                    </div>
                    <button
                      onClick={removeSelectedFile}
                      className="ml-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full p-2 transition-all"
                      title="Remove file"
                    >
                      <FaTimesCircle className="text-xl md:text-2xl" />
                    </button>
                  </div>
                </div>
              )}

              {/* Message Input */}
              {currentChat && (
                <div className="px-4 md:px-6 py-3 md:py-4 border-t border-gray-200 bg-white shadow-lg shrink-0">
                  <div className="flex items-center gap-2 rounded-2xl bg-gray-50 px-3 md:px-4 py-2 md:py-2.5 border border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all duration-200">
                    <button
                      className="text-gray-400 p-1.5 md:p-2 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all duration-200"
                      title="Add emoji"
                    >
                      <FaSmile className="text-lg md:text-xl" />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      className="text-gray-400 p-1.5 md:p-2 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all duration-200"
                      onClick={() => fileInputRef.current.click()}
                      title="Attach file"
                    >
                      <FaPaperclip className="text-lg md:text-xl" />
                    </button>
                    <input
                      type="text"
                      placeholder="Type your message..."
                      className="flex-1 bg-transparent border-none outline-none px-2 md:px-3 py-1.5 text-sm md:text-base text-gray-800 placeholder-gray-400"
                      value={newMessage}
                      onChange={handleInputChange}
                      onKeyPress={handleKeyPress}
                      onPaste={handlePaste}
                    />
                    <button
                      className={`p-2.5 md:p-3 rounded-xl transition-all duration-200 shadow-sm ${(newMessage.trim() || selectedFile)
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transform hover:scale-105'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() && !selectedFile}
                      title="Send message"
                    >
                      <FaPaperPlane className="text-base md:text-lg" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {imageModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 backdrop-blur-sm animate-fadeIn"
          onClick={closeImageModal}
        >
          <div className="relative max-w-7xl max-h-screen p-4">
            {/* Close button */}
            <button
              onClick={closeImageModal}
              className="absolute top-6 right-6 z-10 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full p-3 transition-all duration-200 hover:scale-110 backdrop-blur-md"
              title="Close (ESC)"
            >
              <FaTimesCircle className="text-2xl" />
            </button>

            {/* Image */}
            <div
              className="relative transition-all duration-300 animate-scaleIn"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImageUrl}
                alt="Full size"
                className="max-w-full max-h-screen object-contain rounded-lg shadow-2xl"
                onError={(e) => {
                  e.target.src = '/common-avator.jpg';
                  e.target.onerror = null;
                }}
              />
            </div>

            {/* Download button */}
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = selectedImageUrl;
                link.download = 'image.jpg';
                link.click();
              }}
              className="absolute bottom-6 right-6 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105 shadow-lg"
            >
              <FaDownload />
              Download
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const MessagingContent = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MessagingContentInner />
    </Suspense>
  );
};

export default MessagingContent;