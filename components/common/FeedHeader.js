import Link from "next/link";
import React, { useEffect, useState } from "react";
import {
  FaEllipsisH,
  FaBookmark,
  FaEdit,
  FaBullhorn,
  FaUserTie,
  FaCamera,
  FaIdCard,
  FaInfoCircle,
  FaUsers,
  FaCog,
  FaEye,
} from "react-icons/fa";
import { IoMdMore } from "react-icons/io";
import toast from "react-hot-toast";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import {
  followTo,
  getAllFollowers,
  getMyProfile,
  getUserFollowers,
  getUserFollowing,
  getUserProfile,
  getUserProfileByUsername,
  unFollowTo,
  bindProfileSettingData,
  storeProfileSetting,
} from "@/views/settings/store";
import { useDispatch, useSelector } from "react-redux";
import { LuMessageCircleMore } from "react-icons/lu";
import ChatBox from "./ChatBox";
import { getMessage, startConversation, getAllChat } from "@/views/message/store";
import api from "@/helpers/axios";
import { getGathering, getPosts, storePost } from "@/views/gathering/store";
import Image from "next/image";

// Helper function to get client image URL without duplication
const getClientImageUrl = (imagePath, fallback = "/common-avator.jpg") => {
  if (!imagePath) return fallback;
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  // Otherwise, prepend the base URL
  return process.env.NEXT_PUBLIC_FILE_PATH + imagePath;
};

function FeedHeader({
  userProfile = false,
  friendsTab = false,
  showMsgBtn = false,
  showFriends = false,
  showEditBtn = false,
  hideProfileSection = false,
}) {
  const { profile, userProfileData, followLoading, profileSettingData } = useSelector(
    ({ settings }) => settings
  );
  const data = userProfile ? userProfileData : profile;
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();
  const isViewAsPublic = searchParams.get('viewas') === 'public';
  const dispatch = useDispatch();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNavDropdown, setShowNavDropdown] = useState(false);
  const [showChatBox, setShowChatBox] = useState(false);
  const [currentChat, setCurrentChat] = useState(false);
  const [showEditPhotoModal, setShowEditPhotoModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [profileImageLoading, setProfileImageLoading] = useState(false);
  const [showEditCoverModal, setShowEditCoverModal] = useState(false);
  const [selectedCoverImage, setSelectedCoverImage] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState(null);
  const [coverImageLoading, setCoverImageLoading] = useState(false);
  const coverImageRef = React.useRef(null);

  useEffect(() => {
    dispatch(getMyProfile());
  }, [dispatch]);

  // Extract dominant colors from cover image
  const extractColorsFromImage = (imgElement) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = imgElement.width;
      canvas.height = imgElement.height;
      ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const colorBuckets = {};

      // Helper function to quantize colors (group similar colors)
      const quantizeColor = (value) => Math.round(value / 20) * 20;

      // Helper function to calculate color vibrancy/saturation
      const getColorScore = (r, g, b) => {
        const brightness = (r + g + b) / 3;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;

        // Filter out very dark colors (brightness < 30) and pure white (brightness > 250)
        if (brightness < 30 || brightness > 250) return 0;

        // Check if it's a grayscale color (very low saturation)
        const isGrayscale = saturation < 0.15;

        // For light images (brightness > 180), prioritize any slightly saturated colors
        if (brightness > 180 && !isGrayscale) {
          return saturation * 200 + brightness;
        }

        // For medium brightness with good saturation
        if (saturation > 0.3) {
          return saturation * brightness * 1.5;
        }

        // Lower priority for low saturation colors
        return saturation * brightness * 0.5;
      };

      // Sample pixels more densely (every 4th pixel)
      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const score = getColorScore(r, g, b);

        // Only include colors with decent vibrancy
        if (score > 0) {
          // Quantize to group similar colors
          const qr = quantizeColor(r);
          const qg = quantizeColor(g);
          const qb = quantizeColor(b);
          const key = `${qr},${qg},${qb}`;

          if (!colorBuckets[key]) {
            colorBuckets[key] = { r: qr, g: qg, b: qb, count: 0, score: 0 };
          }
          colorBuckets[key].count += 1;
          colorBuckets[key].score += score;
        }
      }

      // Get top colors sorted by combined score
      const sortedColors = Object.values(colorBuckets)
        .sort((a, b) => (b.count * b.score) - (a.count * a.score))
        .slice(0, 3)
        .map(({ r, g, b }) => `rgb(${r}, ${g}, ${b})`);

      return sortedColors.length >= 3 ? sortedColors : ['rgb(59, 130, 246)', 'rgb(96, 165, 250)', 'rgb(147, 197, 253)'];
    } catch (error) {
      console.error('Error extracting colors:', error);
      return ['rgb(59, 130, 246)', 'rgb(96, 165, 250)', 'rgb(147, 197, 253)'];
    }
  };

  const handleCoverImageLoad = (e) => {
    const colors = extractColorsFromImage(e.target);
    if (colors && colors.length >= 3) {
      // Dispatch custom event with extracted colors
      window.dispatchEvent(new CustomEvent('coverColorsExtracted', {
        detail: { colors }
      }));
    }
  };



  const isMyProfile = isViewAsPublic ? false : data?.client?.id === profile?.client?.id;
  // console.log('isMyProfile',isMyProfile)
  // console.log('data?.client',data?.client)
  const isLinkActive = (path) => {
    return pathname.startsWith(path);
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const handleFollow = (following_id) => {
    const action =
      userProfileData?.isfollowed === 1
        ? unFollowTo({ following_id })
        : followTo({ following_id });
    dispatch(action).then((res) => {
      // Refresh the user profile data after follow/unfollow
      if (params?.username) {
        dispatch(getUserProfileByUsername(params.username));
      } else if (following_id) {
        dispatch(getUserProfile(following_id));
      }
      // Also refresh my own profile to update following count
      dispatch(getMyProfile());
    });
  };

  const handleMsgButtonSelect = async (contactId) => {
    // Store errors for later reference
    let createError = null;
    let finalError = null;

    try {
      const profileResponse = await dispatch(getUserProfile(contactId)).unwrap();
      const userData = profileResponse?.client;

      if (!userData) {
        console.error('No user data received');
        toast.error('User data not available');
        return;
      }

      // Helper function to find conversation by user ID
      const findConversationByUserId = (chats, userId) => {
        if (!chats || !Array.isArray(chats)) {
          console.log("findConversationByUserId: chats is not an array", chats);
          return null;
        }

        console.log(`Searching for conversation with userId: ${userId} in ${chats.length} chats`);

        const found = chats.find(chat => {
          // Log each chat for debugging
          console.log("Checking chat:", {
            id: chat.id,
            user_ids: chat.user_ids,
            participants: chat.participants,
            other_user: chat.other_user,
            is_group: chat.is_group,
            name: chat.name
          });

          // Check user_ids field
          if (chat.user_ids !== undefined && chat.user_ids !== null) {
            const userIds = Array.isArray(chat.user_ids) ? chat.user_ids : [chat.user_ids];
            if (userIds.some(id => String(id) === String(userId))) {
              console.log("Found conversation by user_ids");
              return true;
            }
          }

          // Check participants array
          if (chat.participants && Array.isArray(chat.participants)) {
            if (chat.participants.some(p =>
              String(p.id) === String(userId) ||
              String(p.user_id) === String(userId) ||
              String(p.client_id) === String(userId)
            )) {
              console.log("Found conversation by participants");
              return true;
            }
          }

          // Check other_user for direct messages
          if ((chat.is_group === 0 || chat.is_group === false || !chat.is_group) && chat.other_user) {
            if (String(chat.other_user?.id) === String(userId) ||
              String(chat.other_user?.user_id) === String(userId) ||
              String(chat.other_user?.client_id) === String(userId)) {
              console.log("Found conversation by other_user");
              return true;
            }
          }

          // Check name field
          if (chat.name) {
            const userName = `${userData.fname} ${userData.last_name}`.toLowerCase();
            if (chat.name.toLowerCase() === userName) {
              console.log("Found conversation by name");
              return true;
            }
          }

          return false;
        });

        if (found) {
          console.log("Found conversation:", found);
        } else {
          console.log("No conversation found with userId:", userId);
        }

        return found || null;
      };

      // First, check if conversation already exists
      let conversation = null;

      try {
        // Get all chats
        const allChats = await dispatch(getAllChat()).unwrap();
        conversation = findConversationByUserId(allChats, userData.id);

        // If not found, try direct API call
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
          name: userData?.fname + " " + userData?.last_name,
          avatar: getClientImageUrl(userData?.image),
          user_ids: userData?.id
        };

        try {
          // Use direct API call to avoid error toast
          const createResponse = await api.post('/chat', newChat);
          console.log("Create conversation response:", createResponse.data);

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

          // Update Redux store
          if (conversation?.id) {
            await dispatch(getAllChat());
          } else {
            // Refresh and find it
            const refreshedChats = await dispatch(getAllChat()).unwrap();
            conversation = findConversationByUserId(refreshedChats, userData.id);
          }
        } catch (err) {
          createError = err; // Store error for later reference
          // Handle "conversation already exists" error
          const errorStatus = createError?.response?.status;
          const errorMessage = createError?.response?.data?.message || '';
          const isAlreadyExistsError =
            errorStatus === 400 &&
            (errorMessage.toLowerCase().includes("already exists") ||
              errorMessage.toLowerCase().includes("conversation"));

          if (isAlreadyExistsError) {
            console.log("Conversation already exists, finding it...");
            const errorData = createError?.response?.data;
            console.log("Full error data:", JSON.stringify(errorData, null, 2));

            // First, try to extract conversation ID from error response
            let convId = errorData?.data?.conversation_id ||
              errorData?.data?.id ||
              errorData?.conversation_id ||
              errorData?.id ||
              errorData?.conversation?.id ||
              errorData?.data?.conversation?.id;

            // Check if error message contains conversation ID
            if (!convId && errorMessage) {
              const idMatch = errorMessage.match(/conversation[_\s]*id[:\s]*(\d+)/i) ||
                errorMessage.match(/id[:\s]*(\d+)/i);
              if (idMatch) {
                convId = idMatch[1];
              }
            }

            // Try to extract any ID from error response JSON
            if (!convId && errorData) {
              const errorStr = JSON.stringify(errorData);
              const idMatches = errorStr.match(/"id"\s*:\s*(\d+)/g);
              if (idMatches && idMatches.length > 0) {
                // Try each ID to verify it's a conversation
                for (const match of idMatches) {
                  const testId = parseInt(match.match(/\d+/)[0]);
                  try {
                    const testResponse = await api.get(`/chat/${testId}/messages`).catch(() => null);
                    if (testResponse?.data !== undefined) {
                      convId = testId;
                      console.log("Found valid conversation ID:", convId);
                      break;
                    }
                  } catch (e) {
                    continue;
                  }
                }
              }
            }

            if (convId) {
              console.log("Using conversation ID from error:", convId);
              conversation = { id: convId }; // Don't convert UUID to Number!
            } else {
              // Refresh chat list and find the existing conversation
              try {
                const updatedChats = await dispatch(getAllChat()).unwrap();
                conversation = findConversationByUserId(updatedChats, userData.id);

                // If still not found, try direct API call
                if (!conversation) {
                  const directResponse = await api.get('/chat');
                  const directChats = directResponse.data?.data || directResponse.data || [];
                  conversation = findConversationByUserId(directChats, userData.id);
                }

                // Try JSON string search as last resort
                if (!conversation) {
                  const allChatsResponse = await api.get('/chat');
                  const allChats = allChatsResponse.data?.data || allChatsResponse.data || [];
                  conversation = allChats.find(chat => {
                    const chatStr = JSON.stringify(chat);
                    return chatStr.includes(String(userData.id));
                  });
                }
              } catch (refreshError) {
                console.error("Error refreshing chats:", refreshError);
              }
            }
          } else {
            // For other errors, show error
            console.error('Error creating conversation:', createError);
            toast.error(createError?.response?.data?.message || 'Failed to start conversation. Please try again.');
            return;
          }
        }
      }

      // If we still don't have conversation, try one final attempt
      if (!conversation?.id) {
        console.log("Final attempt: Creating conversation with user ID:", userData.id);
        try {
          const newChat = {
            is_group: 0,
            name: userData?.fname + " " + userData?.last_name,
            avatar: getClientImageUrl(userData?.image),
            user_ids: userData?.id
          };

          const createResponse = await api.post('/chat', newChat);
          console.log("Final create response:", createResponse.data);

          // Try all possible response structures
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

          // If we got a conversation, refresh and verify
          if (conversation?.id) {
            await dispatch(getAllChat());
          } else {
            // Refresh and search again
            const refreshedChats = await dispatch(getAllChat()).unwrap();
            conversation = findConversationByUserId(refreshedChats, userData.id);

            // Last resort: JSON string search
            if (!conversation) {
              conversation = refreshedChats.find(chat => {
                const chatStr = JSON.stringify(chat);
                return chatStr.includes(String(userData.id));
              });
            }
          }
        } catch (err) {
          finalError = err; // Store error for later reference
          console.error("Final create attempt failed:", finalError);
          console.error("Error response:", finalError?.response?.data);

          // If it's "already exists", try to extract conversation ID from error response
          if (finalError?.response?.status === 400) {
            const errorData = finalError?.response?.data;
            console.log("Full error data:", JSON.stringify(errorData, null, 2));

            // Try to extract conversation ID from error response
            let convId = errorData?.data?.conversation_id ||
              errorData?.data?.id ||
              errorData?.conversation_id ||
              errorData?.id ||
              errorData?.conversation?.id ||
              errorData?.data?.conversation?.id;

            // Also check if error message contains conversation ID
            if (!convId && errorData?.message) {
              const idMatch = errorData.message.match(/conversation[_\s]*id[:\s]*(\d+)/i) ||
                errorData.message.match(/id[:\s]*(\d+)/i);
              if (idMatch) {
                convId = idMatch[1];
              }
            }

            if (convId) {
              console.log("Found conversation ID from error:", convId);
              conversation = { id: convId }; // Don't convert UUID to Number!
            } else {
              // Try to get conversation by querying with user ID or other methods
              try {
                // Try different API endpoints to get the conversation
                // Option 1: Try to get conversation by user ID if such endpoint exists
                try {
                  const userChatResponse = await api.get(`/chat?user_id=${userData.id}`);
                  const userChats = userChatResponse.data?.data || userChatResponse.data || [];
                  if (userChats.length > 0) {
                    conversation = userChats[0];
                    console.log("Found conversation via user_id query:", conversation);
                  }
                } catch (userChatErr) {
                  console.log("user_id query failed, trying other methods...");
                }

                // Option 2: Try to get all chats again (maybe it was a timing issue)
                if (!conversation) {
                  const allChatsResponse = await api.get('/chat');
                  const allChats = allChatsResponse.data?.data || allChatsResponse.data || [];
                  console.log("All chats from API (retry):", allChats);
                  console.log("Looking for user ID:", userData.id);

                  conversation = findConversationByUserId(allChats, userData.id);

                  if (!conversation) {
                    // Try JSON string search
                    conversation = allChats.find(chat => {
                      const chatStr = JSON.stringify(chat);
                      const found = chatStr.includes(String(userData.id));
                      if (found) {
                        console.log("Found conversation via JSON search:", chat);
                      }
                      return found;
                    });
                  }
                }

                // Option 3: Try to get conversation by attempting to send a test message or query messages
                // Since conversation exists, we can try to query messages with user ID
                if (!conversation) {
                  console.log("Conversation exists but not in chat list. Trying alternative methods...");

                  // Try to get conversation by checking if we can access messages
                  // Sometimes we need to query messages endpoint to find the conversation
                  try {
                    // Try to get all conversations with a different approach
                    // Maybe the conversation is in a different format or needs a different query
                    const allChatsResponse = await api.get('/chat');
                    const allChats = allChatsResponse.data?.data || allChatsResponse.data || [];

                    // Log the full response to see what we're getting
                    console.log("Full chat API response:", allChatsResponse.data);

                    // If still empty, the conversation might be filtered out
                    // This often happens when conversation has no messages yet
                    if (allChats.length === 0) {
                      console.log("Chat list is empty. Conversation exists but not returned by API.");
                      console.log("This likely means the conversation has no messages yet.");

                      // Since the backend says conversation exists, we need to find its ID
                      // Try to extract from error response
                      if (errorData?.data && typeof errorData.data === 'object') {
                        if (errorData.data.id) {
                          conversation = { id: errorData.data.id };
                          console.log("Using conversation ID from error data:", conversation);
                        } else if (Object.keys(errorData.data).length > 0) {
                          conversation = errorData.data;
                          console.log("Using error data as conversation:", conversation);
                        }
                      }

                      // If we still don't have conversation ID, try to query backend
                      // for conversation between current user and target user
                      if (!conversation?.id) {
                        try {
                          const currentUserId = profile?.client?.id;
                          if (currentUserId) {
                            // Try different query formats to find the conversation
                            const queryParams = [
                              `?user_id=${userData.id}`,
                              `?participant_id=${userData.id}`,
                              `?user_ids[]=${currentUserId}&user_ids[]=${userData.id}`,
                              `?with_user_id=${userData.id}`,
                            ];

                            for (const query of queryParams) {
                              try {
                                const queryResponse = await api.get(`/chat${query}`);
                                const queryChats = queryResponse.data?.data || queryResponse.data || [];
                                if (queryChats.length > 0) {
                                  conversation = queryChats[0];
                                  console.log(`Found conversation via query ${query}:`, conversation);
                                  break;
                                }
                              } catch (queryErr) {
                                // Try next query format
                                continue;
                              }
                            }
                          }
                        } catch (queryErr) {
                          console.log("Query methods failed:", queryErr);
                        }
                      }

                      // If still no conversation ID, log the issue
                      if (!conversation?.id) {
                        console.log("Could not extract conversation ID. The conversation exists but API doesn't return it.");
                        console.log("This is likely a backend issue - conversation exists but /chat endpoint filters it out.");
                        console.log("Error response structure:", JSON.stringify(errorData, null, 2));
                        console.log("RECOMMENDATION: Backend should either:");
                        console.log("1. Return conversation_id in the error response when conversation already exists");
                        console.log("2. Include empty conversations in /chat endpoint response");
                        console.log("3. Provide an endpoint to get conversation by user IDs");
                      }
                    }
                  } catch (altErr) {
                    console.error("Alternative method failed:", altErr);
                  }
                }
              } catch (searchErr) {
                console.error("Final search error:", searchErr);
              }
            }
          }
        }
      }

      // If we still don't have conversation ID but know it exists (from 400 error),
      // try to extract it from the error response or use alternative methods
      if (!conversation?.id) {
        console.log("Attempting final methods to find conversation ID...");

        // Get the final error data from the last create attempt
        // We need to check the catch block's error
        // Since finalError is in the catch scope, we'll check it there
        // But for now, let's try one more thing - check if we can query by user relationship
        try {
          // Some backends allow querying conversations by participant
          // Try to get conversation where current user and target user are participants
          const currentUserId = profile?.client?.id;
          if (currentUserId && userData.id) {
            // Try to find conversation by attempting to get messages
            // We'll need to iterate through possible conversation IDs
            // But that's not practical...

            // Instead, let's check if the backend has a way to get conversation by users
            // Or we can try to send a message directly which might create/use the conversation
            console.log("Conversation exists but ID not found. This is a backend API limitation.");
            console.log("The /chat endpoint doesn't return conversations without messages.");
          }
        } catch (finalCheckErr) {
          console.error("Final check failed:", finalCheckErr);
        }
      }

      // Check if we had a "conversation already exists" error
      // This needs to be defined before we use it
      const hadAlreadyExistsError =
        (createError?.response?.status === 400 &&
          createError?.response?.data?.message?.toLowerCase().includes("already exists")) ||
        (finalError?.response?.status === 400 &&
          finalError?.response?.data?.message?.toLowerCase().includes("already exists"));

      // If we have a conversation, open the chat box
      if (conversation?.id) {
        console.log("Opening chat box with conversation:", conversation);
        setCurrentChat(conversation);
        try {
          await dispatch(getMessage({ id: conversation.id }));
          setShowChatBox(true);
          toast.success('Conversation opened');
        } catch (msgError) {
          // Even if getting messages fails, try to open chat box
          // The conversation exists, we just can't load messages yet
          console.log("Could not load messages, but opening chat box anyway:", msgError);
          setShowChatBox(true);
          toast.success('Conversation opened');
        }
      } else if (hadAlreadyExistsError) {
        // Last resort: Since conversation exists but we can't get its ID,
        // try to create a minimal conversation object with user data
        // and open chat box - the backend might handle it when user sends first message
        console.log("Creating minimal conversation object to open chat box...");
        const minimalConversation = {
          id: null, // We don't have the ID
          user_ids: userData.id,
          name: `${userData.fname} ${userData.last_name}`,
          avatar: getClientImageUrl(userData?.image),
          is_group: 0,
          // Store user data so we can try to find conversation when sending message
          _userData: userData,
          _pendingConversation: true // Flag to indicate this is a pending conversation
        };

        // Set current chat with minimal data
        setCurrentChat(minimalConversation);
        setShowChatBox(true);
        toast.success('Opening conversation. You can now send a message.');

        // Note: When user sends first message, the backend should handle finding/using the existing conversation
      } else {
        console.error("Could not find or create conversation. User ID:", userData.id);

        if (hadAlreadyExistsError) {
          console.log("Conversation exists but not accessible via /chat endpoint.");
          console.log("Attempting multiple workarounds to find the conversation...");

          // Workaround 1: Try with delay (sometimes there's a race condition)
          try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const delayedChats = await dispatch(getAllChat()).unwrap();
            conversation = findConversationByUserId(delayedChats, userData.id);

            if (!conversation) {
              const delayedResponse = await api.get('/chat');
              const delayedChatsList = delayedResponse.data?.data || delayedResponse.data || [];
              conversation = findConversationByUserId(delayedChatsList, userData.id);
            }
          } catch (delayErr) {
            console.error("Delayed fetch failed:", delayErr);
          }

          // Workaround 2: Try querying with include_empty or similar parameters
          if (!conversation?.id) {
            try {
              const queryParams = [
                '/chat?include_empty=1',
                '/chat?show_all=1',
                '/chat?with_messages=0',
                `/chat?user_id=${userData.id}&include_empty=1`,
              ];

              for (const query of queryParams) {
                try {
                  const queryResponse = await api.get(query);
                  const queryChats = queryResponse.data?.data || queryResponse.data || [];
                  conversation = findConversationByUserId(queryChats, userData.id);
                  if (conversation) {
                    console.log(`Found conversation via query: ${query}`);
                    break;
                  }
                } catch (queryErr) {
                  continue;
                }
              }
            } catch (queryErr) {
              console.error("Query workaround failed:", queryErr);
            }
          }

          // Workaround 3: Since conversation exists, try to create a minimal conversation object
          // and attempt to open chat box - backend might handle it
          // But we need the conversation ID for this to work...

          // If still no conversation, show helpful message
          if (!conversation?.id) {
            console.log("All workarounds failed. Backend needs to return conversation_id in error response.");
            toast.error('Conversation exists but cannot be accessed. This is a backend limitation - the conversation has no messages yet and is filtered from the chat list. Please contact support or try accessing from the Messages page.');
          }
        } else {
          try {
            const availableChats = await dispatch(getAllChat()).unwrap();
            console.error("Available chats:", availableChats);
            console.error("Chat count:", availableChats?.length || 0);
          } catch (logError) {
            console.error("Error logging available chats:", logError);
          }
          toast.error('Could not find or create conversation. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error in handleMsgButtonSelect:', error);
      toast.error('Failed to start conversation. Please try again.');
    }
  };

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedImage(file);
      dispatch(bindProfileSettingData({ ...profileSettingData, image: file }));
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveImage = () => {
    if (selectedImage) {
      setProfileImageLoading(true);
      const formData = new FormData();

      // Add the image file to FormData
      if (profileSettingData?.image) {
        formData.append("image", profileSettingData.image);
      }

      // Dispatch the storeProfileSetting action
      dispatch(storeProfileSetting(formData)).then((res) => {
        toast.success("Profile photo updated successfully");
        dispatch(getMyProfile());
        dispatch(getUserProfile(data?.client?.id));

        // Create a post about the profile photo change
        const postFormData = new FormData();
        postFormData.append("message", "");
        postFormData.append("privacy_mode", "public");

        // Add the profile image to the post
        if (profileSettingData?.image) {
          postFormData.append("files[0]", profileSettingData.image);
        }

        dispatch(storePost(postFormData))
          .then(() => {
            dispatch(getGathering())
            dispatch(getPosts());
            if (params?.id) {
              dispatch(getUserProfile(params?.id));
            }
            dispatch(getMyProfile());
          })

        // Close modal and reset local state
        setShowEditPhotoModal(false);
        setSelectedImage(null);
        setImagePreview(null);
        setProfileImageLoading(false);
      }).catch((error) => {
        toast.error("Failed to update profile photo");
        console.error("Error updating profile photo:", error);
        setProfileImageLoading(false);
      });
    }
  };

  const handleCancelEdit = () => {
    setShowEditPhotoModal(false);
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleCoverImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedCoverImage(file);
      dispatch(bindProfileSettingData({ ...profileSettingData, cover_photo: file }));
      const reader = new FileReader();
      reader.onload = (e) => {
        setCoverImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveCoverImage = () => {
    if (selectedCoverImage) {
      setCoverImageLoading(true);
      const formData = new FormData();

      // Add the cover photo file to FormData
      if (profileSettingData?.cover_photo) {
        formData.append("cover_photo", profileSettingData.cover_photo);
      }

      // Dispatch the storeProfileSetting action
      dispatch(storeProfileSetting(formData)).then((res) => {
        toast.success("Cover photo updated successfully");
        dispatch(getMyProfile());
        dispatch(getUserProfile(data?.client?.id));

        // Create a post about the cover photo change
        const postFormData = new FormData();
        postFormData.append("message", "");
        postFormData.append("privacy_mode", "public");

        // Add the cover image to the post
        if (profileSettingData?.cover_photo) {
          postFormData.append("files[0]", profileSettingData.cover_photo);
        }

        dispatch(storePost(postFormData))
          .then(() => {
            dispatch(getGathering())
            dispatch(getPosts());
            if (params?.id) {
              dispatch(getUserProfile(params?.id));
            }
            dispatch(getMyProfile());
          })

        // Close modal and reset local state
        setShowEditCoverModal(false);
        setSelectedCoverImage(null);
        setCoverImagePreview(null);
        setCoverImageLoading(false);
      }).catch((error) => {
        toast.error("Failed to update cover photo");
        console.error("Error updating cover photo:", error);
        setCoverImageLoading(false);
      });
    }
  };

  const handleCancelCoverEdit = () => {
    setShowEditCoverModal(false);
    setSelectedCoverImage(null);
    setCoverImagePreview(null);
  };

  return (
    // <div className="w-full px-0 sm:px-15 md:px-0 xl:px-0">
    <div className="w-full max-w-7xl mx-auto">
      {isViewAsPublic && (
        <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between rounded-t-md">
          <div className="flex items-center gap-2">
            <FaEye />
            <span className="text-sm font-medium">You are viewing your profile as the public sees it</span>
          </div>
          <Link
            href={`/${profile?.client?.username}`}
            className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50 transition"
          >
            Exit Public View
          </Link>
        </div>
      )}
      {/* Cover Photo */}
      <div className="cover-photo rounded-md relative w-full h-90 overflow-hidden group">
        <div className="absolute inset-0 w-full">
          <Image
            alt="oldclubman"
            ref={coverImageRef}
            width={1920}
            height={1080}
            src={getClientImageUrl(data?.client?.cover_photo, "/oldman-bg.jpg")}
            className="w-full h-full object-cover"
            onLoad={handleCoverImageLoad}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/oldman-bg.jpg";
            }}
            crossOrigin="anonymous"
          />
        </div>

        {/* Edit Cover Photo Button */}
        {data?.client && isMyProfile && (
          <div className="absolute bottom-4 right-4">
            <button
              onClick={() => setShowEditCoverModal(true)}
              className="bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-700 px-3 py-2 rounded-md flex items-center gap-2 shadow-md transition-all duration-200 opacity-0 group-hover:opacity-100"
            >
              <FaCamera className="text-sm" />
              <span className="text-sm font-medium">Edit Cover</span>
            </button>
          </div>
        )}
      </div>

      {/* Profile Section */}
      {!hideProfileSection && (
        <div className="data-section bg-white px-6 py-4 relative">
          <div className="flex justify-between ">
            <div className="flex items-end">
              {/* Profile Picture */}
              <div className="data-pic relative -mt-16 mr-4">
                <div className="w-28 -mt-30 h-28 rounded-full border-4 border-white overflow-hidden bg-white flex items-center justify-center text-white text-2xl">
                  <Image
                    alt="oldclubman"
                    width={100}
                    height={100}
                    src={getClientImageUrl(data?.client?.image)}
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/common-avator.jpg";
                    }}
                  />
                </div>
                {/* Edit Photo Overlay */}
                {data?.client && isMyProfile && (
                  <div
                    className="absolute cursor-pointer flex items-center justify-center bottom-3 right-2 w-7 h-7 bg-gray-400 rounded-full"
                    onClick={() => setShowEditPhotoModal(true)}
                  >
                    <div className="text-black text-sm font-medium flex flex-col items-center">
                      <FaCamera className="" />
                    </div>
                  </div>
                )}

              </div>

              {/* Profile Info */}
              <div className="data-info mb-2">
                <Link href={`/${data?.client?.username}`}>
                  <h2 className="text-xl font-bold hover:underline">
                    {data?.client
                      ? data?.client?.display_name || data?.client?.fname + " " + data?.client?.last_name
                      : "Loading..."}
                  </h2>
                </Link>

                <p className="text-gray-600 text-sm">
                  <Link
                    href={`/${userProfile ? params?.username : profile?.client?.username
                      }/friends`}
                  >
                    <span className="hover:underline">
                      {data.followers && data.followers} Followers
                    </span>
                  </Link>{" "}
                  ·{" "}
                  <Link
                    href={`/${userProfile ? params?.username : profile?.client?.username
                      }/friends`}
                  >
                    <span className="hover:underline">
                      {data.following && data.following} Following
                    </span>
                  </Link>
                </p>
                {showFriends && (
                  <div className="flex items-center mt-2">
                    {data?.latest_eight_followers?.map((res, index) => {
                      return (
                        <div
                          key={index}
                          className={`${index !== 0 ? "-ml-2" : ""
                            } cursor-pointer rounded-full w-8 h-8 border-2 border-white overflow-hidden`}
                        >
                          <Link
                            href={`/${userProfile ? params?.id : profile?.client?.id
                              }/friends`}
                          >
                            <img
                              src={getClientImageUrl(res?.follower_client?.image)}
                              alt={`Profile ${index + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "/common-avator.jpg";
                              }}
                            />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* More Options */}
            {data?.client && (
              <div className="relative ">
                {userProfile && !isMyProfile && (
                  <button
                    className={`px-3 py-1 ${userProfileData?.isfollowed === 1
                      ? "bg-red-200"
                      : "bg-blue-200"
                      } mt-2 cursor-pointer rounded font-semibold transition`}
                    onClick={() => {
                      handleFollow(data?.client?.id);
                    }}
                  >
                    <span className="flex gap-2">
                      <FaUserTie className="mt-1" />{" "}
                      {followLoading
                        ? "Loading..."
                        : userProfileData?.isfollowed === 1
                          ? "UnFollow"
                          : "Follow"}
                    </span>
                  </button>
                )}
                {showMsgBtn && !isMyProfile && (
                  <button
                    onClick={() => { handleMsgButtonSelect(data?.client?.id) }}
                    className="px-3 py-1 bg-blue-600 text-white ml-1 rounded-sm hover:bg-blue-700 cursor-pointer"
                  >
                    <span className="flex gap-2">
                      <LuMessageCircleMore className="mt-1" /> Message
                    </span>
                  </button>
                )}
                {(showEditBtn || isMyProfile) && (
                  <button className="px-3 mr-2 py-1 bg-gray-300 text-black ml-1 rounded-sm hover:bg-gray-200 cursor-pointer">
                    <Link href={`/user/account-settings`} className="flex gap-2">
                      <FaEdit className="mt-1" /> Edit Profile
                    </Link>
                  </button>
                )}


                {/* <button>
            <div className="relative ">
              <button
                className="text-gray-600 bg-gray-200 hover:bg-gray-300 p-2 rounded-md cursor-pointer"
                onClick={toggleDropdown}
              >
                <FaEllipsisH />
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-10">
                  <div className="py-2">
                    <button className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-100">
                      <span className="text-gray-700">View As</span>
                    </button>
                    <Link
                      href="/user/account-settings"
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-100"
                    >
                      <span className="text-gray-700">Edit Profile</span>
                    </Link>
                    <Link
                      href="/user/account-settings"
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-100"
                    >
                      <span className="text-gray-700">Promote Profile</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
            </button> */}

              </div>)}
          </div>
        </div>
      )}

      {/* Navigation Menu - Three Dot Dropdown */}
      <div className="data-nav rounded-b-md bg-white border-t border-b border-gray-200">
        <div className="mx-auto">
          <div className="flex justify-end items-center px-4 py-2">
            <div className="relative">
              <button
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                onClick={() => setShowNavDropdown(!showNavDropdown)}
                aria-label="Navigation menu"
              >
                <FaEllipsisH className="text-xl" />
              </button>

              {showNavDropdown && (
                <>
                  {/* Backdrop to close dropdown when clicking outside */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowNavDropdown(false)}
                  />

                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                    <div className="py-2">
                      <Link
                        href="/user/nfc"
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors ${isLinkActive("/user/nfc")
                          ? "text-blue-600 bg-blue-50"
                          : "text-gray-700"
                          }`}
                        onClick={() => setShowNavDropdown(false)}
                      >
                        <FaIdCard className="text-lg" />
                        <span className="font-medium">NFC</span>
                      </Link>

                      <Link
                        href={`/${isMyProfile ? profile?.client?.username : params.username}/about`}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors ${isLinkActive("/user/about") || isLinkActive(`/${params.username}/about`)
                          ? "text-blue-600 bg-blue-50"
                          : "text-gray-700"
                          }`}
                        onClick={() => setShowNavDropdown(false)}
                      >
                        <FaInfoCircle className="text-lg" />
                        <span className="font-medium">About</span>
                      </Link>

                      <Link
                        href="/"
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors ${isLinkActive("/")
                          ? "text-blue-600 bg-blue-50"
                          : "text-gray-700"
                          }`}
                        onClick={() => setShowNavDropdown(false)}
                      >
                        <FaBullhorn className="text-lg" />
                        <span className="font-medium">Gathering</span>
                      </Link>

                      {(userProfile || friendsTab) && (
                        <>
                          <div className="border-t border-gray-200 my-2"></div>

                          <Link
                            href={`/${userProfile ? params?.username : profile?.client?.username
                              }/friends`}
                            className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors ${isLinkActive(
                              `/${params?.username || params?.id || profile?.client?.username || profile?.client?.id
                              }/friends`
                            )
                              ? "text-blue-600 bg-blue-50"
                              : "text-gray-700"
                              }`}
                            onClick={() => setShowNavDropdown(false)}
                          >
                            <FaUsers className="text-lg" />
                            <span className="font-medium">Followers</span>
                          </Link>

                          <Link
                            href="/user/account-settings"
                            className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors ${isLinkActive("/user/account-settings")
                              ? "text-blue-600 bg-blue-50"
                              : "text-gray-700"
                              }`}
                            onClick={() => setShowNavDropdown(false)}
                          >
                            <FaCog className="text-lg" />
                            <span className="font-medium">Settings</span>
                          </Link>

                          {isMyProfile && (
                            <>
                              <div className="border-t border-gray-200 my-2"></div>
                              <Link
                                href={`/${profile?.client?.username}?viewas=public`}
                                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors text-gray-700"
                                onClick={() => setShowNavDropdown(false)}
                              >
                                <FaEye className="text-lg" />
                                <span className="font-medium">View as Public</span>
                              </Link>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Box */}
      {showChatBox && currentChat && (
        <ChatBox
          user={data?.client}
          currentChat={currentChat}
          onClose={() => {
            setShowChatBox(false);
            setCurrentChat(null);
          }}
        />
      )}

      {/* Edit Photo Modal */}
      {showEditPhotoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-center items-center mb-4 relative">
              <h2 className="text-xl font-bold text-center">Change Profile Photo</h2>
              <button
                onClick={handleCancelEdit}
                className="absolute right-0 text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <div className="flex flex-col items-center">
                {/* Current/Preview Image */}
                {selectedImage &&
                  <div className="w-32 h-32 rounded-full border-4 border-gray-200 overflow-hidden mb-4">
                    <img
                      src={
                        imagePreview || getClientImageUrl(data?.client?.image)
                      }
                      className="w-full h-full object-cover"
                      alt="Profile Preview"
                    />
                  </div>}

                {/* File Input */}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="photo-upload"
                />
                <label
                  htmlFor="photo-upload"
                  className="border border-gray-200 text-black px-4 py-1 hover:bg-gray-200  rounded cursor-pointer transition-colors"
                >
                  + Upload Photo
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-center space-x-3">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-1 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveImage}
                disabled={!selectedImage || profileImageLoading}
                className={`px-4 py-1 rounded ${selectedImage && !profileImageLoading
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
              >
                {profileImageLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Cover Photo Modal */}
      {showEditCoverModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit Cover Photo</h2>
              <button
                onClick={handleCancelCoverEdit}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <div className="flex flex-col items-center">
                {/* Current/Preview Cover Image */}
                <div className="w-full h-40 rounded-lg border-4 border-gray-200 overflow-hidden mb-4">
                  <img
                    src={
                      coverImagePreview || getClientImageUrl(data?.client?.cover_photo, "/oldman-bg.jpg")
                    }
                    className="w-full h-full object-cover"
                    alt="Cover Preview"
                  />
                </div>

                {/* File Input */}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageSelect}
                  className="hidden"
                  id="cover-photo-upload"
                />
                <label
                  htmlFor="cover-photo-upload"
                  className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600 transition-colors"
                >
                  Choose Cover Photo
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelCoverEdit}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCoverImage}
                disabled={!selectedCoverImage || coverImageLoading}
                className={`px-4 py-2 rounded ${selectedCoverImage && !coverImageLoading
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
              >
                {coverImageLoading ? 'Saving...' : 'Save Cover Photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FeedHeader;
