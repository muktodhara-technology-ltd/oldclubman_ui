"use client";

import { pusherService } from '@/utility/pusher';
import { getAllChat, getMessage, sendMessage, addMessageToChat, setCurrentConversation, startConversation } from '@/views/message/store';
import { getMyProfile } from '@/views/settings/store';
import api from '@/helpers/axios';
import toast from 'react-hot-toast';
import moment from 'moment';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaTimes, FaPaperPlane, FaImage } from 'react-icons/fa';
import { useDispatch, useSelector } from 'react-redux';
import { useChatPusher } from '../custom/useChatPusher';
import ChatPostPreview from './ChatPostPreview';

// Helper to extract UUID from post URL
const extractPostId = (content) => {
  if (!content) return null;
  // Regex to match /post/UUID
  const match = content.match(/\/post\/([a-fA-F0-9-]{36}|[a-zA-Z0-9]+)/);
  return match ? match[1] : null;
};

const ChatBox = ({ user, currentChat, onClose, initialMessage = "" }) => {
  const { allChat, prevChat, convarsationData } = useSelector(({ chat }) => chat);
  const { userFollowers, profile, userProfileData } = useSelector(({ settings }) => settings);
  const dispatch = useDispatch()
  const [message, setMessage] = useState(initialMessage);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [displayUser, setDisplayUser] = useState(user);
  const lastLoadedConversationId = useRef(null);
  // Initialize Pusher service when component mounts
  useEffect(() => {
    pusherService.initialize();
    return () => {
      pusherService.disconnect();
    };
  }, []);

  // Determine the correct user to display
  useEffect(() => {
    if (currentChat && profile?.client?.id) {
      // Get the other user (not the current logged-in user)
      let otherUser = null;

      if (currentChat.users && Array.isArray(currentChat.users) && currentChat.users.length > 0) {
        // Find the user that is NOT the current user
        otherUser = currentChat.users.find(u => String(u.id) !== String(profile.client.id));
      }

      // Fallback: check other_user field
      if (!otherUser && currentChat.other_user) {
        otherUser = currentChat.other_user;
      }

      // Fallback: check participants array
      if (!otherUser && currentChat.participants && Array.isArray(currentChat.participants)) {
        otherUser = currentChat.participants.find(p =>
          String(p.id) !== String(profile.client.id) ||
          String(p.user_id) !== String(profile.client.id)
        );
      }

      // Fallback: check if user prop is different from current user
      if (!otherUser && user && String(user.id) !== String(profile.client.id)) {
        otherUser = user;
      }

      setDisplayUser(otherUser || user);
    } else {
      setDisplayUser(user);
    }
  }, [currentChat, user, profile?.client?.id]);

  // Update message when initialMessage changes
  useEffect(() => {
    if (initialMessage) {
      setMessage(initialMessage);
    }
  }, [initialMessage]);

  // Don't prevent body scroll - allow it to be a floating chat box

  // Initial data fetching
  useEffect(() => {
    dispatch(getAllChat());
    dispatch(getMyProfile());
  }, [dispatch]);

  // Load messages when conversation is opened
  useEffect(() => {
    const conversationId = currentChat?.id || convarsationData?.id;

    // Only load if conversation ID changed and is valid
    if (conversationId && conversationId !== lastLoadedConversationId.current) {
      console.log('Loading messages for conversation:', conversationId);
      lastLoadedConversationId.current = conversationId;
      dispatch(getMessage({ id: conversationId }));
    }
  }, [currentChat?.id, convarsationData?.id]);

  // Find conversation if only user is provided
  useEffect(() => {
    if (!currentChat && user && allChat.length > 0) {
      // Try to find existing conversation with this user
      const existingChat = allChat.find(chat => {
        // Check participants array
        if (chat.participants && Array.isArray(chat.participants)) {
          return chat.participants.some(p => String(p.id) === String(user.id) || String(p.user_id) === String(user.id));
        }
        // Check other_user object
        if (chat.other_user) {
          return String(chat.other_user.id) === String(user.id);
        }
        // Check users array
        if (chat.users && Array.isArray(chat.users)) {
          return chat.users.some(u => String(u.id) === String(user.id));
        }
        return false;
      });

      if (existingChat) {
        console.log('Found existing conversation for user:', user.id, existingChat.id);
        // We can't easily update currentChat prop, but we can set it in Redux or handle it locally
        // For now, let's fetch messages for this chat which will update Redux state
        dispatch(getMessage({ id: existingChat.id }));
        dispatch(setCurrentConversation(existingChat));
      }
    }
  }, [currentChat, user, allChat, dispatch]);

  // Handle new message received via Pusher
  const handleMessageReceived = useCallback((data) => {
    const activeConversationId = currentChat?.id || convarsationData?.id;
    // Compare as strings since they're UUIDs
    if (activeConversationId && String(data.conversation_id) === String(activeConversationId)) {
      // Add message directly instead of refetching
      if (data.message) {
        dispatch(addMessageToChat(data.message));
      }
    }
  }, [currentChat?.id, convarsationData?.id, dispatch]);

  // Handle typing event
  // const handleTyping = useCallback((data) => {
  //   if (data.user_id !== profile?.client?.id) {
  //     setIsTyping(true);
  //     setTimeout(() => setIsTyping(false), 3000);
  //   }
  // }, [profile?.client?.id]);

  // Use the custom Pusher hook
  // Use currentChat.id if available (from prop), otherwise use convarsationData.id (from Redux)
  const conversationId = currentChat?.id || convarsationData?.id;
  useChatPusher(
    conversationId || null, // Don't convert UUID to Number!
    handleMessageReceived,
    // handleTyping
  );

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [prevChat]);

  // Handle sending a message
  const handleSendMessage = async (e) => {
    e.preventDefault(); // Prevent form submission
    if (!message.trim() && !selectedFile) return;

    // If we have a pending conversation (exists but no ID), try to find it first
    let chatId = currentChat?.id || convarsationData?.id;
    let messageSent = false; // Track if message was sent via alternative method

    if (!chatId && (user || (currentChat?._pendingConversation && currentChat?._userData))) {
      const targetUser = user || currentChat?._userData;
      console.log("No ID, trying to find/create conversation for user:", targetUser?.id);
      setIsLoading(true);

      try {
        // Try to find the conversation by refreshing chat list
        const refreshedChats = await dispatch(getAllChat()).unwrap();

        // Helper to find conversation by user ID
        const findConversation = (chats, userId) => {
          if (!chats || !Array.isArray(chats)) return null;
          return chats.find(chat => {
            if (chat.user_ids) {
              const userIds = Array.isArray(chat.user_ids) ? chat.user_ids : [chat.user_ids];
              if (userIds.some(id => String(id) === String(userId))) return true;
            }
            if (chat.participants?.some(p =>
              String(p.id) === String(userId) ||
              String(p.user_id) === String(userId) ||
              String(p.client_id) === String(userId)
            )) return true;
            if (chat.other_user && (
              String(chat.other_user.id) === String(userId) ||
              String(chat.other_user.user_id) === String(userId) ||
              String(chat.other_user.client_id) === String(userId)
            )) return true;
            return false;
          });
        };

        let foundConversation = findConversation(refreshedChats, targetUser.id);

        // If not found, try direct API call
        if (!foundConversation) {
          const directResponse = await api.get('/chat');
          const directChats = directResponse.data?.data || directResponse.data || [];
          foundConversation = findConversation(directChats, targetUser.id);
        }

        // If still not found, try querying by user_id directly
        if (!foundConversation) {
          try {
            const queryParams = [
              `/chat?user_id=${targetUser.id}`,
              `/chat?participant_id=${targetUser.id}`,
              `/chat/${targetUser.id}`, // Direct conversation by user ID
              `/chat/by-user/${targetUser.id}`, // Alternative format
            ];

            for (const query of queryParams) {
              try {
                const queryResponse = await api.get(query);
                const queryData = queryResponse.data?.data || queryResponse.data;

                // Handle single conversation or array
                if (Array.isArray(queryData) && queryData.length > 0) {
                  foundConversation = queryData[0];
                } else if (queryData?.id) {
                  foundConversation = queryData;
                }

                if (foundConversation) {
                  console.log(`Found conversation via query: ${query}`);
                  break;
                }
              } catch (queryErr) {
                continue;
              }
            }
          } catch (queryError) {
            console.log("Query by user_id failed:", queryError);
          }
        }

        if (foundConversation?.id) {
          console.log("Found conversation ID:", foundConversation.id);
          chatId = foundConversation.id;
          // Update currentChat with the real conversation
          currentChat = { ...currentChat, id: foundConversation.id };
        } else {
          // Still no ID - try one more time after a short delay
          // Sometimes the conversation appears after the backend processes it
          console.log("Conversation ID not found, waiting and retrying...");
          await new Promise(resolve => setTimeout(resolve, 1000));

          const retryChats = await dispatch(getAllChat()).unwrap();
          const retryFound = findConversation(retryChats, targetUser.id);

          if (retryFound?.id) {
            console.log("Found conversation ID on retry:", retryFound.id);
            chatId = retryFound.id;
            currentChat = { ...currentChat, id: retryFound.id };
          } else {
            // Last resort: Try to send message anyway using alternative methods
            // Since conversation exists, try different approaches:
            // 1. Try to query conversation by user_id directly
            // 2. Try to send message with user_id instead of chatId
            console.log("Conversation ID still not found. Trying alternative send methods...");

            // Try alternative endpoint: send message directly to user
            // Some backends support sending messages by user_id
            try {
              // Try to send message using user_id in the endpoint or body
              const alternativeFormData = new FormData();
              alternativeFormData.append('content', message.trim());
              alternativeFormData.append('type', selectedFile ? "file" : "text");
              alternativeFormData.append('user_id', targetUser.id);
              if (selectedFile) {
                alternativeFormData.append('files[]', selectedFile);
              }

              // Try alternative endpoint formats
              const alternativeEndpoints = [
                `/chat/message/${targetUser.id}`, // Send to user directly
                `/chat/send-to-user/${targetUser.id}`, // Alternative format
                `/messages/send`, // Generic send endpoint
              ];

              let messageSent = false;
              for (const endpoint of alternativeEndpoints) {
                try {
                  const altResponse = await api.post(endpoint, alternativeFormData, {
                    headers: {
                      'Content-Type': 'multipart/form-data',
                      'Accept': 'application/json'
                    }
                  });

                  if (altResponse.data?.success !== false) {
                    console.log(`Successfully sent message via alternative endpoint: ${endpoint}`);
                    messageSent = true;

                    // Try to get conversation ID from response
                    const responseData = altResponse.data?.data || altResponse.data;
                    if (responseData?.conversation_id || responseData?.conversation?.id || responseData?.chat_id) {
                      chatId = responseData.conversation_id || responseData.conversation?.id || responseData.chat_id;
                      console.log("Got conversation ID from alternative endpoint:", chatId);
                    }

                    break;
                  }
                } catch (altErr) {
                  // Try next endpoint
                  continue;
                }
              }

              if (!messageSent) {
                // If alternative endpoints don't work, try sending to regular endpoint with user_id
                // Some backends might accept user_id in the body and resolve the conversation
                console.log("Trying to send message with user_id to regular endpoint...");
                try {
                  const regularFormData = new FormData();
                  regularFormData.append('content', message.trim());
                  regularFormData.append('type', selectedFile ? "file" : "text");
                  regularFormData.append('user_id', targetUser.id);
                  if (selectedFile) {
                    regularFormData.append('files[]', selectedFile);
                  }

                  // Try sending to a placeholder conversation ID (0 or -1) with user_id in body
                  // Backend might resolve it to the actual conversation
                  const placeholderIds = [0, -1, null];
                  for (const placeholderId of placeholderIds) {
                    try {
                      const endpoint = placeholderId !== null
                        ? `/chat/${placeholderId}/messages`
                        : `/chat/messages`; // Try without ID

                      const testResponse = await api.post(endpoint, regularFormData, {
                        headers: {
                          'Content-Type': 'multipart/form-data',
                          'Accept': 'application/json'
                        }
                      });

                      if (testResponse.data?.success !== false) {
                        console.log(`Successfully sent message with placeholder ID: ${placeholderId}`);
                        messageSent = true;

                        // Extract conversation ID from response
                        const responseData = testResponse.data?.data || testResponse.data;
                        if (responseData?.conversation_id || responseData?.conversation?.id || responseData?.chat_id) {
                          chatId = responseData.conversation_id || responseData.conversation?.id || responseData.chat_id;
                          console.log("Got conversation ID from placeholder send:", chatId);
                        }
                        break;
                      }
                    } catch (testErr) {
                      // Check if error contains conversation ID
                      const errorData = testErr?.response?.data;
                      if (errorData?.conversation_id || errorData?.conversation?.id || errorData?.chat_id) {
                        chatId = errorData.conversation_id || errorData.conversation?.id || errorData.chat_id;
                        console.log("Got conversation ID from error response:", chatId);
                        // Now try sending with the correct ID
                        break;
                      }
                      continue;
                    }
                  }
                } catch (testError) {
                  console.log("Placeholder send failed:", testError);
                }

                // Final attempt: Query backend one more time after delay
                if (!messageSent && !chatId) {
                  console.log("All send attempts failed. Trying final delayed query...");
                  await new Promise(resolve => setTimeout(resolve, 2000));

                  const finalChats = await dispatch(getAllChat()).unwrap();
                  const finalFound = findConversation(finalChats, targetUser.id);

                  if (finalFound?.id) {
                    console.log("Found conversation ID on final retry:", finalFound.id);
                    chatId = finalFound.id;
                    currentChat = { ...currentChat, id: finalFound.id };
                  } else {
                    // Still can't find it - this is a backend limitation
                    toast.error('Conversation exists but cannot be accessed. The conversation has no messages yet and the backend filters it from the list. Please try again in a moment, or contact support to fix the backend API.');
                    setIsLoading(false);
                    return;
                  }
                }
              }
            } catch (altError) {
              console.error("Alternative send methods failed:", altError);
              toast.error('Could not send message. The conversation exists but cannot be accessed. Please try again or contact support.');
              setIsLoading(false);
              return;
            }
          }
        }
      } catch (findError) {
        console.error("Error finding conversation:", findError);
        toast.error('Could not find conversation. Please try again.');
        setIsLoading(false);
        return;
      }
    }

    if (!chatId) {
      if (user || currentChat?._userData) {
        // Verify we have a valid target user to fall through to alternative methods
        const targetUser = user || currentChat?._userData;
        if (targetUser?.id) {
          console.log('No conversation ID available, creating new conversation for user:', targetUser.id);

          try {
            // Create new conversation
            // Determine type based on user type (assuming 'personal' default)
            const newChat = await dispatch(startConversation({
              user_id: targetUser.id,
              type: 'personal' // Default to personal
            })).unwrap();

            if (newChat?.id) {
              console.log('Created new conversation:', newChat.id);
              chatId = newChat.id;
              // Update currentChat
              currentChat = { ...currentChat, id: newChat.id, ...newChat };
              // Continue to send message logic below
            } else {
              throw new Error('Failed to create conversation');
            }
          } catch (createErr) {
            console.error('Failed to create new conversation:', createErr);
            // Fallback to falling through (will likely fail if still no ID, but worth a shot if backend accepts implicit creation)
          }
        } else {
          console.error('No conversation ID and no valid user available');
          toast.error('No conversation selected');
          setIsLoading(false);
          return;
        }
      } else {
        console.error('No conversation ID and no user available');
        toast.error('No conversation selected');
        setIsLoading(false);
        return;
      }
    }

    // Force entry into alternative send methods if we have a user but no chatId
    if (!chatId && (user || (currentChat?._pendingConversation && currentChat?._userData))) {
      // ... existing alternative logic ...
      // I will modify the condition line in the next hunk
    }

    // If message was already sent via alternative method, skip regular send
    if (!messageSent) {
      setIsLoading(true);
      setUploadProgress(0);
      try {
        const chatData = {
          chatId: chatId,
          type: selectedFile ? getFileType(selectedFile) : "text",
          content: message.trim(),
          file: selectedFile,
          onProgress: (progress) => {
            setUploadProgress(progress);
          }
        };

        // Clear message input immediately for better UX
        setMessage("");

        const response = await dispatch(sendMessage(chatData)).unwrap();

        if (response) {
          // Clear file if exists
          if (selectedFile) {
            clearFile();
          }

          // Refresh messages and chat list
          if (chatId) {
            await dispatch(getMessage({ id: chatId })); // Don't convert UUID to Number!
          }
          await dispatch(getAllChat());

          // Update currentChat if it was pending
          if (currentChat?._pendingConversation) {
            currentChat = { ...currentChat, id: chatId, _pendingConversation: false };
          }
        }
      } catch (error) {
        console.error('Error sending message:', error);
        // Show error message to user
        toast.error(error.message || 'Failed to send message. Please try again.');
        // Restore message if failed
        if (message.trim()) {
          setMessage(message);
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      // Message was sent via alternative method
      // Clear input and refresh
      setMessage("");
      if (selectedFile) {
        clearFile();
      }

      // If we got conversation ID, refresh messages and chat list
      if (chatId) {
        try {
          await dispatch(getMessage({ id: chatId })); // Don't convert UUID to Number!
          await dispatch(getAllChat());

          // Update currentChat if it was pending
          if (currentChat?._pendingConversation) {
            currentChat = { ...currentChat, id: chatId, _pendingConversation: false };
          }
        } catch (refreshError) {
          console.error("Error refreshing after alternative send:", refreshError);
        }
      }

      setIsLoading(false);
      toast.success('Message sent successfully!');
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
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  // Clear file and preview
  const clearFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Get file type from MIME type
  const getFileType = (file) => {
    if (!file) return 'text';
    const mimeType = file.type;
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'file';
  };

  // Construct file URL for display
  const getFileUrl = (filePath) => {
    if (!filePath) return null;

    // If it's already a full URL (http:// or https://), return as-is
    if (/^https?:\/\//i.test(filePath)) {
      return filePath;
    }

    // Clean up malformed paths that start with domain name or dots
    let cleanPath = filePath;

    // Remove leading dots and domain names (e.g., ".oldclubman.com/" or "oldclubman.com/")
    cleanPath = cleanPath.replace(/^\.?[a-zA-Z0-9.-]+\.(com|net|org|io)(\/|$)/i, '');

    // Remove leading /api/ if present
    cleanPath = cleanPath.replace(/^\/api\//, '');

    // Remove leading slashes
    cleanPath = cleanPath.replace(/^\/+/, '');

    // Get base URL without /api suffix and remove trailing slashes
    const apiUrl = (process.env.NEXT_PUBLIC_FILE_PATH || '').replace(/\/+$/, '');
    // const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/api\/?$/, '');

    // Construct final URL
    const fullUrl = `${apiUrl}/${cleanPath}`;

    return fullUrl;
  };

  return (
    <>
      {/* Backdrop - Click to close - More transparent to see background */}
      <div
        className="fixed inset-0 bg-opacity-10 z-40"
        onClick={onClose}
      />

      {/* Chat Box - Floating Popup, can open from anywhere */}
      <div className="fixed bottom-4 right-4 w-96 h-[400px] bg-white rounded-lg shadow-2xl z-50 flex flex-col md:w-[300px] md:h-[400px]">
        {/* Chat Header */}
        <div className="flex items-center justify-between bg-blue-600 px-4 py-1 rounded-t-lg">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-white flex-shrink-0">
              <img
                src={displayUser?.image ? process.env.NEXT_PUBLIC_FILE_PATH + displayUser?.image : "/common-avator.jpg"}
                alt={displayUser?.fname}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/common-avator.jpg";
                }}
              />
            </div>
            <div className="flex flex-col gap-0 flex-1 min-w-0">
              <p className="text-white font-medium text-sm leading-tight truncate">
                {displayUser?.fname ? `${displayUser.fname} ${displayUser.last_name || ''}`.trim() : "Oldclubman User"}
              </p>
              <span className="text-xs text-green-300 leading-tight flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                Online
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white cursor-pointer hover:text-gray-200 transition-colors p-1 hover:bg-blue-700 rounded-full flex-shrink-0"
            aria-label="Close chat"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {currentChat?._pendingConversation ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              <p>Conversation ready. Type a message to start chatting.</p>
            </div>
          ) : (
            prevChat?.map((msg, index) => {
              // Parse file_name if it's a JSON string
              let files = [];
              if (msg.file_name) {
                try {
                  files = typeof msg.file_name === 'string'
                    ? JSON.parse(msg.file_name)
                    : msg.file_name;
                  if (!Array.isArray(files)) files = [files];
                  console.log('Parsed files:', files);
                } catch (e) {
                  console.error('Error parsing file_name:', e, msg.file_name);
                }
              }

              return (
                <div
                  key={index}
                  className={`flex mb-3 ${String(msg?.user_id) === String(profile?.client?.id) ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-2 py-1 ${String(msg?.user_id) === String(profile?.client?.id)
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-gray-200 text-gray-800 rounded-bl-none'
                      }`}
                  >
                    {/* Render images and files */}
                    {files.length > 0 && files.map((file, fileIndex) => {
                      const fileUrl = getFileUrl(file.path);

                      console.log('📎 File display:', {
                        file_name: file.file_name,
                        file_type: file.file_type,
                        path: file.path,
                        constructed_url: fileUrl
                      });

                      if (!fileUrl) return null;

                      if (file.file_type === 'image') {
                        return (
                          <div key={fileIndex} className="mb-2">
                            <img
                              src={fileUrl}
                              alt="Shared image"
                              className="max-w-full max-h-48 rounded cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(fileUrl, '_blank')}
                              onError={(e) => {
                                console.error('❌ Image load error:', fileUrl);
                                // Show fallback message instead of hiding
                                e.target.outerHTML = `<div class="text-xs text-red-500 p-2 bg-red-50 rounded">⚠️ Image failed to load</div>`;
                              }}
                              onLoad={() => console.log('✅ Image loaded successfully:', fileUrl)}
                            />
                          </div>
                        );
                      } else {
                        return (
                          <a
                            key={fileIndex}
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs underline mb-1 hover:opacity-80 transition-opacity"
                          >
                            📎 {file.file_name || 'Download file'} ({file.file_type})
                          </a>
                        );
                      }
                    })}

                    {/* Render text content */}
                    {msg.content && (
                      <div className="text-sm break-words">
                        {/* Only show text if it's NOT just the post URL we are previewing */}
                        {(() => {
                          const postUrlPattern = /\/post\/([a-fA-F0-9-]{36}|[a-zA-Z0-9]+)/;
                          const match = msg.content.match(postUrlPattern);
                          const postId = match ? match[1] : null;

                          // Check if the content is ONLY the URL (or wrapped in simple HTML tags)
                          // We strip HTML tags to check if there is other user content
                          const strippedContent = msg.content.replace(/<[^>]*>?/gm, '').trim();
                          const isJustUrl = strippedContent.includes(postId) && strippedContent.length < (postId.length + 50); // Heuristic

                          if (!isJustUrl) {
                            return <p>{msg.content}</p>;
                          }
                          return null;
                        })()}

                        {/* Rich Post Preview */}
                        {(() => {
                          const postId = extractPostId(msg.content);
                          if (postId) {
                            return <ChatPostPreview postId={postId} />;
                          }
                          return null;
                        })()}
                      </div>
                    )}

                    {/* Timestamp */}
                    {/* <span className="text-[10px] block mt-1 opacity-75">
                    {moment(msg.created_at).format('hh:mm a')}
                  </span> */}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="py-1 px-3 bg-white border-t border-gray-200 shadow-lg rounded-b-lg">
          {/* Upload Progress Bar */}
          {isLoading && uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Attach image"
            >
              <FaImage className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onPaste={handlePaste}
              placeholder="Type a message..."
              className="flex-1 px-3 py-1 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              type="submit"
              disabled={(!message.trim() && !selectedFile) || isLoading}
              className="text-blue-600 hover:text-blue-700 disabled:text-gray-400 p-2"
              aria-label="Send message"
            >
              <FaPaperPlane className="w-4 h-4" />
            </button>
          </div>
          {selectedFile && (
            <div className="mt-2">
              {filePreview ? (
                <div className="relative inline-block">
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="max-h-20 rounded-lg border border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={clearFile}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-lg"
                    aria-label="Remove file"
                  >
                    <FaTimes className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="text-sm text-gray-600 flex items-center justify-between bg-gray-100 rounded-lg px-3 py-2">
                  <span className="truncate flex-1">📎 {selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="ml-2 text-red-500 hover:text-red-700"
                    aria-label="Remove file"
                  >
                    <FaTimes className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </>
  );
};

export default ChatBox; 