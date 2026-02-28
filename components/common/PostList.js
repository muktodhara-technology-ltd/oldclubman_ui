"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback, memo } from "react";
import {
  FaEllipsisH,
  FaVideo,
  FaGlobe,
  FaComment,
  FaLock,
  FaGlobeAmericas,
  FaFacebookMessenger,
  FaLink,
  FaUserFriends,
  FaUsers,
  FaBookOpen,
  FaTimes,
  FaRegSmile,
  FaLinkedin,
  FaFacebookF,
  FaSearch
} from "react-icons/fa";
import { SlLike } from "react-icons/sl";
import { IoIosShareAlt, IoMdShareAlt, IoLogoWhatsapp } from "react-icons/io";
import { FaRegComment, FaXTwitter } from "react-icons/fa6";
import { BsMessenger } from "react-icons/bs";
import { useDispatch, useSelector } from "react-redux";
import {
  bindPostData,
  deletePost,
  deletePostReaction,
  getGathering,
  getPostById,
  getPosts,
  initialPostData,
  setPostModalOpen,
  storeComments,
  storePostReactions,
  storeReactions,
  updatePost,
  updatePostPrivacy,
  likeComment,
  replyToComment,
  getCommentReplies,
  likeReply,
  sharePost,
} from "../../views/gathering/store";
import moment from "moment";
import Link from "next/link";
import { CiEdit, CiUnlock } from "react-icons/ci";
import { MdOutlineDeleteOutline } from "react-icons/md";
import { TbMessageReport } from "react-icons/tb";
import { useParams, useRouter } from "next/navigation";
import { getMyProfile, getUserProfile, getUserProfileByUsername, getAllFollowers, followTo, unFollowTo } from "@/views/settings/store";
import { sendMessage, startConversation } from "@/views/message/store";
import toast from "react-hot-toast";
import Image from "next/image";
import CommentThread from "./CommentThread";

import api from "@/helpers/axios";
import { getImageUrl } from "@/utility"; // Import helper
import PostCommentsModal from "./PostCommentsModal";
import { usePostComments } from "@/contexts/PostCommentsContext";
import { useChatBox } from "@/contexts/ChatBoxContext";

// Helper function to get client image URL without duplication
const getClientImageUrl = (imagePath, fallback = "/common-avator.jpg") => {
  if (!imagePath) return fallback;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  return process.env.NEXT_PUBLIC_FILE_PATH + imagePath;
};

const PostList = ({ postsData }) => {
  const { basicPostData } = useSelector(({ gathering }) => gathering);
  const { profile, myFollowers } = useSelector(({ settings }) => settings);
  const { allChat } = useSelector(({ chat }) => chat);
  const dispatch = useDispatch();
  const params = useParams();
  const router = useRouter();
  const mapRefs = useRef({});
  const mapInstances = useRef({});

  // Post Comments Context for notification-triggered modal
  const { shouldOpenModal, consumePendingRequest } = usePostComments();
  const { openChat } = useChatBox();

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        if (isMounted) {
          await Promise.all([
            dispatch(getGathering()),
            dispatch(getPosts(1)),
            dispatch(getAllFollowers())
          ]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [dispatch]);



  const [showReactionsFor, setShowReactionsFor] = useState(null);
  const [showCommentReactionsFor, setShowCommentReactionsFor] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});

  // Debug: Log commentInputs changes
  useEffect(() => {
    console.log('🔄 commentInputs changed:', commentInputs);
  }, [commentInputs]);

  const [commentLikes, setCommentLikes] = useState({});
  const [replyInputs, setReplyInputs] = useState({});
  const [commentReplies, setCommentReplies] = useState({});
  const [openDropdownFor, setOpenDropdownFor] = useState(null);
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState(null);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [modalCommentLikes, setModalCommentLikes] = useState({});
  const [modalReplyInputs, setModalReplyInputs] = useState({});
  // Track selected images for each reply input in modal (keyed by inputKey)
  const [modalReplyImages, setModalReplyImages] = useState({});
  const [modalReplies, setModalReplies] = useState({});
  const [loadingReplies, setLoadingReplies] = useState({});
  const [showShareModal, setShowShareModal] = useState(false);
  const [postToShare, setPostToShare] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [showMessengerSelect, setShowMessengerSelect] = useState(false);
  const [selectedShareUsers, setSelectedShareUsers] = useState(new Set());
  const [batchShareLoading, setBatchShareLoading] = useState(false);
  const [shareSearchQuery, setShareSearchQuery] = useState("");
  const [shareSearchResults, setShareSearchResults] = useState([]);
  const isSharingRef = useRef(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewImages, setPreviewImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null); // stores the input key for which emoji picker is open
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('smileys');
  const [profilePopup, setProfilePopup] = useState({ isVisible: false, userId: null, position: { x: 0, y: 0 }, profileData: null });
  const [followLoading, setFollowLoading] = useState(false);
  const hidePopupTimeoutRef = useRef(null);

  const profilePopupAnchorRef = useRef(null);

  // Effect to handle notification-triggered post comments modal
  useEffect(() => {
    if (shouldOpenModal && basicPostData?.id) {
      // Consume the pending request and open the modal
      const postId = consumePendingRequest();
      if (postId && basicPostData?.id == postId) {
        setShowCommentsModal(true);
      }
    }
  }, [shouldOpenModal, basicPostData?.id, consumePendingRequest]);

  // Refs for input elements (text inputs) and file inputs
  const inputRefs = useRef({});
  const fileInputRefs = useRef({});

  // Handle clicking the photo button to trigger file input
  const handleReplyImageClick = useCallback((inputKey) => {
    const fileInput = fileInputRefs.current?.[inputKey];
    if (fileInput) {
      fileInput.click();
    }
  }, []);

  // Handle file selection for reply/comment images
  const handleReplyImageChange = useCallback((e, inputKey) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));

    setModalReplyImages(prev => ({
      ...prev,
      [inputKey]: [...(prev[inputKey] || []), ...newImages]
    }));

    // Reset the input so the same file can be selected again
    e.target.value = '';
  }, []);

  // Clear a specific image from reply/comment
  const clearReplyImage = useCallback((inputKey, imageIndex) => {
    setModalReplyImages(prev => {
      const currentImages = prev[inputKey] || [];
      const imageToRemove = currentImages[imageIndex];

      // Revoke the object URL to free memory
      if (imageToRemove?.preview) {
        URL.revokeObjectURL(imageToRemove.preview);
      }

      const newImages = currentImages.filter((_, idx) => idx !== imageIndex);

      if (newImages.length === 0) {
        const { [inputKey]: _, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [inputKey]: newImages
      };
    });
  }, []);

  const emojiCategories = useMemo(() => ({
    smileys: {
      name: 'Smileys & People',
      emojis: ['😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '😘', '🥰', '😗', '😙', '😚', '☺️', '🙂', '🤗', '🤩', '🤔', '🫡', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '🥱', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🫠', '🤑', '😲', '☹️', '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩', '🤯', '😬', '😰', '😱', '🥵', '🥶', '😳', '🤪', '😵', '🥴', '😠', '😡', '🤬', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '😇', '🥳', '🥺', '🤠', '🤡', '🤥', '🤫', '🤭', '🧐', '🤓', '😈', '👿', '👹', '👺', '💀', '👻', '👽', '🤖', '💩']
    },
    animals: {
      name: 'Animals & Nature',
      emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦫']
    },
    food: {
      name: 'Food & Drink',
      emojis: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯']
    },
    activities: {
      name: 'Activities',
      emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️‍♀️', '🏋️', '🏋️‍♂️', '🤼‍♀️', '🤼', '🤼‍♂️', '🤸‍♀️', '🤸', '🤸‍♂️', '⛹️‍♀️', '⛹️', '⛹️‍♂️', '🤺', '🤾‍♀️', '🤾', '🤾‍♂️', '🏌️‍♀️', '🏌️', '🏌️‍♂️', '🏇', '🧘‍♀️', '🧘', '🧘‍♂️', '🏄‍♀️', '🏄', '🏄‍♂️', '🏊‍♀️', '🏊', '🏊‍♂️', '🤽‍♀️', '🤽', '🤽‍♂️', '🚣‍♀️', '🚣', '🚣‍♂️', '🧗‍♀️', '🧗', '🧗‍♂️', '🚵‍♀️', '🚵', '🚵‍♂️', '🚴‍♀️', '🚴', '🚴‍♂️', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️']
    },
    objects: {
      name: 'Objects',
      emojis: ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⏳', '⌛', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🔩', '⚙️', '🪚', '🔫', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🪠', '🧽', '🧴', '🧷', '🧼', '🪥', '🪒', '🧻', '🚽', '🚿', '🛁', '🪤', '🪣', '🔑', '🗝️']
    },
    symbols: {
      name: 'Symbols',
      emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠']
    }
  }), []);

  // Handle emoji selection
  const handleEmojiSelect = useCallback((emoji, inputKey) => {
    console.log('😊 Emoji selected:', { emoji, inputKey });

    if (inputKey.includes("reply")) {
      setModalReplyInputs((prev) => {
        const currentValue = prev[inputKey] || '';
        console.log('😊 Reply input - Current value:', currentValue);
        return {
          ...prev,
          [inputKey]: currentValue + emoji,
        };
      });

      // Focus the input after emoji selection
      setTimeout(() => {
        const inputElement = inputRefs.current[inputKey];
        if (inputElement) {
          inputElement.focus();
          // Move cursor to end
          const length = inputElement.value.length;
          inputElement.setSelectionRange(length, length);
        }
      }, 10);
    } else if (inputKey.includes("comment")) {
      // Handle both "post-comment-ID" and "modal-comment-ID" formats
      // Extract postId by removing the prefix (post-comment- or modal-comment-)
      const postId = inputKey.replace(/^(post-comment-|modal-comment-)/, '');
      console.log('😊 Comment input - PostId:', postId, 'InputKey:', inputKey);

      setCommentInputs((prev) => {
        const currentValue = prev[postId] || '';
        const newValue = currentValue + emoji;
        console.log('😊 Comment input - PostId:', postId);
        console.log('😊 Comment input - Current:', currentValue);
        console.log('😊 Comment input - New:', newValue);
        console.log('😊 Comment input - Previous state:', prev);
        const newState = {
          ...prev,
          [postId]: newValue,
        };
        console.log('😊 Comment input - New state:', newState);
        return newState;
      });

      // Focus the input after emoji selection
      setTimeout(() => {
        const inputElement = inputRefs.current[inputKey];
        console.log('😊 Trying to focus input:', inputKey, 'Element:', inputElement);
        if (inputElement) {
          inputElement.focus();
          // Move cursor to end
          setTimeout(() => {
            const length = inputElement.value.length;
            inputElement.setSelectionRange(length, length);
          }, 5);
        }
      }, 10);
    }
    setShowEmojiPicker(null); // Close emoji picker
  }, []);

  // Handle emoji picker toggle
  const toggleEmojiPicker = useCallback((inputKey) => {
    setShowEmojiPicker(prev => prev === inputKey ? null : inputKey);
  }, []);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showEmojiPicker && !event.target.closest('.emoji-picker-container')) {
        setShowEmojiPicker(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hidePopupTimeoutRef.current) {
        clearTimeout(hidePopupTimeoutRef.current);
      }
    };
  }, []);


  // Load Leaflet assets function
  const loadLeafletAssets = () => {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.L) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const existingCss = document.querySelector('link[href*="leaflet.css"]');
      if (!existingCss) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        link.crossOrigin = '';
        document.head.appendChild(link);
      }

      const existingJs = document.querySelector('script[src*="leaflet@1.9.4"]');
      if (existingJs) {
        existingJs.addEventListener('load', () => resolve());
        existingJs.addEventListener('error', reject);
        if (window.L) resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => resolve();
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };


  // Initialize map for a post
  const initMapForPost = async (postId, postLocations) => {
    if (!postLocations || postLocations.length === 0) return;

    await loadLeafletAssets();

    const containerId = `map-container-${postId}`;
    const container = document.getElementById(containerId);

    if (!container) {
      console.error('Map container not found:', containerId);
      return;
    }

    if (mapInstances.current[postId]) {
      return; // Map already initialized
    }

    // Clean up if container already has leaflet instance
    if (container._leaflet_id) {
      container._leaflet_id = null;
      container.innerHTML = '';
    }

    const L = window.L;
    if (!L) {
      console.error('Leaflet library not loaded');
      return;
    }

    try {
      // Set max zoom limit to prevent excessive zooming
      const MAX_ZOOM = 18; // Reduced from 20 to avoid tile loading issues
      const MIN_ZOOM = 3;

      const map = L.map(container, {
        maxZoom: MAX_ZOOM,
        minZoom: MIN_ZOOM
      });

      // Use OpenStreetMap tiles (free, no API key required)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: MAX_ZOOM,
        minZoom: MIN_ZOOM
      }).addTo(map);

      mapInstances.current[postId] = map;

      const bounds = [];
      const markers = [];

      // Process locations
      const checkIn = postLocations.find(loc => loc.post_type === 1);
      const destination = postLocations.find(loc => loc.post_type === 2);

      // Add check-in marker
      if (checkIn && checkIn.lat && checkIn.lon) {
        const checkInLat = parseFloat(checkIn.lat);
        const checkInLon = parseFloat(checkIn.lon);
        if (!isNaN(checkInLat) && !isNaN(checkInLon)) {
          const marker = L.marker([checkInLat, checkInLon], {
            icon: L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41]
            })
          }).addTo(map);
          marker.bindPopup(`<b>${checkIn.place_name || 'Check-in'}</b>`);
          markers.push(marker);
          bounds.push([checkInLat, checkInLon]);
        }
      }

      // Add destination marker
      if (destination && destination.lat && destination.lon) {
        const destLat = parseFloat(destination.lat);
        const destLon = parseFloat(destination.lon);
        if (!isNaN(destLat) && !isNaN(destLon)) {
          const marker = L.marker([destLat, destLon], {
            icon: L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41]
            })
          }).addTo(map);
          marker.bindPopup(`<b>${destination.place_name || 'Destination'}</b>`);
          markers.push(marker);
          bounds.push([destLat, destLon]);
        }
      }

      // Draw route line if both exist
      if (checkIn && destination && checkIn.lat && checkIn.lon && destination.lat && destination.lon) {
        try {
          // Create curved path by adding intermediate control points
          // Ensure coordinates are numbers
          const startLat = parseFloat(checkIn.lat);
          const startLon = parseFloat(checkIn.lon);
          const endLat = parseFloat(destination.lat);
          const endLon = parseFloat(destination.lon);

          // Validate coordinates
          if (isNaN(startLat) || isNaN(startLon) || isNaN(endLat) || isNaN(endLon)) {
            console.error('Invalid coordinates for route line');
            // Skip curve drawing but continue with map initialization
            throw new Error('Invalid coordinates');
          }

          // Calculate midpoint
          const midLat = (startLat + endLat) / 2;
          const midLon = (startLon + endLon) / 2;

          // Calculate distance between points
          const latDiff = endLat - startLat;
          const lonDiff = endLon - startLon;

          // Create curve by offsetting midpoint perpendicular to the line
          // Offset factor controls the curve intensity (smaller = more subtle curve)
          const offsetFactor = 0.3;
          const perpLat = -lonDiff * offsetFactor;
          const perpLon = latDiff * offsetFactor;

          const curveLat = midLat + perpLat;
          const curveLon = midLon + perpLon;

          // Generate smooth curve points using quadratic Bezier approximation
          const curvePoints = [];
          const numPoints = 20; // Number of points for smooth curve

          for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            // Quadratic Bezier curve formula: (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
            const lat = (1 - t) * (1 - t) * startLat + 2 * (1 - t) * t * curveLat + t * t * endLat;
            const lon = (1 - t) * (1 - t) * startLon + 2 * (1 - t) * t * curveLon + t * t * endLon;
            curvePoints.push([lat, lon]);
          }

          L.polyline(curvePoints, {
            color: '#2563eb',
            weight: 4,
            opacity: 0.7,
            dashArray: '8, 5', // Creates dotted/dashed line style
            lineCap: 'round', // Rounded line caps
            lineJoin: 'round' // Rounded line joins
          }).addTo(map);
        } catch (error) {
          console.error('Error drawing route line:', error);
          // Fallback to straight line if curve fails
          try {
            L.polyline([
              [parseFloat(checkIn.lat), parseFloat(checkIn.lon)],
              [parseFloat(destination.lat), parseFloat(destination.lon)]
            ], {
              color: '#2563eb',
              weight: 4,
              opacity: 0.7,
              dashArray: '8, 5',
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);
          } catch (fallbackError) {
            console.error('Error drawing fallback route line:', fallbackError);
          }
        }
      }

      // Fit bounds to show all markers with zoom limits
      let hasLargeDistance = false; // Track if we're handling large distances

      if (bounds.length > 0) {
        if (bounds.length === 1) {
          // Set reasonable zoom for single marker (13 is city-level, safer than 15)
          map.setView(bounds[0], 13);
        } else {
          // Calculate distance between points to determine appropriate zoom strategy
          const [lat1, lon1] = bounds[0];
          const [lat2, lon2] = bounds[1];

          // Calculate approximate distance in kilometers using Haversine formula
          const R = 6371; // Earth's radius in km
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distanceKm = R * c;

          // Create a proper LatLngBounds object from the marker positions
          const latLngBounds = L.latLngBounds(bounds);

          // For very large distances (e.g., continents apart), ensure both markers are visible
          if (distanceKm > 1000) {
            hasLargeDistance = true; // Mark that we're handling large distances
            console.log(`Large distance detected: ${distanceKm.toFixed(2)} km between markers`);

            // Keep MIN_ZOOM at 1 for very large distances to allow zooming out enough
            // Don't restore it back to 3, as that causes the map to zoom in
            map.setMinZoom(1);

            // Use fitBounds with zero padding first - this should show both markers
            map.fitBounds(latLngBounds, {
              padding: [0, 0],
              animate: false
            });

            // Verify and fix if needed
            setTimeout(() => {
              const bounds_check = map.getBounds();
              const marker1 = L.latLng(bounds[0]);
              const marker2 = L.latLng(bounds[1]);
              const marker1Visible = bounds_check.contains(marker1);
              const marker2Visible = bounds_check.contains(marker2);

              console.log(`After fitBounds - Marker 1 visible: ${marker1Visible}, Marker 2 visible: ${marker2Visible}`);

              if (!marker1Visible || !marker2Visible) {
                // If not visible, expand bounds by 20% and try again
                const expandedBounds = latLngBounds.pad(0.2);
                map.fitBounds(expandedBounds, {
                  padding: [0, 0],
                  animate: false
                });

                // Check again after expansion
                setTimeout(() => {
                  const secondCheck = map.getBounds();
                  const stillNotVisible = !secondCheck.contains(marker1) || !secondCheck.contains(marker2);

                  if (stillNotVisible) {
                    console.log('Markers still not visible, using world bounds');
                    // Last resort: show entire world to ensure both markers are visible
                    const worldBounds = L.latLngBounds([[-85, -180], [85, 180]]);
                    map.fitBounds(worldBounds, {
                      padding: [0, 0],
                      animate: false
                    });
                  }
                  map.invalidateSize();
                }, 100);
              } else {
                map.invalidateSize();
              }
            }, 200);
          } else {
            // Normal distance - use standard padding and zoom limits
            map.fitBounds(latLngBounds, {
              padding: [50, 50],
              maxZoom: MAX_ZOOM
            });
          }
        }
      } else {
        map.setView([23.8103, 90.4125], Math.max(5, MIN_ZOOM));
      }

      // Only call invalidateSize if we haven't already handled it for large distances
      // For large distances, invalidateSize is called inside the setTimeout above
      if (!hasLargeDistance) {
        setTimeout(() => {
          map.invalidateSize();
        }, 100);
      }
    } catch (error) {
      console.error(`Error initializing map for post ${postId}:`, error);
    }
  };

  // Initialize maps for posts with location data
  useEffect(() => {
    if (!postsData || !Array.isArray(postsData)) return;

    postsData.forEach(item => {
      if (item?.post_location && item.post_location.length > 0 && item.id) {
        // Delay initialization to ensure DOM is ready
        setTimeout(() => {
          initMapForPost(item.id, item.post_location);
        }, 300);
      }
    });

    // Cleanup on unmount
    return () => {
      Object.keys(mapInstances.current).forEach(postId => {
        try {
          if (mapInstances.current[postId]) {
            mapInstances.current[postId].remove();
          }
        } catch (error) {
          console.error('Error cleaning up map:', error);
        }
      });
      mapInstances.current = {};
    };
  }, [postsData]);

  // Create a callback ref for each post
  const setMapContainerRef = (postId, postLocations) => (element) => {
    if (element && !mapInstances.current[postId]) {
      // Small delay to ensure element is fully mounted
      setTimeout(() => {
        initMapForPost(postId, postLocations);
      }, 100);
    }
  };


  const handleCommentSubmit = (postId) => {
    const inputKey = `post-comment-${postId}`;
    const comment = commentInputs[postId];
    const images = modalReplyImages[inputKey] || [];
    const hasImage = Array.isArray(images) && images.length > 0;

    // Process mentions before validation
    const processedComment = processContentForServer(comment);
    console.log('💬 Comment submission:', {
      original: comment,
      processed: processedComment,
      mappingsCount: mentionMappingsRef.current.size,
      availableMappings: Array.from(mentionMappingsRef.current.keys())
    });

    // Check if there's processed content or images
    if (!processedComment?.trim() && !hasImage) return;

    let payload;
    if (hasImage) {
      const fd = new FormData();
      fd.append("post_id", postId);
      if (processedComment) fd.append("content", processedComment);
      images.forEach((img, idx) => {
        if (img?.file) fd.append(`files[${idx}]`, img.file);
      });
      payload = fd;
    } else {
      payload = { post_id: postId, content: processedComment };
    }

    dispatch(storeComments(payload)).then(() => {
      dispatch(getGathering());
      dispatch(getPosts());
      dispatch(getPostById(postId));

      // Clear input and any attached images
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
      setModalReplyImages((prev) => {
        const copy = { ...prev };
        const arr = copy[inputKey] || [];
        arr.forEach((img) => { if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl); });
        delete copy[inputKey];
        return copy;
      });
      const ref = fileInputRefs.current[inputKey];
      if (ref) ref.value = "";
    });
  };

  const handleCommentLike = (postId, commentIndex) => {
    const comment = 1;
    dispatch(likeComment({ commentId: comment.id })).then(() => {
      // Optionally refresh comments or update state
      dispatch(getPosts());
    });
  };

  const handleCommentReaction = (comment_id, reaction) => {
    dispatch(likeComment({ comment_id, reaction_type: reaction })).then(() => {
      setShowCommentReactionsFor(null);
      dispatch(getPosts());
      dispatch(getPostById(basicPostData.id));
    });
  };

  const handleReplyReaction = (reply_id, reaction, commentId, commentIndex) => {
    dispatch(likeReply({ reply_id, type: reaction })).then(() => {
      setShowCommentReactionsFor(null);
      dispatch(getPosts());
      dispatch(getPostById(basicPostData.id));
      handleViewAllReplies(commentId, commentIndex);
    });
  };

  const handleReplySubmit = (postId, commentIndex) => {
    const key = `${postId}-${commentIndex}`;
    const reply = replyInputs[key];
    const comment = 1;
    if (!reply) return;
    dispatch(replyToComment({ commentId: comment.id, content: reply })).then(
      () => {
        // Optionally refresh comments or update state
        dispatch(getPosts());
        setReplyInputs((prev) => ({ ...prev, [key]: "" }));
      }
    );
  };

  const handleReaction = (postId, reaction) => {
    dispatch(
      storePostReactions({ post_id: postId, reaction_type: reaction })
    ).then(() => {
      setShowReactionsFor(null);
      dispatch(getGathering());
      dispatch(getPosts());
      dispatch(getPostById(postId));
      dispatch(getMyProfile());
      const username = profile?.client?.username || params?.id;
      if (username) {
        dispatch(getUserProfileByUsername(username));
      }
    });
  };

  const handleDeleteReaction = (postId) => {
    dispatch(deletePostReaction(postId)).then(() => {
      setShowReactionsFor(null);
      dispatch(getGathering());
      dispatch(getPosts());
      dispatch(getPostById(postId));
      dispatch(getMyProfile());
      const username = profile?.client?.username || params?.id;
      if (username) {
        dispatch(getUserProfileByUsername(username));
      }
    });
  };

  const reactionRef = useRef(null);
  const dropdownRef = useRef(null);
  const commentReactionRef = useRef(null);

  useEffect(() => {
    if (!showReactionsFor) return;
    function handleClickOutside(event) {
      if (reactionRef.current && !reactionRef.current.contains(event.target)) {
        setShowReactionsFor(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showReactionsFor]);

  useEffect(() => {
    if (!showCommentReactionsFor) return;
    function handleClickOutside(event) {
      if (
        commentReactionRef.current &&
        !commentReactionRef.current.contains(event.target)
      ) {
        setShowCommentReactionsFor(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showCommentReactionsFor]);

  useEffect(() => {
    if (openDropdownFor === null) return;
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdownFor(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdownFor]);

  // Mention system (modal only)
  const [mentionOpenFor, setMentionOpenFor] = useState(null); // key of active input
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionOptions, setMentionOptions] = useState([]);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionPage, setMentionPage] = useState(1);
  const [mentionHasMore, setMentionHasMore] = useState(true);
  const mentionMetaRef = useRef({}); // { [inputKey]: { anchor: number } }
  const mentionDropdownRef = useRef(null);
  const mentionAbortControllerRef = useRef(null);

  const measureCanvasRef = useRef(null);

  const resetMentionState = useCallback((options = { abortRequest: true }) => {
    const { abortRequest } = options;

    setMentionOpenFor(null);
    setMentionQuery("");
    setMentionOptions([]);
    setMentionActiveIndex(0);
    setMentionPage(1);
    setMentionHasMore(true);
    setMentionLoading(false);
    mentionMetaRef.current = {};

    if (abortRequest && mentionAbortControllerRef.current) {
      mentionAbortControllerRef.current.abort();
      mentionAbortControllerRef.current = null;
    }
  }, []);

  const buildMentionCandidates = useCallback((query = "") => {
    // Collect users from multiple sources
    let allUsers = [];

    // Add followers
    if (myFollowers && myFollowers.length > 0) {
      const followerUsers = myFollowers.map(f => ({
        id: f?.follower_client?.id,
        fname: f?.follower_client?.fname || "",
        last_name: f?.follower_client?.last_name || "",
        image: f?.follower_client?.image,
        source: "follower"
      }));
      allUsers.push(...followerUsers);
    }

    // Add users from current post's comments
    if (basicPostData?.comments) {
      const commentUsers = basicPostData.comments.map(c => ({
        id: c.client_id,
        fname: c?.client_comment?.fname || "",
        last_name: c?.client_comment?.last_name || "",
        image: c?.client_comment?.image,
        source: "comment"
      }));
      allUsers.push(...commentUsers);

      // Add users from replies
      basicPostData.comments.forEach(c => {
        if (c.replies) {
          const replyUsers = c.replies.map(r => ({
            id: r.client_id,
            fname: r?.client_comment?.fname || "",
            last_name: r?.client_comment?.last_name || "",
            image: r?.client_comment?.image,
            source: "reply"
          }));
          allUsers.push(...replyUsers);
        }
      });
    }

    // Remove duplicates by ID and create final list
    const uniqueUsers = allUsers.reduce((acc, user) => {
      const fullName = `${user.fname} ${user.last_name}`.trim();
      if (fullName && !acc.find(u => u.id === user.id)) {
        acc.push({
          id: user.id,
          name: fullName,
          avatar: getClientImageUrl(user.image),
          source: user.source
        });
      }
      return acc;
    }, []);

    // Filter by query
    const q = query.toLowerCase();
    const filtered = uniqueUsers.filter((u) => u.id && u.name && (!q || u.name.toLowerCase().includes(q)));

    console.log('Built candidates:', {
      query,
      totalUsers: allUsers.length,
      allUsersDetails: allUsers.map(u => ({ id: u.id, name: `${u.fname} ${u.last_name}`.trim(), source: u.source })),
      uniqueUsers: uniqueUsers.length,
      uniqueUsersDetails: uniqueUsers.map(u => ({ id: u.id, name: u.name, source: u.source })),
      filtered: filtered.length,
      candidates: filtered
    });

    return filtered.slice(0, 8);
  }, [myFollowers, basicPostData]);

  // API function to fetch mentioned people with pagination
  const fetchMentionedPeople = useCallback(async (query = "", page = 1, append = false) => {
    try {
      // Cancel previous request if exists
      if (mentionAbortControllerRef.current) {
        mentionAbortControllerRef.current.abort();
      }

      // Create new AbortController for this request
      mentionAbortControllerRef.current = new AbortController();

      setMentionLoading(true);

      const itemsPerPage = 10; // Number of items to fetch per page
      console.log('🔍 Fetching mentioned people:', { query, page, itemsPerPage, append });

      const response = await api.get(`/client/mentioned_people/${itemsPerPage}`, {
        params: {
          search: query,
          page: page
        },
        signal: mentionAbortControllerRef.current.signal
      });

      console.log('🔍 API Response:', response.data);

      if (response.data && response.data.data && response.data.data.follow_connections && response.data.data.follow_connections.data) {
        const users = response.data.data.follow_connections.data.map(user => ({
          id: user.id,
          name: user.display_name ||
            `${user.fname || ''} ${user.middle_name ? user.middle_name + ' ' : ''}${user.last_name || ''}`.trim() ||
            'Unknown User',
          avatar: getClientImageUrl(user.image),
          source: "api",
          rawData: user
        }));

        // Update mention options based on append flag
        if (append) {
          setMentionOptions(prev => [...prev, ...users]);
        } else {
          setMentionOptions(users);
        }

        // Update pagination state
        const paginationData = response.data.data.follow_connections;
        const hasMore = paginationData.current_page < paginationData.last_page;
        setMentionHasMore(hasMore);

        console.log('🔍 Pagination info:', {
          currentPage: paginationData.current_page,
          lastPage: paginationData.last_page,
          hasMore,
          totalUsers: paginationData.total,
          usersThisPage: users.length
        });

        return users;
      }

      return [];
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching mentioned people:', error);

        // Fallback to local data on error (only for first page)
        if (!append) {
          console.log('🔄 Falling back to local data');
          const fallbackUsers = buildMentionCandidates(query);
          setMentionOptions(fallbackUsers);
          return fallbackUsers;
        }
      }

      return [];
    } finally {
      setMentionLoading(false);
      mentionAbortControllerRef.current = null;
    }
  }, [buildMentionCandidates]);

  const getInputValueByKey = useCallback((inputKey) => {
    if (inputKey.startsWith("reply-") || inputKey.startsWith("single-reply-")) {
      return modalReplyInputs[inputKey] || "";
    }
    if (inputKey.startsWith("modal-comment-")) {
      const postId = inputKey.replace("modal-comment-", "");
      return commentInputs[postId] || "";
    }
    if (inputKey.startsWith("post-comment-")) {
      const postId = inputKey.replace("post-comment-", "");
      return commentInputs[postId] || "";
    }
    // Fallback for other formats
    const parts = inputKey.split("-");
    const postId = parts[parts.length - 1];
    return commentInputs[postId] || "";
  }, [modalReplyInputs, commentInputs]);

  const setInputValueByKey = useCallback((inputKey, value) => {
    if (inputKey.startsWith("reply-") || inputKey.startsWith("single-reply-")) {
      setModalReplyInputs((prev) => ({ ...prev, [inputKey]: value }));
      return;
    }
    if (inputKey.startsWith("modal-comment-")) {
      const postId = inputKey.replace("modal-comment-", "");
      setCommentInputs((prev) => ({ ...prev, [postId]: value }));
      return;
    }
    if (inputKey.startsWith("post-comment-")) {
      const postId = inputKey.replace("post-comment-", "");
      setCommentInputs((prev) => ({ ...prev, [postId]: value }));
      return;
    }
    // Fallback for other formats
    const parts = inputKey.split("-");
    const postId = parts[parts.length - 1];
    setCommentInputs((prev) => ({ ...prev, [postId]: value }));
  }, []);

  const calculateCaretOffset = useCallback((inputElement, selectionStart, value) => {
    if (!inputElement) return { left: 0 };
    if (typeof window === 'undefined') return { left: 0 };

    if (!measureCanvasRef.current) {
      measureCanvasRef.current = document.createElement('canvas');
    }

    const canvas = measureCanvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return { left: 0 };

    const style = window.getComputedStyle(inputElement);
    const fontParts = [style.fontStyle, style.fontVariant, style.fontWeight, style.fontSize, style.fontFamily].filter(Boolean);
    context.font = fontParts.join(' ');

    const textBeforeCaret = (value || '').slice(0, selectionStart);
    const textMetrics = context.measureText(textBeforeCaret);
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const scrollLeft = inputElement.scrollLeft || 0;

    const left = paddingLeft + borderLeft + textMetrics.width - scrollLeft;
    return { left };
  }, []);

  const handleMentionDetect = async (e, inputKey) => {
    const value = e.target.value;
    const caret = e.target.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const atIndex = before.lastIndexOf('@');

    console.log('🎯 Mention detect:', { value, before, atIndex, inputKey });

    const shouldReset = () => {
      if (mentionOpenFor === inputKey) {
        resetMentionState();
      }
    };

    if (atIndex === -1) {
      shouldReset();
      return;
    }

    const prevChar = atIndex === 0 ? ' ' : before[atIndex - 1];
    const query = before.slice(atIndex + 1);
    const isValidPrev = /\s|^|[\(\[{]/.test(prevChar);
    const isValidQuery = /^[a-zA-Z0-9._-]*$/.test(query);

    if (!isValidPrev || !isValidQuery) {
      shouldReset();
      return;
    }

    mentionMetaRef.current[inputKey] = { anchor: atIndex };
    setMentionQuery(query);
    setMentionActiveIndex(0);
    setMentionOpenFor(inputKey);

    // Reset pagination state for new search
    setMentionPage(1);
    setMentionHasMore(true);

    await fetchMentionedPeople(query, 1, false);
  };

  // Store mention mappings persistently
  const mentionMappingsRef = useRef(new Map()); // Map of user names to IDs

  const insertMentionToken = useCallback((user, inputKey) => {
    console.log('🔗 insertMentionToken called:', { user: user.name, inputKey });

    // Store the mention mapping persistently (normalize spaces)
    const normalizedName = user.name.toLowerCase().trim().replace(/\s+/g, ' ');
    mentionMappingsRef.current.set(normalizedName, {
      id: user.id,
      name: user.name,
      rawData: user.rawData
    });

    console.log('🔗 Storing mention mapping:', {
      originalName: user.name,
      normalizedKey: normalizedName,
      mappingStored: mentionMappingsRef.current.has(normalizedName),
      totalMappings: mentionMappingsRef.current.size
    });

    const value = getInputValueByKey(inputKey);
    const input = inputRefs.current[inputKey];
    const caret = input?.selectionStart ?? value.length;
    const meta = mentionMetaRef.current[inputKey] || { anchor: value.lastIndexOf("@") };
    const before = value.slice(0, meta.anchor);
    const after = value.slice(caret);
    // Use a cleaner format that's more readable in input fields
    const token = `@${user.name} `;
    const newValue = before + token + after;

    console.log('🔗 Inserting mention:', { before, token, after, newValue });
    console.log('🔗 Stored mention mapping:', mentionMappingsRef.current.get(normalizedName));

    setInputValueByKey(inputKey, newValue);
    resetMentionState({ abortRequest: false });
    setTimeout(() => {
      if (input) {
        const newCaret = (before + token).length;
        input.focus();
        input.setSelectionRange(newCaret, newCaret);
      }
    }, 0);
  }, [resetMentionState, getInputValueByKey, setInputValueByKey]);

  // Handle infinite scrolling in mention dropdown
  useEffect(() => {
    if (!mentionOpenFor) return;

    const handleClickOutside = (event) => {
      const dropdownEl = mentionDropdownRef.current;
      const activeInput = inputRefs.current[mentionOpenFor];

      if (dropdownEl && dropdownEl.contains(event.target)) return;
      if (activeInput && activeInput.contains(event.target)) return;

      resetMentionState();
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mentionOpenFor, resetMentionState]);

  const handleMentionScroll = useCallback(async (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 10;

    if (isNearBottom && mentionHasMore && !mentionLoading) {
      console.log('🔄 Loading more mentions...', {
        currentPage: mentionPage,
        nextPage: mentionPage + 1,
        query: mentionQuery
      });

      const nextPage = mentionPage + 1;
      setMentionPage(nextPage);

      // Fetch next page and append to existing results
      await fetchMentionedPeople(mentionQuery, nextPage, true);
    }
  }, [mentionHasMore, mentionLoading, mentionPage, mentionQuery, fetchMentionedPeople]);

  // Reusable mention dropdown component with pagination
  const renderMentionDropdown = useCallback((inputKey) => {


    if (mentionOpenFor !== inputKey || (mentionOptions.length === 0 && !mentionLoading)) {
      return null;
    }

    // Calculate position for fixed dropdown
    const inputElement = inputRefs.current[inputKey];
    let dropdownStyle = null;

    if (inputElement && typeof window !== 'undefined') {
      const anchor = inputElement.closest('[data-mention-anchor="true"]') || inputElement;
      const anchorRect = anchor.getBoundingClientRect();
      const viewportPadding = 12;
      const anchorWidth = anchor.clientWidth || anchorRect.width;
      const minWidth = Math.min(260, window.innerWidth - viewportPadding * 2);
      const dropdownWidth = Math.min(Math.max(inputElement.offsetWidth || anchorWidth, minWidth), anchorWidth);

      const value = getInputValueByKey(inputKey) || '';
      const selectionStart = inputElement.selectionStart ?? value.length;
      const caretOffset = calculateCaretOffset(inputElement, selectionStart, value);
      const caretBaseLeft = caretOffset.left;

      const spaceBelow = anchorRect.height - (inputElement.offsetTop + inputElement.offsetHeight) + 4;
      const spaceAbove = inputElement.offsetTop - 4;
      const preferredHeight = 240;
      let maxHeight = preferredHeight;
      let top = inputElement.offsetTop + inputElement.offsetHeight + 4;

      if (spaceBelow < 160 && spaceAbove > spaceBelow) {
        maxHeight = Math.min(preferredHeight, Math.max(160, spaceAbove));
        top = Math.max(0, inputElement.offsetTop - maxHeight - 4);
      } else {
        maxHeight = Math.min(preferredHeight, Math.max(160, spaceBelow));
      }

      const desiredLeft = caretBaseLeft - dropdownWidth / 2;
      const maxLeft = Math.max(0, anchorWidth - dropdownWidth);
      const left = Math.max(0, Math.min(desiredLeft, maxLeft));

      dropdownStyle = {
        position: 'absolute',
        left,
        top,
        width: dropdownWidth,
        maxHeight,
        overflowY: 'auto',
        zIndex: 11000,
      };
    }


    if (!dropdownStyle) return null;

    return (
      <div
        ref={mentionDropdownRef}
        className="bg-white border rounded-md shadow-xl max-h-56 overflow-auto"
        style={dropdownStyle}
        onScroll={handleMentionScroll}
      >
        {mentionOptions.map((u, idx) => (
          <div
            key={u.id}
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 ${idx === mentionActiveIndex ? 'bg-gray-100' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              insertMentionToken(u, inputKey);
            }}
          >
            <img src={u.avatar} className="w-8 h-8 rounded-full object-cover" alt={u.name} />
            <div className="flex flex-col">
              <span className="text-sm font-medium">{u.name}</span>
              <span className="text-xs text-gray-500">{u.source === 'api' ? 'From API' : u.source}</span>
            </div>
          </div>
        ))}

        {mentionLoading && (
          <div className="flex items-center justify-center py-2 border-t">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-xs text-gray-500">Loading more...</span>
          </div>
        )}

        {!mentionHasMore && mentionOptions.length > 0 && !mentionLoading && (
          <div className="text-center py-2 text-xs text-gray-500 border-t">
            No more results
          </div>
        )}
      </div>
    );
  }, [mentionOpenFor, mentionOptions, mentionActiveIndex, mentionLoading, mentionHasMore, handleMentionScroll, insertMentionToken, calculateCaretOffset, getInputValueByKey]);

  // Helper function to convert @Name format back to [Name](id) for server
  const processContentForServer = useCallback((content, mentionData = {}) => {
    if (!content) return content;

    console.log('🔄 processContentForServer - Original content:', content);

    let processedContent = content;

    // Find all @mentions in the content (simple format)
    // Match @ followed by one or more words (handles multi-word names)
    const mentionRegex = /@([^\s@]+(?:\s+[^\s@]+)*)/g;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      const fullMentionText = match[1].trim();
      console.log('🔄 Found @mention text:', fullMentionText);

      // First, try to find in persistent mention mappings (normalize spaces)
      const lookupKey = fullMentionText.toLowerCase().trim().replace(/\s+/g, ' ');
      console.log('🔄 Looking up mention:', lookupKey, 'in', Array.from(mentionMappingsRef.current.keys()));
      console.log('🔄 Exact key match exists:', mentionMappingsRef.current.has(lookupKey));

      let persistentMapping = mentionMappingsRef.current.get(lookupKey);

      // If exact match not found, try to find partial matches (for cases like "@Name extra text")
      if (!persistentMapping) {
        console.log('🔄 Trying partial matches for:', lookupKey);
        const availableKeys = Array.from(mentionMappingsRef.current.keys());

        // Try to find the longest matching key that starts the fullMentionText
        let bestMatch = null;
        let bestMatchLength = 0;

        for (const key of availableKeys) {
          if (lookupKey.startsWith(key) && key.length > bestMatchLength) {
            bestMatch = key;
            bestMatchLength = key.length;
          }
        }

        if (bestMatch) {
          persistentMapping = mentionMappingsRef.current.get(bestMatch);
          console.log('🔄 Found partial match:', { bestMatch, mapping: persistentMapping });
          // Update fullMentionText to only include the matched part
          const matchedWords = bestMatch.split(' ');
          const originalWords = fullMentionText.toLowerCase().split(' ');
          const matchedText = originalWords.slice(0, matchedWords.length).join(' ');

          // Update the fullMentionText to only the matched portion for replacement
          const actualMentionText = fullMentionText.split(' ').slice(0, matchedWords.length).join(' ');
          console.log('🔄 Adjusting mention text from:', fullMentionText, 'to:', actualMentionText);

          const fullMention = `[${persistentMapping.name}](${persistentMapping.id})`;
          const originalMention = `@${actualMentionText}`;
          console.log('🔄 Converting partial match:', { originalMention, fullMention });
          processedContent = processedContent.replace(originalMention, fullMention);
          continue; // Skip to next mention
        }
      }

      if (persistentMapping) {
        console.log('🔄 Found in persistent mappings:', persistentMapping);
        const fullMention = `[${persistentMapping.name}](${persistentMapping.id})`;
        const originalMention = `@${fullMentionText}`;
        console.log('🔄 Converting:', { originalMention, fullMention });
        processedContent = processedContent.replace(originalMention, fullMention);
        continue; // Skip to next mention
      } else {
        console.log('🔄 NOT found in persistent mappings for key:', lookupKey);
      }

      // Try to find the best matching user in followers list
      let bestMatch = null;
      let bestMatchLength = 0;

      console.log('🔄 Available followers:', myFollowers?.map(f => ({
        id: f?.follower_client?.id,
        fname: f?.follower_client?.fname,
        last_name: f?.follower_client?.last_name,
        name: `${f?.follower_client?.fname || ""} ${f?.follower_client?.last_name || ""}`.trim(),
        rawData: f?.follower_client
      })));

      // Get all available users from multiple sources (API + local fallback)
      let allUsers = [];

      // First, check if we have API users from recent mention searches
      if (mentionOptions && mentionOptions.length > 0) {
        const apiUsers = mentionOptions.map(user => ({
          id: user.id,
          fname: user.rawData?.fname || user.name.split(' ')[0] || "",
          last_name: user.rawData?.last_name || user.name.split(' ').slice(1).join(' ') || "",
          image: user.rawData?.image,
          source: "api",
          originalData: {
            follower_client: user.rawData || {
              id: user.id,
              fname: user.name.split(' ')[0] || "",
              last_name: user.name.split(' ').slice(1).join(' ') || ""
            }
          }
        }));
        allUsers.push(...apiUsers);
      }

      // Add followers as fallback
      if (myFollowers && myFollowers.length > 0) {
        const followerUsers = myFollowers.map(f => ({
          id: f?.follower_client?.id,
          fname: f?.follower_client?.fname || "",
          last_name: f?.follower_client?.last_name || "",
          image: f?.follower_client?.image,
          source: "follower",
          originalData: f
        }));
        allUsers.push(...followerUsers);
      }

      // Add users from current post's comments
      if (basicPostData?.comments) {
        const commentUsers = basicPostData.comments.map(c => ({
          id: c.client_id,
          fname: c?.client_comment?.fname || "",
          last_name: c?.client_comment?.last_name || "",
          image: c?.client_comment?.image,
          source: "comment",
          originalData: { follower_client: c.client_comment }
        }));
        allUsers.push(...commentUsers);

        // Add users from replies
        basicPostData.comments.forEach(c => {
          if (c.replies) {
            const replyUsers = c.replies.map(r => ({
              id: r.client_id,
              fname: r?.client_comment?.fname || "",
              last_name: r?.client_comment?.last_name || "",
              image: r?.client_comment?.image,
              source: "reply",
              originalData: { follower_client: r.client_comment }
            }));
            allUsers.push(...replyUsers);
          }
        });
      }

      // Remove duplicates and check each user
      const uniqueUsers = allUsers.reduce((acc, user) => {
        const fullName = `${user.fname} ${user.last_name}`.trim();
        if (fullName && !acc.find(u => u.id === user.id)) {
          acc.push(user);
        }
        return acc;
      }, []);

      console.log('🔄 All users before dedup:', allUsers.map(u => ({
        id: u.id,
        fname: u.fname,
        last_name: u.last_name,
        name: `${u.fname} ${u.last_name}`.trim(),
        source: u.source
      })));

      console.log('🔄 Available users for processing:', uniqueUsers.map(u => ({
        id: u.id,
        name: `${u.fname} ${u.last_name}`.trim(),
        source: u.source
      })));

      uniqueUsers.forEach(user => {
        const fullName = `${user.fname} ${user.last_name}`.trim();
        console.log('🔄 Checking user:', fullName, 'vs mention:', fullMentionText);

        // Check if the mention starts with this user's name
        if (fullMentionText.toLowerCase().startsWith(fullName.toLowerCase()) && fullName.length > bestMatchLength) {
          console.log('🔄 Match found!', fullName);
          bestMatch = user.originalData;
          bestMatchLength = fullName.length;
        }
      });

      console.log('🔄 Best match found:', bestMatch ? bestMatch.follower_client : 'NOT FOUND');

      if (bestMatch) {
        const userName = `${bestMatch.follower_client.fname || ""} ${bestMatch.follower_client.last_name || ""}`.trim();
        const fullMention = `[${userName}](${bestMatch.follower_client.id})`;
        console.log('🔄 Converting to:', fullMention);

        // Replace only the user name part, keep the rest
        const originalMention = `@${fullMentionText}`;
        const extraText = fullMentionText.substring(userName.length).trim();
        const newMention = extraText ? `${fullMention} ${extraText}` : fullMention;
        processedContent = processedContent.replace(originalMention, newMention);
      }
    }

    console.log('🔄 processContentForServer - Final processed content:', processedContent);
    return processedContent;
  }, [myFollowers, basicPostData, mentionOptions]);

  const handleMentionKeyDown = (e, inputKey) => {
    if (mentionOpenFor !== inputKey || mentionOptions.length === 0) return false;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionActiveIndex((idx) => (idx + 1) % mentionOptions.length);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionActiveIndex((idx) => (idx - 1 + mentionOptions.length) % mentionOptions.length);
      return true;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const chosen = mentionOptions[mentionActiveIndex];
      if (chosen) insertMentionToken(chosen, inputKey);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      resetMentionState();
      return true;
    }
    return false;
  };


  // Sanitize HTML to allow only safe formatting tags
  const sanitizeHTML = useCallback((html) => {
    if (!html) return '';

    // Only allow specific formatting tags: b, i, u, strong, em, p, h1, a, br
    const allowedTags = ['b', 'i', 'u', 'strong', 'em', 'p', 'h1', 'a', 'br'];

    // Remove all HTML tags except the allowed ones
    let sanitized = html.replace(/<\/?([^>]+)>/g, (match, tagName) => {
      const tag = tagName.toLowerCase().split(' ')[0]; // Get tag name without attributes
      if (allowedTags.includes(tag)) {
        // For anchor tags, only allow href and target attributes
        if (tag === 'a') {
          const hrefMatch = match.match(/href\s*=\s*["']([^"']*)["']/i);
          const targetMatch = match.match(/target\s*=\s*["']([^"']*)["']/i);

          let cleanMatch = '<a';
          if (hrefMatch) {
            cleanMatch += ` href="${hrefMatch[1]}"`;
          }
          if (targetMatch) {
            cleanMatch += ` target="${targetMatch[1]}"`;
          }
          cleanMatch += '>';

          return cleanMatch;
        }
        return match; // Keep allowed tags
      }
      return ''; // Remove disallowed tags
    });

    // Clean up excessive line breaks and empty paragraphs
    sanitized = sanitized
      // Replace multiple consecutive empty paragraphs with <br> tags with single one
      .replace(/(<p><br><\/p>){2,}/gi, '<p><br></p>')
      // Replace multiple consecutive <br> tags with single <br>
      .replace(/(<br\s*\/?>){2,}/gi, '<br>')
      // Remove <br> tags at the beginning and end
      .replace(/^(<br\s*\/?>)+/gi, '')
      .replace(/(<br\s*\/?>)+$/gi, '')
      // Clean up multiple consecutive empty paragraphs
      .replace(/(<p><\/p>){2,}/gi, '<p></p>');

    return sanitized;
  }, []);

  // Render content with mentions and HTML formatting - optimized with useCallback
  const renderContentWithHtml = useCallback((text) => {
    if (!text) return null;

    // Clean up ALL @ symbols from mention formats
    let cleanedText = text
      // Remove @ from @[Name](id) format - supports numeric IDs, UUIDs, and usernames
      .replace(/@(\[.+?\]\([a-zA-Z0-9_-]+\))/g, '$1')
      // Remove @ from standalone @Name mentions (but keep the name)
      .replace(/@([^@\s]+(?:\s[^@\s]+)*)/g, '$1');

    // Sanitize HTML to only allow safe formatting tags
    cleanedText = sanitizeHTML(cleanedText);

    // Add proper styling to H1 elements
    cleanedText = cleanedText.replace(/<h1([^>]*)>/gi, '<h1$1 style="font-size: 1.5em; font-weight: bold; color: inherit; display: block; margin: 0.5em 0; line-height: 1.2;">');

    // Handle the clean [Name](id) or [Name](username) format
    // Updated to support both numeric IDs, alphanumeric usernames, and UUIDs with hyphens
    const fullFormatRegex = /\[(.+?)\]\(([a-zA-Z0-9_-]+)\)/g;

    const elements = [];
    let lastIndex = 0;
    let match;

    // Handle full format mentions [Name](id/username) and make them clickable
    while ((match = fullFormatRegex.exec(cleanedText)) !== null) {
      const start = match.index;
      const [full, name, id] = match;

      if (start > lastIndex) {
        elements.push(cleanedText.slice(lastIndex, start));
      }
      elements.push(
        <Link
          href={`/${id}`}
          className="text-black hover:text-gray-700 font-bold cursor-pointer bg-blue-50 hover:bg-blue-100 px-1 py-0.5 rounded transition-colors duration-200"
          key={`m-${start}`}
          onMouseEnter={(e) => {
            cancelHidePopup();
            showProfilePopup(id, e);
          }}
          onMouseLeave={() => hideProfilePopup(false)}
        >
          {name}
        </Link>
      );
      lastIndex = start + full.length;
    }

    if (lastIndex < cleanedText.length) {
      elements.push(cleanedText.slice(lastIndex));
    }

    // If we have elements (mentions), we need to handle HTML in each text part
    if (elements.length > 0) {
      return elements.map((element, index) => {
        if (typeof element === 'string') {
          // For text parts, render sanitized HTML using dangerouslySetInnerHTML
          return (
            <div
              key={index}
              className="post-content"
              style={{
                '--p-display': 'block',
                '--p-margin': '0.5em 0',
                '--h1-display': 'block',
                '--h1-margin': '0.5em 0',
                '--h1-font-size': '1.5em',
                '--h1-font-weight': 'bold',
                '--a-color': '#2563eb',
                '--a-text-decoration': 'underline',
                '--a-hover-color': '#1d4ed8'
              }}
              dangerouslySetInnerHTML={{ __html: element }}
            />
          );
        }
        return element;
      });
    }

    // If no mentions, render the cleaned text with sanitized HTML support
    return (
      <div
        className="post-content"
        style={{
          '--p-display': 'block',
          '--p-margin': '0.5em 0',
          '--h1-display': 'block',
          '--h1-margin': '0.5em 0',
          '--h1-font-size': '1.5em',
          '--h1-font-weight': 'bold',
          '--a-color': '#2563eb',
          '--a-text-decoration': 'underline',
          '--a-hover-color': '#1d4ed8'
        }}
        dangerouslySetInnerHTML={{ __html: cleanedText }}
      />
    );
  }, [sanitizeHTML]);

  // State for tracking expanded posts
  const [expandedPosts, setExpandedPosts] = useState(new Set());

  // Toggle post expansion
  const togglePostExpansion = useCallback((postId) => {
    setExpandedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  }, []);

  // Render content with mentions and HTML formatting - optimized with useCallback
  const renderContentWithMentions = useCallback((text) => {
    if (!text) return null;

    // Clean up ALL @ symbols from mention formats
    let cleanedText = text
      // Remove @ from @[Name](id) format - supports numeric IDs, UUIDs, and usernames
      .replace(/@(\[.+?\]\([a-zA-Z0-9_-]+\))/g, '$1')
      // Remove @ from standalone @Name mentions (but keep the name)
      .replace(/@([^@\s]+(?:\s[^@\s]+)*)/g, '$1');

    // Sanitize HTML to only allow safe formatting tags
    cleanedText = sanitizeHTML(cleanedText);

    // Handle the clean [Name](id) or [Name](username) format
    // Updated to support both numeric IDs, alphanumeric usernames, and UUIDs with hyphens
    const fullFormatRegex = /\[(.+?)\]\(([a-zA-Z0-9_-]+)\)/g;

    const elements = [];
    let lastIndex = 0;
    let match;

    // Handle full format mentions [Name](id/username) and make them clickable
    while ((match = fullFormatRegex.exec(cleanedText)) !== null) {
      const start = match.index;
      const [full, name, id] = match;

      if (start > lastIndex) {
        elements.push(cleanedText.slice(lastIndex, start));
      }
      elements.push(
        <Link
          href={`/${id}`}
          className="text-black hover:text-gray-700 font-bold cursor-pointer bg-blue-50 hover:bg-blue-100 px-1 py-0.5 rounded transition-colors duration-200"
          key={`m-${start}`}
          onMouseEnter={(e) => {
            cancelHidePopup();
            showProfilePopup(id, e);
          }}
          onMouseLeave={() => hideProfilePopup(false)}
        >
          {name}
        </Link>
      );
      lastIndex = start + full.length;
    }

    if (lastIndex < cleanedText.length) {
      elements.push(cleanedText.slice(lastIndex));
    }

    // If we have elements (mentions), we need to handle HTML in each text part
    if (elements.length > 0) {
      return elements.map((element, index) => {
        if (typeof element === 'string') {
          // For text parts, render sanitized HTML using dangerouslySetInnerHTML
          return (
            <span
              key={index}
              className="post-content"
              style={{
                '--p-display': 'block',
                '--p-margin': '0.5em 0',
                '--h1-display': 'block',
                '--h1-margin': '0.5em 0',
                '--h1-font-size': '1.5em',
                '--h1-font-weight': 'bold',
                '--a-color': '#2563eb',
                '--a-text-decoration': 'underline',
                '--a-hover-color': '#1d4ed8'
              }}
              dangerouslySetInnerHTML={{ __html: element }}
            />
          );
        }
        return element;
      });
    }

    // If no mentions, render the cleaned text with sanitized HTML support
    return (
      <span
        className="post-content"
        style={{
          '--p-display': 'block',
          '--p-margin': '0.5em 0',
          '--h1-display': 'block',
          '--h1-margin': '0.5em 0',
          '--h1-font-size': '1.5em',
          '--h1-font-weight': 'bold',
          '--a-color': '#2563eb',
          '--a-text-decoration': 'underline',
          '--a-hover-color': '#1d4ed8'
        }}
        dangerouslySetInnerHTML={{ __html: cleanedText }}
      />
    );
  }, [sanitizeHTML]);

  // Render content with truncation and "See more" functionality (with mention support)
  const renderContentWithTruncation = useCallback((text, postId, maxLength = 100) => {
    if (!text) return null;

    const isExpanded = expandedPosts.has(postId);

    // Get plain text length for truncation check (remove HTML tags and mentions)
    const plainText = text.replace(/<[^>]*>/g, '').replace(/\[.+?\]\(.+?\)/g, '');
    const shouldTruncate = plainText.length > maxLength && !isExpanded;

    // If we need to truncate, truncate the original text
    let displayText = text;
    if (shouldTruncate) {
      // Find a good truncation point (end of word)
      let truncateAt = maxLength;
      while (truncateAt > 0 && displayText[truncateAt] !== ' ' && displayText[truncateAt] !== '\n') {
        truncateAt--;
      }
      if (truncateAt === 0) truncateAt = maxLength;
      displayText = displayText.substring(0, truncateAt);
    }

    // Use renderContentWithMentions to properly display mentions
    const content = renderContentWithMentions(displayText);

    return (
      <>
        {content}

        {shouldTruncate && !isExpanded && (
          <>
            ...<span
              onClick={() => togglePostExpansion(postId)}
              className="inline font-semibold cursor-pointer text-sm hover:underline ml-1"
            >
              See more
            </span>
          </>
        )}

        {isExpanded && (
          <button
            onClick={() => togglePostExpansion(postId)}
            className="text-blue-600 hover:text-blue-800 font-medium text-sm mt-1 cursor-pointer"
          >
            See less
          </button>
        )}
      </>
    );
  }, [renderContentWithMentions, expandedPosts, togglePostExpansion]);

  const handleEditPost = (postId) => {
    dispatch(getPostById(postId)).then(() => {
      dispatch(setPostModalOpen(true));
      setOpenDropdownFor(null);
    });
  };

  const handleOnlyMe = (mode) => {
    const modeData = {
      id: mode.id,
      privacy_mode: mode.privacy_mode === "public" ? "private" : "public",
    };
    dispatch(updatePostPrivacy(modeData))
      .then(() => {
        dispatch(getPosts());
        setOpenDropdownFor(null);
      })
      .catch(() => {
        alert("Failed to update privacy");
        setOpenDropdownFor(null);
      });
  };

  const handleDeletePost = (postId) => {
    setDeleteConfirmPostId(postId);
    setOpenDropdownFor(null);
  };

  const confirmDeletePost = () => {
    if (!deleteConfirmPostId) return;
    dispatch(deletePost(deleteConfirmPostId))
      .then(() => {
        dispatch(getPosts());
        setDeleteConfirmPostId(null);
      })
      .catch(() => {
        alert("Failed to delete post");
        setDeleteConfirmPostId(null);
      });
  };

  const handleReportPost = (postId) => {
    alert('Report this post');
  };

  const handleViewAllComments = (id) => {
    dispatch(getPostById(id)).then((res) => {
      setShowCommentsModal(true);

      // Automatically load replies for all comments when modal opens
      if (res?.payload?.data?.comments) {
        res.payload.data.comments.forEach((comment, index) => {
          if (comment.replies_count > 0 || comment.replies?.length > 0) {
            handleViewAllReplies(comment.id, index);
          }
        });
      }
    });
  };

  const handleModalCommentLike = (comment) => {
    setShowCommentReactionsFor(comment.id);
  };

  const handleModalReplySubmit = (commentIndex) => {
    const inputKey = `${commentIndex}`;
    const reply = modalReplyInputs[inputKey];
    const hasImage = Array.isArray(modalReplyImages[inputKey]) && modalReplyImages[inputKey].length > 0;

    // Process mentions before validation
    const processedReply = processContentForServer(reply);

    // Check if there's processed content or images
    if (!processedReply?.trim() && !hasImage) return;

    // Get the comment object from basicPostData
    const comment = basicPostData?.comments?.[commentIndex];

    // Build payload; use FormData when image present
    let payload;
    if (hasImage) {
      const fd = new FormData();
      fd.append("comment_id", comment.id);
      fd.append("parent_id", "null");
      if (processedReply) fd.append("content", processedReply);
      (modalReplyImages[inputKey] || []).forEach((img, idx) => {
        if (img?.file) fd.append(`files[${idx}]`, img.file);
      });
      payload = fd;
    } else {
      payload = { comment_id: comment.id, parent_id: "null", content: processedReply };
    }

    // Call API to save reply
    dispatch(replyToComment(payload))
      .then(() => {
        dispatch(getPostById(basicPostData.id));

        // Hide the reply input box by removing it from state
        setModalReplyInputs((prev) => {
          const copy = { ...prev };
          delete copy[inputKey];
          return copy;
        });

        // Clear images
        setModalReplyImages((prev) => {
          const copy = { ...prev };
          const arr = copy[inputKey] || [];
          arr.forEach((img) => { if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl); });
          delete copy[inputKey];
          return copy;
        });

        handleViewAllReplies(comment?.id, commentIndex);
      })
      .catch((error) => {
        console.error("Failed to submit reply:", error);
      });
  };

  useEffect(() => {
    if (!showCommentsModal) {
      resetMentionState({ abortRequest: false });
      // Cleanup modal map when modal closes
      const modalMapId = `modal-${basicPostData?.id}`;
      if (basicPostData?.id && mapInstances.current[modalMapId]) {
        mapInstances.current[modalMapId].remove();
        delete mapInstances.current[modalMapId];
      }
    } else if (showCommentsModal && basicPostData?.id && basicPostData?.post_location && basicPostData?.post_location.length > 0) {
      // Initialize map when modal opens with delay to ensure DOM is ready
      setTimeout(() => {
        const modalMapId = `modal-${basicPostData.id}`;
        initMapForPost(modalMapId, basicPostData.post_location);
      }, 300);
    }
  }, [showCommentsModal, resetMentionState, basicPostData]);

  useEffect(() => {
    return () => {
      resetMentionState();
    };
  }, [resetMentionState]);

  const handleViewAllReplies = (commentId, index) => {
    setLoadingReplies((prev) => ({ ...prev, [commentId]: true }));

    dispatch(getCommentReplies(commentId))
      .then((response) => {
        console.log('response from component', response)
        if (response && response.payload?.data?.comment?.replies) {
          setModalReplies((prev) => ({
            ...prev,
            [index]: response.payload?.data?.comment?.replies || [],
          }));
        }
      })
      .finally(() => {
        setLoadingReplies((prev) => ({ ...prev, [commentId]: false }));
      });
  };

  // Render reply tree recursively under a comment
  const renderReplies = (replies, commentIndex, level = 1, parentFirstReplyId = null) => {
    if (!Array.isArray(replies) || replies.length === 0) return null;
    return replies.map((reply, ri) => (
      <div className="relative flex mt-2" style={{ marginLeft: `${level * 16}px` }} key={`${reply?.id || ri}-${level}`}>
        <div className="w-6 h-6 rounded-full overflow-hidden mr-2 mt-1">
          <img
            src={getClientImageUrl(reply?.client_comment?.image)}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = "/common-avator.jpg";
            }}
          />
        </div>
        {/* <div className="absolute border -left-13 top-[14px] w-10 h-px bg-gray-200"></div> */}

        <div className="flex flex-col w-full">
          <div className="bg-gray-50 w-full p-2 rounded-md flex flex-col">
            <span className="font-medium text-xs">
              <Link href={`/${reply?.username}`} className="cursor-pointer hover:underline">
                {`${reply?.client_comment?.fname || ""} ${reply?.client_comment?.last_name || ""}`.trim() || reply?.user}
              </Link>
              <span className="text-gray-400 ml-1">
                {reply?.created_at ? formatCompactTime(reply.created_at) : "0s"}
              </span>
            </span>
            <span className="text-gray-700 text-xs">
              {renderContentWithMentions(reply?.content)}
              {reply?.files?.length > 0 ? (
                <img
                  src={getImageUrl(reply?.files[0]?.file_path, 'reply')}
                  width={100}
                  height={100}
                  className="mt-2 cursor-pointer hover:opacity-90 transition-opacity rounded-lg"
                  onClick={() => handleImagePreview(
                    getImageUrl(reply?.files[0]?.file_path, 'reply'),
                    [getImageUrl(reply?.files[0]?.file_path, 'reply')],
                    0
                  )}
                />

              ) : ""}
            </span>
          </div>

          <div className="flex gap-3 mt-1 ml-2 text-xs text-gray-500">
            <div>{formatCompactTime(reply?.created_at)}</div>
            <button
              className="hover:underline relative cursor-pointer"
              onClick={() =>
                setShowCommentReactionsFor(showCommentReactionsFor === reply.id ? null : reply.id)
              }
              type="button"
            >
              {!reply?.single_reaction ? (
                <span>Like</span>
              ) : (
                <span className="inline-block">
                  {reply?.single_reaction?.type === "like" && (
                    <span className="font-semibold">
                      <span className="text-blue-500 text-[12px]">Like</span>
                    </span>
                  )}
                  {reply?.single_reaction?.type === "love" && (
                    <span className="font-semibold">
                      <span className="text-red-700 text-[12px]">Love</span>
                    </span>
                  )}
                  {reply?.single_reaction?.type === "care" && (
                    <span className="font-semibold">
                      <span className="text-yellow-700 text-[12px]">Care</span>
                    </span>
                  )}
                  {reply?.single_reaction?.type === "haha" && (
                    <span className="font-semibold">
                      <span className="text-yellow-700 text-[12px]">Haha</span>
                    </span>
                  )}
                  {reply?.single_reaction?.type === "wow" && (
                    <span className="font-semibold">
                      <span className="text-yellow-700 text-[12px]">Wow</span>
                    </span>
                  )}
                  {reply?.single_reaction?.type === "sad" && (
                    <span className="font-semibold">
                      <span className="text-yellow-700 text-[12px]">Sad</span>
                    </span>
                  )}
                  {reply?.single_reaction?.type === "angry" && (
                    <span className="font-semibold">
                      <span className="text-red-500 text-[12px]">Angry</span>
                    </span>
                  )}
                </span>
              )}
              {showCommentReactionsFor === reply.id && (
                <div ref={commentReactionRef} className="absolute bottom-full w-50 bg-white p-2 rounded-full shadow-lg flex space-x-2 z-10">
                  <img src="/like.png" alt="Like" className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer" onClick={(e) => { e.stopPropagation(); handleReplyReaction(reply.id, "like", reply.comment_id, commentIndex); }} />
                  <img src="/love.png" alt="Love" className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer" onClick={(e) => { e.stopPropagation(); handleReplyReaction(reply.id, "love", reply.comment_id, commentIndex); }} />
                  <img src="/care.png" alt="Care" className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer" onClick={(e) => { e.stopPropagation(); handleReplyReaction(reply.id, "care", reply.comment_id, commentIndex); }} />
                  <img src="/haha.png" alt="Haha" className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer" onClick={(e) => { e.stopPropagation(); handleReplyReaction(reply.id, "haha", reply.comment_id, commentIndex); }} />
                  <img src="/wow.png" alt="Wow" className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer" onClick={(e) => { e.stopPropagation(); handleReplyReaction(reply.id, "wow", reply.comment_id, commentIndex); }} />
                  <img src="/sad.png" alt="Sad" className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer" onClick={(e) => { e.stopPropagation(); handleReplyReaction(reply.id, "sad", reply.comment_id, commentIndex); }} />
                  <img src="/angry.png" alt="Angry" className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer" onClick={(e) => { e.stopPropagation(); handleReplyReaction(reply.id, "angry", reply.comment_id, commentIndex); }} />
                </div>
              )}
            </button>


            <button className="hover:underline cursor-pointer" onClick={() => handleReplyToReply(commentIndex, reply, parentFirstReplyId || reply?.id)} type="button">
              Reply
            </button>

          </div>

          {/* input for replying to this reply - Facebook Style */}
          {modalReplyInputs[`reply-${commentIndex}-${reply.id}`] !== undefined && (
            <div className="flex items-start mt-3 ml-6">
              {/* User Avatar */}
              <img
                src={getClientImageUrl(profile?.client?.image)}
                className="w-8 h-8 rounded-full object-cover mr-2 flex-shrink-0"
                alt="Your avatar"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/common-avator.jpg";
                }}
              />

              {/* Input Container */}
              <div className="flex-1 bg-gray-100 rounded-2xl border border-gray-200 hover:bg-gray-50 focus-within:bg-white focus-within:border-blue-500 transition-all duration-200 relative" data-mention-anchor="true">
                <div className="flex items-center px-3 py-2">
                  <input
                    type="text"
                    className="flex-1 bg-transparent focus:outline-none text-sm placeholder-gray-500"
                    placeholder={`Reply to ${reply?.client_comment?.fname || ""}...`}
                    value={modalReplyInputs[`reply-${commentIndex}-${reply.id}`] || ""}
                    ref={(el) => (inputRefs.current[`reply-${commentIndex}-${reply.id}`] = el)}
                    onChange={(e) => { setModalReplyInputs((prev) => ({ ...prev, [`reply-${commentIndex}-${reply.id}`]: e.target.value })); handleMentionDetect(e, `reply-${commentIndex}-${reply.id}`); }}
                    onKeyDown={(e) => { const handled = handleMentionKeyDown(e, `reply-${commentIndex}-${reply.id}`); if (!handled && e.key === 'Enter') { e.preventDefault(); handleReplyToReplySubmit(commentIndex, reply.id); } }}
                  />

                  {/* Facebook-style action buttons */}
                  <div className="flex items-center gap-1 ml-2 relative">
                    {/* Emoji button */}
                    <div className="relative">
                      <button
                        type="button"
                        className={`w-7 h-7 flex items-center justify-center hover:bg-gray-200 rounded-full transition-colors text-gray-500 hover:text-gray-700 ${showEmojiPicker === `reply-${commentIndex}-${reply.id}` ? 'bg-blue-200' : ''}`}
                        title="Choose an emoji"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleEmojiPicker(`reply-${commentIndex}-${reply.id}`);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 1C4.1 1 1 4.1 1 8s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zM5.5 6.5c.6 0 1-.4 1-1s-.4-1-1-1-1 .4-1 1 .4 1 1 1zm5 0c.6 0 1-.4 1-1s-.4-1-1-1-1 .4-1 1 .4 1 1 1zm1.5 4c-.4 1.2-1.5 2-2.8 2.1-.1 0-.1 0-.2 0-.1 0-.1 0-.2 0-1.3-.1-2.4-.9-2.8-2.1-.1-.3.1-.5.4-.5h4.8c.3 0 .5.2.4.5-.4z" />
                        </svg>
                      </button>

                      {/* Emoji Picker */}
                      {showEmojiPicker === `reply-${commentIndex}-${reply.id}` && (
                        <div
                          className="emoji-picker-container absolute bottom-full right-0 mb-2 bg-white border rounded-lg shadow-xl z-50 w-80 max-h-96 overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          {/* Category tabs */}
                          <div className="flex border-b bg-gray-50 p-2 gap-1">
                            {Object.keys(emojiCategories).map((category) => (
                              <button
                                key={category}
                                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${activeEmojiCategory === category
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-white text-gray-600 hover:bg-gray-100'
                                  }`}
                                onClick={() => setActiveEmojiCategory(category)}
                              >
                                {emojiCategories[category].name.split(' ')[0]}
                              </button>
                            ))}
                          </div>

                          {/* Emoji grid */}
                          <div className="p-3 max-h-64 overflow-y-auto">
                            <div className="grid grid-cols-8 gap-1">
                              {emojiCategories[activeEmojiCategory].emojis.map((emoji, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-lg"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleEmojiSelect(emoji, `reply-${commentIndex}-${reply.id}`);
                                  }}
                                  title={emoji}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>



                    {/* Camera/Photo button */}
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        ref={(el) => (fileInputRefs.current[`reply-${commentIndex}-${reply.id}`] = el)}
                        onChange={(e) => handleReplyImageChange(e, `reply-${commentIndex}-${reply.id}`)}
                      />
                      <button
                        type="button"
                        className="w-7 h-7 flex items-center justify-center hover:bg-gray-200 rounded-full transition-colors text-gray-500 hover:text-gray-700"
                        title="Attach a photo"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleReplyImageClick(`reply-${commentIndex}-${reply.id}`);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M14.5 2h-13C.7 2 0 2.7 0 3.5v9c0 .8.7 1.5 1.5 1.5h13c.8 0 1.5-.7 1.5-1.5v-9c0-.8-.7-1.5-1.5-1.5zM5 4.5c.8 0 1.5.7 1.5 1.5S5.8 7.5 5 7.5 3.5 6.8 3.5 6 4.2 4.5 5 4.5zM13 12H3l2.5-3 1.5 2 3-4 3 5z" />
                        </svg>
                      </button>
                    </>

                  </div>
                </div>

                {/* Selected image previews (reply to reply) under input */}
                {Array.isArray(modalReplyImages[`reply-${commentIndex}-${reply.id}`]) && modalReplyImages[`reply-${commentIndex}-${reply.id}`].length > 0 && (
                  <div className="px-3 pb-2">
                    <div className="flex flex-wrap gap-2">
                      {modalReplyImages[`reply-${commentIndex}-${reply.id}`].map((img, idx) => (
                        <div key={img.id || idx} className="inline-flex items-center gap-2 bg-white rounded-md border p-1">
                          <img
                            src={img.previewUrl}
                            className="w-12 h-12 object-cover rounded"
                            alt="preview"
                          />
                          <button
                            type="button"
                            className="text-xs text-red-600 hover:underline"
                            onClick={() => clearReplyImage(`reply-${commentIndex}-${reply.id}`, idx)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mention dropdown */}
                {renderMentionDropdown(`reply-${commentIndex}-${reply.id}`)}
              </div>

              {/* Send button - show when there's text or image */}
              {(modalReplyInputs[`reply-${commentIndex}-${reply.id}`]?.trim() || (Array.isArray(modalReplyImages[`reply-${commentIndex}-${reply.id}`]) && modalReplyImages[`reply-${commentIndex}-${reply.id}`].length > 0)) && (
                <button
                  className="ml-2 w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                  onClick={() => handleReplyToReplySubmit(commentIndex, reply.id)}
                  type="button"
                  title="Send"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* children (only show one more layer: reply of reply); API may name it `children` or `chidren` */}
          {level < 2 && renderReplies(
            reply?.children || [],
            commentIndex,
            level + 1,
            parentFirstReplyId || reply?.id
          )}
        </div>
      </div>
    ));
  };

  // Create a memoized moment formatter that returns 4h/4d/40m/10s format
  const formatCompactTime = useCallback((timestamp) => {
    if (!timestamp) return "";

    const duration = moment.duration(moment().diff(moment(timestamp)));
    const days = Math.floor(duration.asDays());
    const hours = Math.floor(duration.asHours()) % 24;
    const minutes = Math.floor(duration.asMinutes()) % 60;
    const seconds = Math.floor(duration.asSeconds()) % 60;

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }, []);

  const handleReplyToReply = (commentIndex, replyOrId, firstLevelReplyId = null) => {
    const replyId = typeof replyOrId === 'object' ? replyOrId?.id : replyOrId;
    const inputKey = `reply-${commentIndex}-${replyId}`;

    console.log('🔘 handleReplyToReply called:', { commentIndex, replyOrId, inputKey });

    // Pre-fill with @ mention token and focus
    let defaultValue = "";
    if (typeof replyOrId === 'object') {
      const name = `${replyOrId?.client_comment?.fname || ""} ${replyOrId?.client_comment?.last_name || ""}`.trim();
      const id = replyOrId?.client_id;
      console.log('🔘 Auto-tagging user:', { name, id });
      if (name && id) {
        defaultValue = `@${name} `;
      } else if (name) {
        defaultValue = `@${name} `;
      }
      console.log('🔘 Default value set to:', defaultValue);
    }
    // Keep only the targeted reply box open; close others
    setModalReplyInputs(prev => {
      const next = {};
      if (firstLevelReplyId) {
        next[`first-parent-${commentIndex}`] = firstLevelReplyId;
      } else if (prev[`first-parent-${commentIndex}`] !== undefined) {
        next[`first-parent-${commentIndex}`] = prev[`first-parent-${commentIndex}`];
      }
      const finalValue = prev[inputKey] === undefined ? defaultValue : prev[inputKey];
      console.log('🔘 Setting input value:', { inputKey, finalValue, wasUndefined: prev[inputKey] === undefined });
      next[inputKey] = finalValue;
      return next;
    });
    // Also retain images only for the active reply input
    setModalReplyImages(prev => (prev && prev[inputKey] ? { [inputKey]: prev[inputKey] } : {}));
    setTimeout(() => {
      const el = inputRefs.current[inputKey];
      if (el) {
        el.focus();
        const caret = (el.value || '').length;
        el.setSelectionRange(caret, caret);
      }
    }, 0);
  };

  const handleReplyToReplySubmit = (commentIndex, replyId) => {
    const inputKey = `reply-${commentIndex}-${replyId}`;
    const reply = modalReplyInputs[inputKey];
    const hasImage = Array.isArray(modalReplyImages[inputKey]) && modalReplyImages[inputKey].length > 0;

    // Process mentions before validation
    const processedReply = processContentForServer(reply);

    // Check if there's processed content or images
    if (!processedReply?.trim() && !hasImage) return;

    const comment = basicPostData?.comments?.[commentIndex];

    // Find the reply being replied to
    const findReplyInTree = (replies, targetId) => {
      for (const r of replies) {
        if (r.id === targetId) return r;
        if (r.children) {
          const found = findReplyInTree(r.children, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    const targetReply = findReplyInTree(comment.replies || [], replyId);

    // Determine parentId based on nesting rules:
    // 1. If replying to main comment (replyId === comment.id), parentId = null (first level)
    // 2. If replying to first-level reply, parentId = replyId (second level)
    // 3. If replying to second-level reply, parentId = that reply's parent_id (keep as second level)
    let parentId;
    if (replyId === comment.id) {
      // Replying to main comment
      parentId = null;
    } else if (targetReply) {
      if (targetReply.parent_id === null || targetReply.parent_id === undefined) {
        // Target is first-level reply, make this a second-level reply
        parentId = replyId;
      } else {
        // Target is second-level reply, keep this as second-level by using target's parent_id
        parentId = targetReply.parent_id;
      }
    } else {
      // Fallback to original logic
      const firstParent = modalReplyInputs[`first-parent-${commentIndex}`];
      parentId = firstParent || (replyId === comment.id ? null : replyId);
    }

    // Build payload; use FormData when image present
    let payload;
    if (hasImage) {
      const fd = new FormData();
      fd.append("comment_id", comment.id);
      if (parentId !== null && parentId !== undefined) fd.append("parent_id", parentId);
      if (processedReply) fd.append("content", processedReply);
      (modalReplyImages[inputKey] || []).forEach((img, idx) => {
        if (img?.file) fd.append(`files[${idx}]`, img.file);
      });
      payload = fd;
    } else {
      payload = { comment_id: comment.id, parent_id: parentId, content: processedReply };
    }
    dispatch(replyToComment(payload))
      .then(() => {
        dispatch(getPostById(basicPostData.id));

        // Hide the reply input box by removing it from state
        setModalReplyInputs(prev => {
          const copy = { ...prev };
          delete copy[inputKey];
          return copy;
        });

        // Clear images
        setModalReplyImages((prev) => {
          const copy = { ...prev };
          const arr = copy[inputKey] || [];
          arr.forEach((img) => { if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl); });
          delete copy[inputKey];
          return copy;
        });

        handleViewAllReplies(comment?.id, commentIndex);
      })
      .catch((error) => {
        console.error("Failed to submit reply to reply:", error);
      });
  };



  // Handle reply to single comment in post list
  const handleSingleCommentReply = (postId, comment) => {
    const inputKey = `single-reply-${postId}-${comment.id}`;
    console.log('🔘 handleSingleCommentReply called:', { postId, comment, inputKey });

    // Set default value with user mention
    const fullName = `${comment?.client?.fname || ''} ${comment?.client?.last_name || ''}`.trim();
    const defaultValue = fullName ? `@${fullName} ` : '';

    // Store the mention mapping persistently for processContentForServer
    if (fullName && comment?.client_id) {
      const normalizedName = fullName.toLowerCase().trim().replace(/\s+/g, ' ');
      mentionMappingsRef.current.set(normalizedName, {
        id: comment.client_id,
        name: fullName,
        rawData: comment.client
      });
      console.log('🔘 Stored mention mapping for reply button:', {
        originalName: fullName,
        normalizedKey: normalizedName,
        userId: comment.client_id,
        mappingStored: mentionMappingsRef.current.has(normalizedName)
      });
    }

    setModalReplyInputs(prev => {
      const next = { ...prev };
      next[inputKey] = prev[inputKey] !== undefined ? "" : defaultValue;
      return next;
    });

    // Focus the input after state update
    setTimeout(() => {
      const el = inputRefs.current[inputKey];
      if (el) {
        el.focus();
        const caret = el.value.length;
        el.setSelectionRange(caret, caret);
      }
    }, 0);
  };

  // Handle submit for single comment reply
  const handleSingleCommentReplySubmit = (postId, commentId) => {
    const inputKey = `single-reply-${postId}-${commentId}`;
    const reply = modalReplyInputs[inputKey];
    const hasImage = Array.isArray(modalReplyImages[inputKey]) && modalReplyImages[inputKey].length > 0;

    // Process mentions before validation
    const processedReply = processContentForServer(reply);

    // Check if there's processed content or images
    if (!processedReply?.trim() && !hasImage) return;

    // Build payload
    let payload;
    if (hasImage) {
      const fd = new FormData();
      fd.append("comment_id", commentId);
      fd.append("parent_id", "null");
      if (processedReply) fd.append("content", processedReply);
      (modalReplyImages[inputKey] || []).forEach((img, idx) => {
        if (img?.file) fd.append(`files[${idx}]`, img.file);
      });
      payload = fd;
    } else {
      payload = { comment_id: commentId, parent_id: "null", content: processedReply };
    }

    dispatch(replyToComment(payload))
      .then(() => {
        // Refresh posts to show new replies
        dispatch(getPosts());
        dispatch(getGathering());

        // Hide the reply input box by removing it from state
        setModalReplyInputs((prev) => {
          const copy = { ...prev };
          delete copy[inputKey];
          return copy;
        });

        // Clear images
        setModalReplyImages((prev) => {
          const copy = { ...prev };
          const arr = copy[inputKey] || [];
          arr.forEach((img) => { if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl); });
          delete copy[inputKey];
          return copy;
        });

        const ref = fileInputRefs.current[inputKey];
        if (ref) ref.value = "";
      })
      .catch((error) => {
        console.error("Failed to submit single comment reply:", error);
      });
  };

  const handleShare = (post_id) => {
    setPostToShare(post_id);
    setShareMessage(""); // Reset message
    setShowShareModal(true);
  };

  // Helper to keep the profile overview anchored next to its trigger
  const calculateProfilePopupPosition = useCallback((anchorEl) => {
    if (!anchorEl) return null;

    const rect = anchorEl.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    };
  }, []);

  // Profile popup handlers
  const showProfilePopup = async (userId, event) => {
    const anchorEl = event?.currentTarget || event?.target || null;
    profilePopupAnchorRef.current = anchorEl;

    const position = calculateProfilePopupPosition(anchorEl) || { x: 0, y: 0 };

    setProfilePopup({
      isVisible: true,
      userId,
      position,
      profileData: null
    });

    // Fetch profile data from API
    try {
      // Call the getUserProfile API
      const response = await dispatch(getUserProfile(userId));

      if (response.payload) {
        const userData = response.payload;

        // Format the data for display
        const profileData = {
          id: userData.client?.id || userId,
          name: userData.client?.display_name ||
            `${userData.client?.fname || ''} ${userData.client?.last_name || ''}`.trim() ||
            "Unknown User",
          image: getClientImageUrl(userData.client?.image),
          bio: userData.client?.profile_overview ||
            userData.client?.tagline ||
            userData.client?.bio ||
            "No bio available",
          location: userData.client?.location ||
            userData.client?.address ||
            userData.client?.city || null,
          joinedDate: userData.client?.created_at
            ? new Date(userData.client.created_at).getFullYear()
            : "Unknown",
          followersCount: userData.followers_count || 0,
          followingCount: userData.following_count || 0,
          postsCount: userData.post?.length || 0,
          isFollowing: userData.is_following || false,
          mutualFriends: userData.mutual_friends || 0,
          workPlace: userData.client?.work_place || null,
          education: userData.client?.education || null,
          relationshipStatus: userData.client?.marital_status_name || null
        };

        setProfilePopup(prev => ({
          ...prev,
          profileData
        }));
      } else {
        throw new Error("No user data received");
      }
    } catch (error) {
      console.error("Failed to fetch profile data:", error);

      // Fallback: try to find user in local data
      let fallbackData = null;

      // Check followers first
      const followerData = myFollowers?.find(follower => follower.id == userId);
      if (followerData) {
        fallbackData = {
          id: followerData.id,
          name: followerData.display_name || followerData.name || "Unknown User",
          image: getClientImageUrl(followerData.image),
          bio: followerData.bio || "No bio available",
          location: followerData.location || null,
          joinedDate: "Unknown",
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          isFollowing: false,
          mutualFriends: 0
        };
      }

      // If still no data, check comments/replies
      if (!fallbackData && basicPostData?.comments) {
        for (const comment of basicPostData.comments) {
          if (comment.client_id == userId) {
            fallbackData = {
              id: comment.client_id,
              name: `${comment.client_comment?.fname || ''} ${comment.client_comment?.last_name || ''}`.trim() || "Unknown User",
              image: getClientImageUrl(comment.client_comment?.image),
              bio: comment.client_comment?.bio || "No bio available",
              location: comment.client_comment?.location || null,
              joinedDate: new Date(comment.created_at).getFullYear(),
              followersCount: 0,
              followingCount: 0,
              postsCount: 0,
              isFollowing: false,
              mutualFriends: 0
            };
            break;
          }
        }
      }

      // Set fallback or error data
      setProfilePopup(prev => ({
        ...prev,
        profileData: fallbackData || {
          id: userId,
          name: "Unknown User",
          image: "/common-avator.jpg",
          bio: "Error loading profile",
          location: null,
          joinedDate: "Unknown",
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          isFollowing: false,
          mutualFriends: 0,
          error: true
        }
      }));
    }
  };

  const hideProfilePopup = (immediate = false) => {
    if (immediate) {
      // Clear any existing timeout
      if (hidePopupTimeoutRef.current) {
        clearTimeout(hidePopupTimeoutRef.current);
        hidePopupTimeoutRef.current = null;
      }
      profilePopupAnchorRef.current = null;
      setProfilePopup({
        isVisible: false,
        userId: null,
        position: { x: 0, y: 0 },
        profileData: null
      });
    } else {
      // Add delay before hiding
      hidePopupTimeoutRef.current = setTimeout(() => {
        profilePopupAnchorRef.current = null;
        setProfilePopup({
          isVisible: false,
          userId: null,
          position: { x: 0, y: 0 },
          profileData: null
        });
      }, 300); // 300ms delay
    }
  };

  const cancelHidePopup = () => {
    if (hidePopupTimeoutRef.current) {
      clearTimeout(hidePopupTimeoutRef.current);
      hidePopupTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (!profilePopup.isVisible) return;

    const anchorEl = profilePopupAnchorRef.current;
    if (!anchorEl) return;

    const updatePosition = () => {
      const nextPosition = calculateProfilePopupPosition(profilePopupAnchorRef.current);
      if (!nextPosition) return;

      setProfilePopup((prev) => {
        if (!prev.isVisible) return prev;
        if (Math.abs(prev.position.x - nextPosition.x) < 0.5 && Math.abs(prev.position.y - nextPosition.y) < 0.5) {
          return prev;
        }
        return {
          ...prev,
          position: nextPosition,
        };
      });
    };

    updatePosition();

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && anchorEl) {
      resizeObserver = new ResizeObserver(() => updatePosition());
      resizeObserver.observe(anchorEl);
    }

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [profilePopup.isVisible, profilePopup.userId, calculateProfilePopupPosition]);

  // Handle follow/unfollow actions
  const handleFollowToggle = async (userId, isCurrentlyFollowing) => {
    setFollowLoading(true);
    try {
      if (isCurrentlyFollowing) {
        await dispatch(unFollowTo({ user_id: userId }));
        toast.success("Unfollowed successfully!");
      } else {
        await dispatch(followTo({ user_id: userId }));
        toast.success("Followed successfully!");
      }

      // Update the popup data to reflect the change
      setProfilePopup(prev => ({
        ...prev,
        profileData: {
          ...prev.profileData,
          isFollowing: !isCurrentlyFollowing,
          followersCount: isCurrentlyFollowing
            ? prev.profileData.followersCount - 1
            : prev.profileData.followersCount + 1
        }
      }));

      // Refresh followers list
      dispatch(getAllFollowers());
    } catch (error) {
      console.error("Follow/Unfollow error:", error);
      toast.error("Failed to update follow status");
    } finally {
      setFollowLoading(false);
    }
  };

  // Handle message action
  const handleSendMessage = (userId, userName) => {
    // Hide popup immediately
    hideProfilePopup(true);
    setPostToShare(null);
    setShowShareModal(false); // explicit close

    const postUrl = `${window.location.origin}/post/${postToShare || basicPostData?.id || ""}`;
    const initialMessage = postToShare ? postUrl : `Hi ${userName}!`;

    // Construct a minimal user object for the chat
    const userToChatWith = {
      id: userId,
      fname: userName,
      image: profilePopup.profileData?.image || "/common-avator.jpg"
    };

    // Open chat with initial message
    openChat(null, userToChatWith, initialMessage);
  };

  // Handle profile stats click
  const handleStatsClick = (type, userId) => {
    // Hide popup immediately
    hideProfilePopup(true);

    // Navigate to appropriate page or open modal
    switch (type) {
      case 'posts':
        window.location.href = `/${userId}`;
        break;
      case 'followers':
        window.location.href = `/${userId}?tab=followers`;
        break;
      case 'following':
        window.location.href = `/${userId}?tab=following`;
        break;
      default:
        break;
    }
  }

  const confirmShare = () => {
    if (!postToShare || isSharingRef.current) return;

    isSharingRef.current = true;
    setIsSharing(true);

    const payload = {
      post_id: postToShare,
      message: shareMessage
    };

    dispatch(sharePost(payload))
      .then(() => {
        dispatch(getPosts());
        toast.success("Shared Successfully");
        setShowShareModal(false);
        setPostToShare(null);
        setShareMessage("");
      })
      .catch((error) => {
        console.error('Share failed:', error);
        setShowShareModal(false);
        setPostToShare(null);
      })
      .finally(() => {
        isSharingRef.current = false;
        setIsSharing(false);
      });
  };

  const cancelShare = () => {
    isSharingRef.current = false;
    setIsSharing(false);
    setShowShareModal(false);
    setPostToShare(null);
    setShowMessengerSelect(false);
    setSelectedShareUsers(new Set());
  };

  // Messenger Multi-Select Handlers
  const handleMessengerSelectToggle = () => {
    setShowShareModal(false);
    setShowMessengerSelect(true);
  };

  const handleMessengerSelectBack = () => {
    setShowMessengerSelect(false);
    setShowShareModal(true);
  };

  const handleUserSelect = (userId) => {
    setSelectedShareUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // Handle user search for sharing
  const handleShareSearch = async (query) => {
    setShareSearchQuery(query);
    if (!query.trim()) {
      setShareSearchResults([]);
      return;
    }

    try {
      const response = await api.get(`/client/search_by_people?search=${query}`);
      if (response.data && response.data.data && response.data.data.follow_connections) {
        setShareSearchResults(response.data.data.follow_connections);
      }
    } catch (error) {
      console.error('Error searching users for share:', error);
    }
  };

  const handleBatchShare = async () => {
    if (selectedShareUsers.size === 0) return;

    setBatchShareLoading(true);
    const users = Array.from(selectedShareUsers);
    let successCount = 0;
    let failCount = 0;

    const postUrl = `${window.location.origin}/post/${postToShare || basicPostData?.id || ""}`;
    console.log('🚀 Starting batch share to', users.length, 'users');

    for (const userId of users) {
      try {
        let userObj = myFollowers.find(f => (f.follower_client?.id || f.id) === userId);

        if (!userObj) {
          userObj = shareSearchResults.find(u => u.id === userId);
        }

        const targetId = userObj?.follower_client?.id || userObj?.id || userId;
        console.log(`📨 Processing share for userId: ${userId}, resolved targetId: ${targetId}`);

        const existingChat = allChat?.find(chat => {
          if (chat.type === 'personal') {
            return chat._userData?.id === targetId;
          }
          return false;
        });

        let chatId = existingChat?.id;

        if (!chatId) {
          console.log(`💬 Creating new chat for targetId: ${targetId}`);
          try {
            const newChat = await dispatch(startConversation({
              user_ids: String(targetId),
              type: 'personal' // Ensure type is sent if required by backend
            })).unwrap();
            chatId = newChat?.conversation?.id || newChat?.id;
          } catch (createError) {
            console.error(`❌ Failed to create chat with ${targetId}:`, createError);
          }
        }

        if (chatId) {
          console.log(`✅ Sending message to chatId: ${chatId}`);
          await dispatch(sendMessage({
            chatId,
            content: postUrl,
            type: 'text'
          })).unwrap();
          successCount++;
        } else {
          console.warn(`⚠️ Could not get chatId for user ${targetId}`);
          failCount++;
        }

      } catch (err) {
        console.error(`❌ Failed to send to user ${userId}`, err);
        failCount++;
      }
    }

    setBatchShareLoading(false);
    if (successCount > 0) {
      toast.success(`Sent to ${successCount} users`);
    }
    if (failCount > 0) {
      toast.error(`Failed to send to ${failCount} users`);
    }
    cancelShare();
  };

  const handleImagePreview = (imageSrc, allImages, index) => {
    setPreviewImage(imageSrc);
    setPreviewImages(allImages);
    setCurrentImageIndex(index);
    setShowImagePreview(true);
  };

  const closeImagePreview = () => {
    setShowImagePreview(false);
    setPreviewImage(null);
    setPreviewImages([]);
    setCurrentImageIndex(0);
  };

  const goToPreviousImage = () => {
    if (currentImageIndex > 0) {
      const newIndex = currentImageIndex - 1;
      setCurrentImageIndex(newIndex);
      setPreviewImage(previewImages[newIndex]);
    }
  };

  const goToNextImage = () => {
    if (currentImageIndex < previewImages.length - 1) {
      const newIndex = currentImageIndex + 1;
      setCurrentImageIndex(newIndex);
      setPreviewImage(previewImages[newIndex]);
    }
  };

  // Keyboard navigation for image preview
  useEffect(() => {
    if (!showImagePreview) return;

    const handleKeyDown = (event) => {
      switch (event.key) {
        case 'Escape':
          closeImagePreview();
          break;
        case 'ArrowLeft':
          goToPreviousImage();
          break;
        case 'ArrowRight':
          goToNextImage();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showImagePreview, currentImageIndex, previewImages.length]);

  // Memoized reactions image component
  const ReactImage = memo((props) => {
    const { reactLink, reactType, reaction, className, showText, textclass = "" } = props;
    return (
      <>
        {reaction?.type === reactType && (
          <>
            <Image
              src={reactLink}
              className={className}
              width={100}
              height={100}
              alt="old club man"
            />
            {showText && <div className={textclass}>{showText}</div>}
          </>
        )}
      </>
    )
  });
  ReactImage.displayName = 'PostReactImage';

  // show reactions counts and reactions
  const showingReactionsIcon = (item, index) => {
    return (
      <span key={index} role="img" aria-label="surprised" className="text-xl">
        <span className="inline-block">
          <ReactImage
            reactLink="/like.png"
            reactType="like"
            reaction={item}
            className="w-4 h-4 mb-[4px] inline-block"
          />
          <ReactImage
            reactLink="/love.png"
            reactType="love"
            reaction={item}
            className="w-4 h-4 mb-[4px] inline-block"
          />
          <ReactImage
            reactLink="/care.png"
            reactType="care"
            reaction={item}
            className="w-4 h-4 mb-[4px] inline-block"
          />
          <ReactImage
            reactLink="/haha.png"
            reactType="haha"
            reaction={item}
            className="w-4 h-4 mb-[4px] inline-block"
          />
          <ReactImage
            reactLink="/wow.png"
            reactType="wow"
            reaction={item}
            className="w-4 h-4 mb-[4px] inline-block"
          />
          <ReactImage
            reactLink="/sad.png"
            reactType="sad"
            reaction={item}
            className="w-4 h-4 mb-[4px] inline-block"
          />
          <ReactImage
            reactLink="/angry.png"
            reactType="angry"
            reaction={item}
            className="w-4 h-4 mb-[4px] inline-block"
          />
        </span>
      </span>
    )
  }


  // liking sections for post
  const likingReactions = (item) => {
    return (
      <span className="font-semibold flex gap-1">
        <ReactImage
          reactLink="/like.png"
          reactType="like"
          reaction={item}
          className="w-5 h-5 mb-[4px] inline-block"
          textclass="text-[14px]"
          showText="Like"
        />
        <ReactImage
          reactLink="/love.png"
          reactType="love"
          reaction={item}
          className="w-5 h-5 mb-[4px] inline-block"
          textclass="text-red-700 text-[14px]"
          showText="Love"
        />
        <ReactImage
          reactLink="/care.png"
          reactType="care"
          reaction={item}
          className="w-5 h-5 mb-[4px] inline-block"
          textclass="text-yellow-700 text-[14px]"
          showText="Care"
        />
        <ReactImage
          reactLink="/haha.png"
          reactType="haha"
          reaction={item}
          className="w-5 h-5 mb-[4px] inline-block"
          textclass="text-yellow-700 text-[14px]"
          showText="Haha"
        />
        <ReactImage
          reactLink="/wow.png"
          reactType="wow"
          reaction={item}
          className="w-5 h-5 mb-[4px] inline-block"
          textclass="text-yellow-700 text-[14px]"
          showText="Wow"
        />
        <ReactImage
          reactLink="/sad.png"
          reactType="sad"
          reaction={item}
          className="w-5 h-5 mb-[4px] inline-block"
          textclass="text-yellow-700 text-[14px]"
          showText="Sad"
        />
        <ReactImage
          reactLink="/angry.png"
          reactType="angry"
          reaction={item}
          className="w-5 h-5 mb-[4px] inline-block"
          textclass="text-red-500 text-[14px]"
          showText="Angry"
        />
      </span>
    )
  }

  const reactionsImages = (item) => {

    const CommonDesign = (props) => {
      const { onClick, reactLink, className } = props;
      return (
        <button
          className="transform w-6 cursor-pointer hover:scale-125 transition-transform"
          onClick={() => onClick()}
        >
          <ReactImage
            reactLink={reactLink}
            className={className}
          />
        </button>
      )
    }
    return (
      <div
        className="absolute bottom-full left-0 mb-0 bg-white p-1 rounded-full shadow-lg flex space-x-2 z-10"
      >
        <CommonDesign
          reactLink="/like.png"
          className=""
          onClick={() => handleReaction(item.id, "like")}
        />

        <CommonDesign
          reactLink="/love.png"
          className=""
          onClick={() => handleReaction(item.id, "love")}
        />

        <CommonDesign
          reactLink="/care.png"
          className=""
          onClick={() => handleReaction(item.id, "care")}
        />

        <CommonDesign
          reactLink="/haha.png"
          className=""
          onClick={() => handleReaction(item.id, "haha")}
        />
        <CommonDesign
          reactLink="/wow.png"
          className=""
          onClick={() => handleReaction(item.id, "wow")}
        />
        <CommonDesign
          reactLink="/sad.png"
          className=""
          onClick={() => handleReaction(item.id, "sad")}
        />
        <CommonDesign
          reactLink="/angry.png"
          className=""
          onClick={() => handleReaction(item.id, "angry")}
        />
      </div>
    )
  }



  // Memoize posts processing to avoid recalculation on every render
  const processedPosts = useMemo(() => {
    return postsData?.data?.map((item, index) => {
      const totalCount = item.multiple_reaction_counts.reduce(
        (sum, dd) => Number(sum) + Number(dd.count),
        0
      );

      const itemUrl = item?.background_url;
      const hasPath = /\/post_background\/.+/.test(itemUrl);

      return { ...item, totalCount, itemUrl, hasPath };
    }) || [];
  }, [postsData?.data]);

  return (
    <div className="">
      {/* CSS for post content styling */}
      <style jsx>{`
        .post-content h1 {
          font-size: 1.5em !important;
          font-weight: bold !important;
          margin: 0.5em 0 !important;
          display: block !important;
          color: inherit !important;
        }
        .post-content a {
          color: #2563eb !important;
          text-decoration: underline !important;
          cursor: pointer;
        }
        .post-content a:hover {
          color: #1d4ed8 !important;
        }
        .post-content a:visited {
          color: #7c3aed !important;
        }
      `}</style>

      {processedPosts?.map((item, index) => {

        return (
          <div
            className="bg-white rounded-lg shadow-sm p-4 mb-4"
            key={item.id || index}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex">
                <div className="w-10 h-10 border border-blue-600 rounded-full overflow-hidden mr-3">
                  <Image
                    // src={ item?.client?.image ?
                    //   process.env.NEXT_PUBLIC_FILE_PATH +
                    //   item?.client?.image : "/common-avator.jpg"
                    // }
                    src={getClientImageUrl(item?.client?.image)}
                    className="w-full h-full object-cover"

                    alt="oldclubman"
                    width={1280}
                    height={720}
                    unoptimized={true}
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link href={`/${item?.client?.username}`}>
                      <h4 className="font-medium cursor-pointer hover:underline">
                        {item?.client?.display_name || item?.client?.fname + " " + item?.client?.last_name}
                      </h4>
                    </Link>
                    {item?.shared_post && (
                      <>
                        <span className="text-gray-500 hidden sm:inline">•</span>
                        <p className="text-sm text-gray-500">
                          Shared from {" "}
                          <span className="font-semibold hover:underline cursor-pointer">
                            <Link href={`/${item?.shared_post?.client?.username}`}>
                              {item?.shared_post?.client?.fname + " " + item?.shared_post?.client?.last_name}
                            </Link>
                          </span>
                        </p>
                      </>
                    )}

                    <span className="text-gray-500 hidden sm:inline">•</span>

                    <p className="text-sm text-gray-500 whitespace-nowrap">
                      {formatCompactTime(item.created_at)}
                    </p>

                    {/* Check-in and location details */}
                    {(() => {
                      // Extract check-in and destination from post_location
                      const checkIn = item?.post_location?.find(loc => loc.post_type === 1);
                      const destination = item?.post_location?.find(loc => loc.post_type === 2);

                      if (checkIn && destination) {
                        return (
                          <>
                            <span className="text-gray-500 hidden sm:inline">•</span>
                            <span className="text-sm text-gray-500">
                              📍 From <span className="font-bold">{checkIn.place_name?.split(',')[0] || checkIn.place_name || 'Location'}</span>
                              <span className="hidden sm:inline"> Traveling to ✈️ </span>
                              <span className="sm:hidden">{" "}✈️ </span>
                              <span className="font-bold">{destination.place_name?.split(',')[0] || destination.place_name || 'Location'}</span>
                            </span>
                          </>
                        );
                      } else if (checkIn) {
                        return (
                          <>
                            <span className="text-gray-500 hidden sm:inline">•</span>
                            <span className="text-sm text-gray-500">
                              📍 Checking in <span className="font-bold">{checkIn.place_name?.split(',')[0] || checkIn.place_name || 'Check-in'}</span>
                            </span>
                          </>
                        );
                      } else if (destination) {
                        return (
                          <>
                            <span className="text-gray-500 hidden sm:inline">•</span>
                            <span className="text-sm text-gray-500">
                              📍 Traveling to ✈️ <span className="font-bold">{destination.place_name?.split(',')[0] || destination.place_name || 'Destination'}</span>
                            </span>
                          </>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <p className="text-gray-500 text-sm">
                    {item?.client?.fromcountry?.name ? item?.client?.fromcountry?.name : 'This Account Location Not Set Yet.'}{" "}
                    {item?.privacy_mode === "public" ? (
                      <FaGlobe className="inline ml-1" />
                    ) : (
                      <FaLock className="inline ml-1" />
                    )}
                  </p>
                </div>
              </div>
              <div className="relative">
                <button
                  className="text-gray-500 cursor-pointer"
                  onClick={() =>
                    setOpenDropdownFor(
                      openDropdownFor === item.id ? null : item.id
                    )
                  }
                >
                  <FaEllipsisH />
                </button>
                {openDropdownFor === item.id && (
                  <div
                    ref={dropdownRef}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-20"
                  >
                    {profile?.client?.id === item?.client?.id && !(item?.post_location?.length > 0) &&
                      item?.created_at && moment().diff(moment(item.created_at), 'minutes') < 15 &&
                      <button
                        onClick={() => handleEditPost(item.id)}
                        className="cursor-pointer flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <CiEdit className="mr-2" />
                        Edit post
                      </button>
                    }
                    {profile?.client?.id === item?.client?.id && <button
                      onClick={() => handleOnlyMe(item)}
                      className="cursor-pointer flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <CiUnlock className="mr-2" />
                      {item?.privacy_mode === "public" ? "Only Me" : "Public"}
                    </button>}
                    {profile?.client?.id === item?.client?.id && <button
                      onClick={() => handleDeletePost(item.id)}
                      className="cursor-pointer flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                    >
                      <MdOutlineDeleteOutline className="mr-2" />
                      Delete post
                    </button>}
                    <button
                      onClick={() => handleReportPost(item.id)}
                      className="cursor-pointer flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                    >
                      <TbMessageReport className="mr-2" />
                      Report Post
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="post-content">
              {item?.hasPath && !item?.shared_post ?
                <>
                  <div
                    className="relative text-white text-center p-4 w-full min-h-[300px] rounded-lg flex items-center justify-center bg-cover bg-center bg-no-repeat"
                    style={{
                      backgroundImage: `url(${item.itemUrl})`,
                    }}
                  >
                    <div
                      className=" dark:text-white py-2 px-6 font-bold  text-sm sm:text-base md:text-[30px]  leading-relaxed  w-full  break-words  overflow-hidden  whitespace-pre-wrap text-center">
                      {renderContentWithMentions(item?.message)}
                    </div>
                  </div>

                </>
                :
                <div className="py-2 text-[12px] sm:text-base md:text-lg leading-relaxed max-w-full sm:max-w-prose break-words">
                  {/* Post message with line clamping */}
                  <div
                    className={expandedPosts.has(item.id) ? '' : 'line-clamp-2'}
                    style={!expandedPosts.has(item.id) ? {
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    } : {}}
                  >
                    {renderContentWithMentions(item?.message)}
                  </div>
                  {/* See more / See less button */}
                  {item?.message && item.message.length > 150 && (
                    <button
                      className="text-gray-500 hover:text-gray-700 hover:underline text-sm mt-1 cursor-pointer"
                      onClick={() => togglePostExpansion(item.id)}
                    >
                      {expandedPosts.has(item.id) ? 'See less' : 'See more'}
                    </button>
                  )}
                </div>

              }

              {/* Shared Post Container */}
              {item?.shared_post && (
                <div className="mt-3 border border-gray-300 rounded-xl overflow-hidden mx-0 sm:mx-0">
                  <div className="p-3 pb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-100 flex-shrink-0">
                        <img
                          src={getClientImageUrl(item?.shared_post?.client?.image)}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.src = "/common-avator.jpg"; }}
                        />
                      </div>
                      <div className="flex flex-col">
                        <Link href={`/${item?.shared_post?.client?.username}`} className="font-semibold text-sm hover:underline text-gray-900">
                          {item?.shared_post?.client?.display_name || `${item?.shared_post?.client?.fname} ${item?.shared_post?.client?.last_name}`}
                        </Link>
                        <span className="text-xs text-gray-500">
                          {formatCompactTime(item.shared_post.created_at)}
                        </span>
                      </div>
                    </div>

                    {item?.shared_post?.background_url && /\/post_background\/.+/.test(item?.shared_post?.background_url) ? (
                      <div
                        className="relative text-white text-center p-4 w-full min-h-[200px] rounded-lg flex items-center justify-center bg-cover bg-center bg-no-repeat mb-2"
                        style={{
                          backgroundImage: `url(${item.shared_post.background_url})`,
                        }}
                      >
                        <div className="dark:text-white py-2 px-6 font-bold text-sm sm:text-base md:text-[20px] leading-relaxed w-full break-words overflow-hidden whitespace-pre-wrap text-center">
                          {renderContentWithMentions(item?.shared_post?.message)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap mb-2">
                        {renderContentWithMentions(item?.shared_post?.message)}
                      </div>
                    )}
                  </div>

                  {/* Shared Post Files (Simplified View) */}
                  {item?.files?.length > 0 && (
                    <div className="bg-gray-100">
                      {(() => {
                        const firstFile = item.files[0];
                        const filePath = firstFile.file_path || firstFile.path || firstFile.url || firstFile.file_url || '';
                        const isVideo = /\.(mp4|webm|ogg|mov|avi)$/i.test(filePath);
                        const src = getImageUrl(filePath, 'post');

                        const allImages = (item.files || [])
                          .filter(f => {
                            const fPath = f.file_path || f.path || f.url || f.file_url || '';
                            return !/\.(mp4|webm|ogg|mov|avi)$/i.test(fPath);
                          })
                          .map(f => {
                            const fPath = f.file_path || f.path || f.url || f.file_url || '';
                            return getImageUrl(fPath, 'post');
                          });

                        const imageIndex = allImages.indexOf(src);

                        return (
                          <div className="w-full h-full relative">
                            {isVideo ? (
                              <video src={src} className="w-full h-full object-cover" controls />
                            ) : (
                              <Image
                                src={src}
                                alt="oldclubman"
                                className={`w-full cursor-pointer hover:opacity-90 transition-opacity ${item.files?.length === 1 ? "h-auto" : "h-full object-cover"
                                  }`}
                                onClick={() => {
                                  // Navigate to post details page with image query param
                                  router.push(`/post/${item?.shared_post?.id}?image=${imageIndex}`);
                                }}
                                width={1920}
                                height={1080}
                                unoptimized={true}
                              />
                            )}
                            {item.files.length > 1 && (
                              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                                +{item.files.length - 1} more
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* map for shwoing mapping data */}
              {item?.post_location && item?.post_location.length > 0 && (
                <div className="mb-4">
                  <div
                    ref={setMapContainerRef(item.id, item.post_location)}
                    id={`map-container-${item.id}`}
                    className="w-full rounded-md border border-gray-200"
                    style={{ height: '384px', width: '100%', position: 'relative', zIndex: 0 }}
                  />
                  <div className="mt-2 text-xs text-gray-600">
                    {(() => {
                      const checkIn = item.post_location.find(loc => loc.post_type === 1);
                      const destination = item.post_location.find(loc => loc.post_type === 2);

                      if (checkIn && destination) {
                        return `Route: ${checkIn.place_name?.split(',')[0] || 'Location'} → ${destination.place_name?.split(',')[0] || 'Location'}`;
                      } else if (checkIn) {
                        return `Check-in: ${checkIn.place_name || 'Location'}`;
                      } else if (destination) {
                        return `Destination: ${destination.place_name || 'Location'}`;
                      }
                      return 'Location';
                    })()}
                  </div>
                </div>
              )}

              {/* Display Post Images */}
              {!item?.shared_post && item?.files && item?.files?.length > 0 && (
                <div
                  className={`mt-3 grid ${item?.files?.length === 1
                    ? "grid-cols-1"
                    : item?.files?.length === 2
                      ? "grid-cols-2"
                      : item.files?.length >= 3
                        ? "grid-cols-2"
                        : ""
                    } gap-2`}
                >
                  {item?.files?.map((file, fileIndex) => {
                    // Determine if file is a video by extension
                    const filePath = file.file_path || file.path || file.url || file.file_url || '';
                    const isVideo = /\.(mp4|webm|ogg|mov|avi)$/i.test(filePath);
                    // Build robust base + prefix
                    // Build robust base + prefix using helper
                    const src = getImageUrl(filePath, 'post');

                    // Prepare all images for preview
                    const allImages = (item.files || [])
                      .filter(f => {
                        const fPath = f.file_path || f.path || f.url || f.file_url || '';
                        return !/\.(mp4|webm|ogg|mov|avi)$/i.test(fPath);
                      })
                      .map(f => {
                        const fPath = f.file_path || f.path || f.url || f.file_url || '';
                        return getImageUrl(fPath, 'post');
                      });

                    const imageIndex = allImages.indexOf(src);

                    return (
                      <div
                        key={fileIndex}
                        className={`overflow-hidden rounded-lg ${item.files?.length === 1 ? "" : "h-48"
                          } bg-gray-100`}
                      >
                        {isVideo ? (
                          <video controls className="w-full h-full object-cover">
                            <source src={src} />
                            Your browser does not support the video tag.
                          </video>
                        ) : (
                          <Image
                            src={src}
                            alt="oldclubman"
                            className={`w-full cursor-pointer hover:opacity-90 transition-opacity ${item.files?.length === 1 ? "h-auto" : "h-full object-cover"
                              }`}
                            onClick={() => {
                              // Navigate to post details page with image query param
                              router.push(`/post/${item.id}?image=${imageIndex}`);
                            }}
                            width={1920}
                            height={1080}
                            unoptimized={true}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-gray-200 border-t border-b py-2 mt-2">
              <div className="flex items-center">
                <span className="mr-2">
                  {/* showing reactions and counts immidiate after post */}
                  {item?.multiple_reaction_counts?.length > 0 &&
                    item?.multiple_reaction_counts
                      ?.slice(0, 2)
                      .map((reaction, index) => (
                        showingReactionsIcon(reaction, index)
                      ))}
                </span>
                {/* <span className="text-sm">{item?.single_reaction?.client?.fname + " " + item?.single_reaction?.client?.last_name + " and " + totalCount }</span> */}
                <span className="text-sm">{Number(item.totalCount)}</span>
                <span className="flex items-center gap-2 ml-auto text-sm text-gray-500">
                  {item?.length} <FaRegComment className="" />
                </span>
              </div>
            </div>

            <div className="flex justify-between py-1 border-gray-200 border-b">
              <div className="flex-1 relative" data-mention-anchor="true">
                <div className="relative">
                  <button
                    className="w-full py-1 cursor-pointer text-center text-blue-500 bg-gray-100 rounded-md"
                    onMouseEnter={() =>
                      setShowReactionsFor(
                        showReactionsFor === item.id ? null : item.id
                      )
                    }
                    onMouseLeave={(e) => {
                      // Check if the mouse is moving to the reactions area
                      const relatedTarget = e.relatedTarget;
                      if (relatedTarget && relatedTarget.closest('.reactions-container')) {
                        return; // Don't hide if moving to reactions
                      }
                      setShowReactionsFor(null);
                    }}
                    onClick={() => {
                      if (item.single_reaction) {
                        handleDeleteReaction(item.id);
                      }
                    }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {!item.single_reaction ? (
                        <>
                          <SlLike /> <span>Like</span>
                        </>
                      ) : (
                        <span className="inline-block">
                          {/* post liking section */}
                          {likingReactions(item?.single_reaction)}
                        </span>
                      )}
                    </div>
                  </button>
                  {showReactionsFor === item.id && (
                    <div
                      className="reactions-container"
                      onMouseEnter={() => setShowReactionsFor(item.id)}
                      onMouseLeave={() => setShowReactionsFor(null)}
                    >
                      {reactionsImages(item)}
                    </div>
                  )}
                </div>
              </div>
              <button className="flex-1 py-1 cursor-pointer text-center text-gray-500 hover:bg-gray-100 rounded-md">
                <div
                  className="flex items-center justify-center gap-2"
                  onClick={() => {
                    handleViewAllComments(item.id);
                  }}
                >
                  <FaComment /> <span>Comment</span>
                </div>
              </button>
              <button className="flex-1 py-1 cursor-pointer text-center text-gray-500 hover:bg-gray-100 rounded-md">
                <div
                  className="flex items-center justify-center gap-2"
                  onClick={() => { handleShare(item?.id) }}
                >
                  <IoIosShareAlt size={25} /> <span>Share</span>
                </div>
              </button>
            </div>

            <div
              className="cursor-pointer"
              onClick={() => {
                handleViewAllComments(item.id);
              }}
            >
              View all comments
            </div>





            {/* Comments section */}
            {item?.latest_comment && (
              <div className="mt-2 pl-2">
                <div className="mb-2">
                  <div className="flex">
                    <div className="w-8 h-8 rounded-full overflow-hidden mr-2 mt-2">
                      <img
                        src={getClientImageUrl(item?.latest_comment?.client?.image)}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "/common-avator.jpg";
                        }}
                      />
                    </div>
                    <div className="p-2 rounded-lg flex-grow">
                      <div className="flex flex-col bg-gray-100 p-2 rounded-md">
                        <span className="font-medium">
                          <Link
                            href={`/${item?.latest_comment?.username}`}
                            className="cursor-pointer hover:underline"
                          >
                            {item?.latest_comment?.client?.display_name || item?.latest_comment?.client?.fname + " " + item?.latest_comment?.client?.last_name}{" "}
                          </Link>

                        </span>
                        <span className="text-gray-700 text-sm">
                          {renderContentWithMentions(item?.latest_comment?.content)}
                          {(() => {
                            // Debug: Log the comment data structure
                            if (item?.latest_comment?.files?.length > 0) {
                              console.log('🖼️ Comment files found:', item?.latest_comment?.files);
                              console.log('🖼️ First file:', item?.latest_comment?.files[0]);
                            }
                            return null;
                          })()}
                          {item?.latest_comment?.files?.length > 0 && (() => {
                            const file = item?.latest_comment?.files[0];
                            const filePath = file?.file_path;

                            // Try multiple possible paths for comment images using helper
                            const possiblePaths = [
                              getImageUrl(filePath, 'post'),
                              getImageUrl(filePath, 'reply'),
                              getImageUrl(filePath, 'comment')
                            ];

                            return (
                              <img
                                src={possiblePaths[0]} // Start with post path
                                width={100}
                                height={100}
                                className="mt-2 cursor-pointer hover:opacity-90 transition-opacity rounded-lg"
                                onClick={(e) => {
                                  // Use the actual working source for preview
                                  const workingSrc = e.target.src;
                                  console.log('🖼️ Opening preview with working src:', workingSrc);
                                  handleImagePreview(workingSrc, [workingSrc], 0);
                                }}
                                alt="Comment attachment"
                                onError={(e) => {
                                  console.log('🚨 Comment image failed to load:', e.target.src);
                                  const currentSrc = e.target.src;

                                  if (currentSrc.includes('/post/')) {
                                    console.log('🔄 Trying /reply/ path...');
                                    e.target.src = possiblePaths[1];
                                  } else if (currentSrc.includes('/reply/')) {
                                    console.log('🔄 Trying /comment/ path...');
                                    e.target.src = possiblePaths[2];
                                  } else {
                                    console.log('🔄 All paths failed, hiding image');
                                    e.target.style.display = 'none';
                                  }
                                }}
                              />
                            );
                          })()}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex gap-2">
                        <span className="text-xs text-gray-500 ml-2">
                          {formatCompactTime(
                            item?.latest_comment?.created_at
                          )}
                        </span>
                        <span>•</span>
                        <button
                          className="text-gray-500 hover:underline relative cursor-pointer"
                          onClick={() => setShowCommentReactionsFor(
                            showCommentReactionsFor === item?.latest_comment?.id ? null : item?.latest_comment?.id
                          )}
                          type="button"
                        >
                          {!item?.latest_comment?.single_reaction ? (
                            <>
                              <span>Like</span>
                            </>
                          ) : (
                            <span className="inline-block">
                              {item?.latest_comment?.single_reaction?.type === "like" && (
                                <span className="font-semibold">
                                  <span className="text-blue-500 text-[12px]">Like</span>
                                </span>
                              )}
                              {item?.latest_comment?.single_reaction?.type === "love" && (
                                <span className="font-semibold">
                                  <span className="text-red-700 text-[12px]">
                                    Love
                                  </span>
                                </span>
                              )}
                              {item?.latest_comment?.single_reaction?.type === "care" && (
                                <span className="font-semibold">
                                  <span className="text-yellow-700 text-[12px]">
                                    Care
                                  </span>
                                </span>
                              )}
                              {item?.latest_comment?.single_reaction?.type === "haha" && (
                                <span className="font-semibold">
                                  <span className="text-yellow-700 text-[12px]">
                                    Haha
                                  </span>
                                </span>
                              )}
                              {item?.latest_comment?.single_reaction?.type === "wow" && (
                                <span className="font-semibold">
                                  <span className="text-yellow-700 text-[12px]">
                                    Wow
                                  </span>
                                </span>
                              )}
                              {item?.latest_comment?.single_reaction?.type === "sad" && (
                                <span className="font-semibold">
                                  <span className="text-yellow-700 text-[12px]">
                                    Sad
                                  </span>
                                </span>
                              )}
                              {item?.latest_comment?.single_reaction?.type === "angry" && (
                                <span className="font-semibold">
                                  <span className="text-red-500 text-[12px]">
                                    Angry
                                  </span>
                                </span>
                              )}
                            </span>
                          )}
                          {showCommentReactionsFor === item?.latest_comment?.id && (
                            <div
                              ref={commentReactionRef}
                              className="absolute bottom-full w-50 bg-white p-2 rounded-full shadow-lg flex space-x-2 z-10"
                            >
                              <img
                                src="/like.png"
                                alt="Like"
                                className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCommentReaction(item?.latest_comment?.id, "like");
                                }}
                              />
                              <img
                                src="/love.png"
                                alt="Love"
                                className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCommentReaction(item?.latest_comment?.id, "love");
                                }}
                              />
                              <img
                                src="/care.png"
                                alt="Care"
                                className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCommentReaction(item?.latest_comment?.id, "care");
                                }}
                              />
                              <img
                                src="/haha.png"
                                alt="Haha"
                                className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCommentReaction(item?.latest_comment?.id, "haha");
                                }}
                              />
                              <img
                                src="/wow.png"
                                alt="Wow"
                                className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCommentReaction(item?.latest_comment?.id, "wow");
                                }}
                              />
                              <img
                                src="/sad.png"
                                alt="Sad"
                                className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCommentReaction(item?.latest_comment?.id, "sad");
                                }}
                              />
                              <img
                                src="/angry.png"
                                alt="Angry"
                                className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCommentReaction(item?.latest_comment?.id, "angry");
                                }}
                              />
                            </div>
                          )}
                        </button>
                        <span>•</span>
                        <button
                          className="hover:underline cursor-pointer font-semibold"
                          onClick={() => handleSingleCommentReply(item.id, item?.latest_comment)}
                          type="button"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Display replies for single comment */}
                {item?.latest_comment?.replies && item?.latest_comment?.replies.length > 0 && (
                  <div className="ml-10 mt-3 space-y-2">
                    {item.latest_comment.replies.map((reply, replyIndex) => (
                      <div key={reply.id || replyIndex} className="flex items-start">
                        {/* Reply Avatar */}
                        <div className="w-6 h-6 rounded-full overflow-hidden mr-2 mt-1">
                          <img
                            src={getClientImageUrl(reply?.client_comment?.image)}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = "/common-avator.jpg";
                            }}
                          />
                        </div>

                        {/* Reply Content */}
                        <div className="flex-1">
                          <div className="bg-gray-100 rounded-lg px-3 py-2">
                            <span className="font-medium text-sm">
                              <Link
                                href={`/${reply?.username}`}
                                className="cursor-pointer hover:underline"
                              >
                                {(reply?.client_comment?.fname || "") + " " + (reply?.client_comment?.last_name || "")}
                              </Link>
                            </span>
                            <div className="text-gray-700 text-sm mt-1">
                              {renderContentWithMentions(reply?.content)}
                              {reply?.files?.length > 0 && (
                                <img
                                  src={getImageUrl(reply?.files[0]?.file_path, 'reply')}
                                  width={100}
                                  height={100}
                                  className="mt-2 cursor-pointer hover:opacity-90 transition-opacity rounded-lg"
                                  onClick={() => handleImagePreview(
                                    getImageUrl(reply?.files[0]?.file_path, 'reply'),
                                    [getImageUrl(reply?.files[0]?.file_path, 'reply')],
                                    0
                                  )}
                                  alt="Reply attachment"
                                />
                              )}
                            </div>
                          </div>

                          {/* Reply Actions */}
                          <div className="flex items-center gap-3 mt-1 ml-2 text-[12px] text-gray-600">
                            <span>{formatCompactTime(reply?.created_at)}</span>
                            <button
                              className="hover:underline relative cursor-pointer"
                              onClick={() =>
                                setShowCommentReactionsFor(
                                  showCommentReactionsFor === reply.id ? null : reply.id
                                )
                              }
                              type="button"
                            >
                              {!reply?.single_reaction ? (
                                <span>Like</span>
                              ) : (
                                <span className="inline-block">
                                  {reply?.single_reaction?.type === "like" && (
                                    <span className="font-semibold">
                                      <span className="text-blue-500 text-[12px]">Like</span>
                                    </span>
                                  )}
                                  {reply?.single_reaction?.type === "love" && (
                                    <span className="font-semibold">
                                      <span className="text-red-700 text-[12px]">Love</span>
                                    </span>
                                  )}
                                  {reply?.single_reaction?.type === "care" && (
                                    <span className="font-semibold">
                                      <span className="text-yellow-700 text-[12px]">Care</span>
                                    </span>
                                  )}
                                  {reply?.single_reaction?.type === "haha" && (
                                    <span className="font-semibold">
                                      <span className="text-yellow-700 text-[12px]">Haha</span>
                                    </span>
                                  )}
                                  {reply?.single_reaction?.type === "wow" && (
                                    <span className="font-semibold">
                                      <span className="text-yellow-700 text-[12px]">Wow</span>
                                    </span>
                                  )}
                                  {reply?.single_reaction?.type === "sad" && (
                                    <span className="font-semibold">
                                      <span className="text-yellow-700 text-[12px]">Sad</span>
                                    </span>
                                  )}
                                  {reply?.single_reaction?.type === "angry" && (
                                    <span className="font-semibold">
                                      <span className="text-red-500 text-[12px]">Angry</span>
                                    </span>
                                  )}
                                </span>
                              )}
                              {showCommentReactionsFor === reply.id && (
                                <div
                                  ref={commentReactionRef}
                                  className="absolute bottom-full w-50 bg-white p-2 rounded-full shadow-lg flex space-x-2 z-10"
                                >
                                  <img
                                    src="/like.png"
                                    alt="Like"
                                    className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReplyReaction(reply.id, "like", reply.comment_id, item?.latest_comment?.id);
                                    }}
                                  />
                                  <img
                                    src="/love.png"
                                    alt="Love"
                                    className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReplyReaction(reply.id, "love", reply.comment_id, item?.latest_comment?.id);
                                    }}
                                  />
                                  <img
                                    src="/care.png"
                                    alt="Care"
                                    className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReplyReaction(reply.id, "care", reply.comment_id, item?.latest_comment?.id);
                                    }}
                                  />
                                  <img
                                    src="/haha.png"
                                    alt="Haha"
                                    className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReplyReaction(reply.id, "haha", reply.comment_id, item?.latest_comment?.id);
                                    }}
                                  />
                                  <img
                                    src="/wow.png"
                                    alt="Wow"
                                    className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReplyReaction(reply.id, "wow", reply.comment_id, item?.latest_comment?.id);
                                    }}
                                  />
                                  <img
                                    src="/sad.png"
                                    alt="Sad"
                                    className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReplyReaction(reply.id, "sad", reply.comment_id, item?.latest_comment?.id);
                                    }}
                                  />
                                  <img
                                    src="/angry.png"
                                    alt="Angry"
                                    className="w-5 h-5 bg-white transform hover:scale-125 transition-transform cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReplyReaction(reply.id, "angry", reply.comment_id, item?.latest_comment?.id);
                                    }}
                                  />
                                </div>
                              )}
                            </button>
                            <button
                              className="hover:underline cursor-pointer"
                              onClick={() => handleSingleCommentReply(item.id, item?.latest_comment)}
                              type="button"
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply input for single comment */}
                {modalReplyInputs[`single-reply-${item.id}-${item?.latest_comment?.id}`] !== undefined && (
                  <div className="flex items-start mt-3 ml-10">
                    {/* User Avatar */}
                    <img
                      src={getClientImageUrl(profile?.image)}
                      className="w-7 h-7 rounded-full object-cover mr-2 mt-1"
                      onError={(e) => {
                        e.currentTarget.src = "/common-avator.jpg";
                      }}
                    />
                    <div className="flex-1 relative" data-mention-anchor="true">
                      {/* Combined input container with image previews */}
                      <div className="w-full border rounded-full px-2 py-1 text-sm bg-gray-100 flex items-center gap-2 focus-within:ring-2 focus-within:ring-blue-400 relative">
                        {/* Photo thumbnails inside the input */}
                        {Array.isArray(modalReplyImages[`single-reply-${item.id}-${item?.latest_comment?.id}`]) && modalReplyImages[`single-reply-${item.id}-${item?.latest_comment?.id}`].length > 0 && (
                          <div className="flex items-center gap-1 max-w-32 overflow-x-auto">
                            {modalReplyImages[`single-reply-${item.id}-${item?.latest_comment?.id}`].map((img, idx) => (
                              <div key={img.id || idx} className="relative w-7 h-7 flex-shrink-0">
                                <img src={img.previewUrl} className="w-7 h-7 object-cover rounded" alt="preview" />
                                <button
                                  type="button"
                                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-[10px] leading-4 text-red-600 border"
                                  onClick={() => clearReplyImage(`single-reply-${item.id}-${item?.latest_comment?.id}`, idx)}
                                  title="Remove"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <input
                          type="text"
                          placeholder={`Reply to ${item?.latest_comment?.client?.fname || ""}...`}
                          className="flex-1 bg-transparent focus:outline-none text-sm px-2 py-1"
                          value={modalReplyInputs[`single-reply-${item.id}-${item?.latest_comment?.id}`] || ""}
                          ref={(el) => (inputRefs.current[`single-reply-${item.id}-${item?.latest_comment?.id}`] = el)}
                          onChange={(e) => {
                            setModalReplyInputs((prev) => ({
                              ...prev,
                              [`single-reply-${item.id}-${item?.latest_comment?.id}`]: e.target.value,
                            }));
                            handleMentionDetect(e, `single-reply-${item.id}-${item?.latest_comment?.id}`);
                          }}
                          onKeyDown={(e) => {
                            const handled = handleMentionKeyDown(e, `single-reply-${item.id}-${item?.latest_comment?.id}`);
                            if (!handled && e.key === 'Enter') {
                              e.preventDefault();
                              handleSingleCommentReplySubmit(item.id, item?.latest_comment?.id);
                            }
                          }}
                        />

                        {/* Action buttons inside input */}
                        <div className="flex items-center gap-1">
                          {/* Photo upload button */}
                          <button
                            type="button"
                            className="p-1 text-gray-500 hover:text-blue-500 transition-colors"
                            onClick={() => handleReplyImageClick(`single-reply-${item.id}-${item?.latest_comment?.id}`)}
                            title="Add photo"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                            </svg>
                          </button>

                          {/* Emoji picker button */}
                          <button
                            type="button"
                            className="p-1 text-gray-500 hover:text-yellow-500 transition-colors"
                            onClick={() => toggleEmojiPicker(`single-reply-${item.id}-${item?.latest_comment?.id}`)}
                            title="Add emoji"
                          >
                            <span className="text-base">😊</span>
                          </button>
                        </div>
                      </div>

                      {/* Hidden file input for photo upload */}
                      <input
                        type="file"
                        ref={(el) => (fileInputRefs.current[`single-reply-${item.id}-${item?.latest_comment?.id}`] = el)}
                        style={{ display: 'none' }}
                        accept="image/*"
                        multiple
                        onChange={(e) => handleReplyImageChange(e, `single-reply-${item.id}-${item?.latest_comment?.id}`)}
                      />

                      {/* Mention dropdown */}
                      {renderMentionDropdown(`single-reply-${item.id}-${item?.latest_comment?.id}`)}

                      {/* Emoji picker */}
                      {showEmojiPicker === `single-reply-${item.id}-${item?.latest_comment?.id}` && (
                        <div
                          className="emoji-picker-container absolute left-0 top-full mt-1 bg-white border rounded-lg shadow-xl z-[9999] w-80"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div className="p-3">
                            {/* Emoji categories */}
                            <div className="flex gap-1 mb-2 border-b pb-2">
                              {Object.entries(emojiCategories).map(([key, category]) => (
                                <button
                                  key={key}
                                  className={`px-2 py-1 text-xs rounded ${activeEmojiCategory === key
                                    ? 'bg-blue-100 text-blue-600'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                  onClick={() => setActiveEmojiCategory(key)}
                                >
                                  {category.name.split(' ')[0]}
                                </button>
                              ))}
                            </div>

                            {/* Emoji grid */}
                            <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                              {emojiCategories[activeEmojiCategory]?.emojis.map((emoji, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  className="p-1 hover:bg-gray-100 rounded text-lg"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleEmojiSelect(emoji, `single-reply-${item.id}-${item?.latest_comment?.id}`);
                                  }}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Submit button */}
                    {(modalReplyInputs[`single-reply-${item.id}-${item?.latest_comment?.id}`]?.trim() || (Array.isArray(modalReplyImages[`single-reply-${item.id}-${item?.latest_comment?.id}`]) && modalReplyImages[`single-reply-${item.id}-${item?.latest_comment?.id}`].length > 0)) && (
                      <button
                        className="ml-2 px-3 py-1 bg-blue-500 text-white text-sm rounded-full hover:bg-blue-600 transition-colors"
                        onClick={() => handleSingleCommentReplySubmit(item.id, item?.latest_comment?.id)}
                        type="button"
                      >
                        Send
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}



            {/* single comment in post list bottom  */}
            <div className="mt-2 pl-2">
              {/* Enhanced Add comment with emoji, photo, and mention systems */}
              <div className="flex mt-2">
                <div className="w-8 h-8 rounded-full overflow-hidden mr-2">
                  <img
                    src={getClientImageUrl(profile?.image)}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/common-avator.jpg";
                    }}
                  />
                </div>
                <div className="flex-grow relative overflow-visible" data-mention-anchor="true">
                  {/* Combined input container with image previews */}
                  <div className="w-full border rounded-full px-2 py-1 text-sm bg-gray-100 flex items-center gap-2 focus-within:ring-2 focus-within:ring-blue-400 relative overflow-visible">
                    {/* Photo thumbnails inside the input */}
                    {Array.isArray(modalReplyImages[`post-comment-${item.id}`]) && modalReplyImages[`post-comment-${item.id}`].length > 0 && (
                      <div className="flex items-center gap-1 max-w-32 overflow-x-auto">
                        {modalReplyImages[`post-comment-${item.id}`].map((img, idx) => (
                          <div key={img.id || idx} className="relative w-7 h-7 flex-shrink-0">
                            <img src={img.previewUrl} className="w-7 h-7 object-cover rounded" alt="preview" />
                            <button
                              type="button"
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-[10px] leading-4 text-red-600 border"
                              onClick={() => clearReplyImage(`post-comment-${item.id}`, idx)}
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <input
                      type="text"
                      placeholder="Add a comment..."
                      className="flex-1 bg-transparent focus:outline-none text-sm px-2 py-1"
                      value={commentInputs[item.id] || ""}
                      ref={(el) => (inputRefs.current[`post-comment-${item.id}`] = el)}
                      onChange={(e) => {
                        setCommentInputs((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }));
                        handleMentionDetect(e, `post-comment-${item.id}`);
                      }}
                      onKeyDown={(e) => {
                        const handled = handleMentionKeyDown(e, `post-comment-${item.id}`);
                        if (!handled && e.key === 'Enter') {
                          e.preventDefault();
                          handleCommentSubmit(item.id);
                        }
                      }}
                    />

                    {/* Action buttons inside input */}
                    <div className="flex items-center gap-1">
                      {/* Photo upload button */}
                      <button
                        type="button"
                        className="p-1 text-gray-500 hover:text-blue-500 transition-colors"
                        onClick={() => handleReplyImageClick(`post-comment-${item.id}`)}
                        title="Add photo"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                        </svg>
                      </button>

                      {/* Emoji picker button */}
                      <button
                        type="button"
                        className="p-1 text-gray-500 hover:text-yellow-500 transition-colors"
                        onClick={() => toggleEmojiPicker(`post-comment-${item.id}`)}
                        title="Add emoji"
                      >
                        <span className="text-base">😊</span>
                      </button>

                      {/* Send button */}
                      <button
                        className="p-1 text-gray-500 hover:text-blue-500 transition-colors"
                        onClick={() => handleCommentSubmit(item.id)}
                        type="button"
                        title="Send"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="22" y1="2" x2="11" y2="13"></line>
                          <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Hidden file input for photo upload */}
                  <input
                    type="file"
                    ref={(el) => (fileInputRefs.current[`post-comment-${item.id}`] = el)}
                    style={{ display: 'none' }}
                    accept="image/*"
                    multiple
                    onChange={(e) => handleReplyImageChange(e, `post-comment-${item.id}`)}
                  />

                  {/* Mention dropdown */}
                  {renderMentionDropdown(`post-comment-${item.id}`)}

                  {/* Emoji picker */}
                  {showEmojiPicker === `post-comment-${item.id}` && (
                    <div
                      className="emoji-picker-container absolute left-0 top-full mt-1 bg-white border rounded-lg shadow-xl z-[9999] w-80"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <div className="p-3">
                        {/* Emoji categories */}
                        <div className="flex gap-1 mb-2 border-b pb-2">
                          {Object.entries(emojiCategories).map(([key, category]) => (
                            <button
                              key={key}
                              className={`px-2 py-1 text-xs rounded ${activeEmojiCategory === key
                                ? 'bg-blue-100 text-blue-600'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                              onClick={() => setActiveEmojiCategory(key)}
                            >
                              {category.name.split(' ')[0]}
                            </button>
                          ))}
                        </div>

                        {/* Emoji grid */}
                        <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                          {emojiCategories[activeEmojiCategory]?.emojis.map((emoji, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className="p-1 hover:bg-gray-100 rounded text-lg"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('🖱️ Emoji button clicked:', emoji, 'for', `post-comment-${item.id}`);
                                handleEmojiSelect(emoji, `post-comment-${item.id}`);
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}



      {/* Comment Modal - Extracted Component */}
      <PostCommentsModal
        isOpen={showCommentsModal}
        onClose={() => setShowCommentsModal(false)}
        basicPostData={basicPostData}
        profile={profile}
        handleShare={handleShare}
        handleDeleteReaction={handleDeleteReaction}
        handleImagePreview={handleImagePreview}
        renderContentWithMentions={renderContentWithMentions}
        showingReactionsIcon={showingReactionsIcon}
        likingReactions={likingReactions}
        reactionsImages={reactionsImages}
        emojiCategories={emojiCategories}
        commentInputs={commentInputs}
        setCommentInputs={setCommentInputs}
        handleCommentSubmit={handleCommentSubmit}
        mentionOpenFor={mentionOpenFor}
        mentionOptions={mentionOptions}
        mentionActiveIndex={mentionActiveIndex}
        mentionLoading={mentionLoading}
        mentionHasMore={mentionHasMore}
        handleMentionDetect={handleMentionDetect}
        handleMentionKeyDown={handleMentionKeyDown}
        insertMentionToken={insertMentionToken}
        renderMentionDropdown={renderMentionDropdown}
        inputRefs={inputRefs}
        fileInputRefs={fileInputRefs}
        modalReplyImages={modalReplyImages}
        setModalReplyImages={setModalReplyImages}
        handleReplyImageClick={handleReplyImageClick}
        handleReplyImageChange={handleReplyImageChange}
        clearReplyImage={clearReplyImage}
      />

      {/* Image Preview Modal */}
      {showImagePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="relative max-w-screen-lg max-h-screen-lg w-full h-full flex items-center justify-center p-4">
            <button
              onClick={closeImagePreview}
              className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 z-10"
            >
              ×
            </button>
            {previewImages.length > 1 && currentImageIndex > 0 && (
              <button
                onClick={goToPreviousImage}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-4xl hover:text-gray-300 z-10"
              >
                ‹
              </button>
            )}
            {previewImages.length > 1 && currentImageIndex < previewImages.length - 1 && (
              <button
                onClick={goToNextImage}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white text-4xl hover:text-gray-300 z-10"
              >
                ›
              </button>
            )}
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-full object-contain"
            />
            {previewImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-3 py-1 rounded">
                {currentImageIndex + 1} / {previewImages.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Confirmation Modal */}
      {/* Share Confirmation Modal */}
      {/* Share Confirmation Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl w-full max-w-[500px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="relative border-b border-gray-200 px-4 py-4 flex items-center justify-center shrink-0">
              <h3 className="text-xl font-bold text-gray-900">Share</h3>
              <button
                onClick={cancelShare}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors"
              >
                <FaTimes className="text-gray-600 text-lg" />
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar">
              <div className="p-4">
                {/* Profile Section */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-100 shrink-0">
                    <img
                      src={getClientImageUrl(profile?.client?.image)}
                      alt={profile?.client?.display_name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.src = "/common-avator.jpg"; }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-900 text-[17px]">
                      {profile?.client?.display_name || profile?.client?.fname}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded font-semibold">Feed</span>
                      <div className="flex items-center gap-1 bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded font-semibold">
                        <FaGlobeAmericas className="text-[10px]" />
                        <span>Public</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Input Area */}
                <div className="mb-4">
                  <textarea
                    placeholder="Say something about this..."
                    className="w-full text-lg placeholder-gray-500 border-none focus:ring-0 focus:outline-none resize-none min-h-[80px] p-0"
                    value={shareMessage}
                    onChange={(e) => setShareMessage(e.target.value)}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <button className="text-gray-400 hover:text-gray-600">
                      {/* <FaRegSmile className="text-2xl" /> */}
                    </button>
                    <button
                      onClick={confirmShare}
                      disabled={isSharing}
                      className={`px-8 py-2 rounded-lg font-semibold text-white text-[15px] transition-colors ${isSharing ? 'bg-blue-400 cursor-not-allowed' : 'bg-[#0866FF] hover:bg-blue-700'
                        }`}
                    >
                      {isSharing ? 'Sharing...' : 'Share now'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200"></div>

              {/* Send in Messenger */}
              <div className="p-4">
                <h4 className="font-semibold text-gray-900 mb-4 text-[17px]">Send in Messenger</h4>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {myFollowers && myFollowers.length > 0 ? (
                    myFollowers.map((follower, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col items-center gap-1 min-w-[70px] cursor-pointer group"
                        onClick={() => handleSendMessage(follower.follower_client?.id || follower.id, follower.follower_client?.fname || follower.name || "User")}
                      >
                        <div className="w-14 h-14 rounded-full overflow-hidden border border-gray-100 group-hover:opacity-90 transition-opacity">
                          <img
                            src={getClientImageUrl(follower?.follower_client?.image || follower?.image)}
                            alt={follower?.follower_client?.fname || follower.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.src = "/common-avator.jpg"; }}
                          />
                        </div>
                        <span className="text-xs text-center text-gray-500 leading-tight line-clamp-2 w-full">
                          {follower?.follower_client?.fname || follower.name || "User"}
                        </span>
                      </div>
                    ))
                  ) : (
                    // Fallback/Placeholder if no followers
                    [1, 2, 3, 4, 5].map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-1 min-w-[70px] cursor-pointer">
                        <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-400 text-xs">User</span>
                        </div>
                        <span className="text-xs text-center text-gray-500">Friend {i + 1}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Share to */}
              <div className="p-4 pt-0">
                <h4 className="font-semibold text-gray-900 mb-4 text-[17px]">Share to</h4>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">

                  {/* Messenger Multi-Select Button */}
                  <button
                    onClick={handleMessengerSelectToggle}
                    className="flex flex-col items-center gap-2 min-w-[80px] cursor-pointer group"
                  >
                    <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center group-hover:bg-blue-600 transition-colors shadow-sm">
                      <BsMessenger className="text-2xl text-white" />
                    </div>
                    <span className="text-xs text-gray-600 font-medium">Messenger</span>
                  </button>

                  {/* WhatsApp */}
                  <button
                    onClick={() => {
                      const postUrl = `${window.location.origin}/post/${postToShare}`;
                      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(postUrl)}`;
                      window.open(whatsappUrl, '_blank');
                    }}
                    className="flex flex-col items-center gap-2 min-w-[80px] cursor-pointer group"
                  >
                    <div className="w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center group-hover:bg-[#20bd5a] transition-colors">
                      <IoLogoWhatsapp className="text-2xl text-white" />
                    </div>
                    <span className="text-xs text-gray-600 font-medium">WhatsApp</span>
                  </button>

                  {/* Facebook */}
                  <button
                    onClick={() => {
                      const postUrl = `${window.location.origin}/post/${postToShare}`;
                      const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
                      window.open(facebookShareUrl, '_blank', 'width=600,height=400');
                    }}
                    className="flex flex-col items-center gap-2 min-w-[80px] cursor-pointer group"
                  >
                    <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center group-hover:bg-blue-700 transition-colors">
                      <FaFacebookF className="text-2xl text-white" />
                    </div>
                    <span className="text-xs text-gray-600 font-medium">Facebook</span>
                  </button>

                  {/* X (formerly Twitter) */}
                  <button
                    onClick={() => {
                      const postUrl = `${window.location.origin}/post/${postToShare}`;
                      const twitterShareUrl = `https://x.com/intent/tweet?url=${encodeURIComponent(postUrl)}`;
                      window.open(twitterShareUrl, '_blank', 'width=600,height=400');
                    }}
                    className="flex flex-col items-center gap-2 min-w-[80px] cursor-pointer group"
                  >
                    <div className="w-14 h-14 rounded-full bg-black flex items-center justify-center group-hover:bg-gray-800 transition-colors">
                      <FaXTwitter className="text-2xl text-white" />
                    </div>
                    <span className="text-xs text-gray-600 font-medium">X</span>
                  </button>

                  {/* LinkedIn */}
                  <button
                    onClick={() => {
                      const postUrl = `${window.location.origin}/post/${postToShare}`;
                      const linkedinShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`;
                      window.open(linkedinShareUrl, '_blank', 'width=600,height=400');
                    }}
                    className="flex flex-col items-center gap-2 min-w-[80px] cursor-pointer group"
                  >
                    <div className="w-14 h-14 rounded-full bg-[#0077b5] flex items-center justify-center group-hover:bg-[#006097] transition-colors">
                      <FaLinkedin className="text-2xl text-white" />
                    </div>
                    <span className="text-xs text-gray-600 font-medium">LinkedIn</span>
                  </button>

                  {/* Copy Link */}
                  <button
                    onClick={async () => {
                      const postUrl = `${window.location.origin}/post/${postToShare}`;
                      try {
                        await navigator.clipboard.writeText(postUrl);
                        toast.success('Link copied!');
                      } catch (err) {
                        // Fallback
                        const textArea = document.createElement('textarea');
                        textArea.value = postUrl;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        toast.success('Link copied!');
                      }
                    }}
                    className="flex flex-col items-center gap-2 min-w-[80px] cursor-pointer group"
                  >
                    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                      <FaLink className="text-2xl text-gray-600" />
                    </div>
                    <span className="text-xs text-gray-600 font-medium">Copy link</span>
                  </button>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messenger Multi-Select Modal */}
      {showMessengerSelect && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl w-full max-w-[500px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="relative border-b border-gray-200 px-4 py-4 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-gray-900">Send in Messenger</h3>
              <button onClick={cancelShare} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <FaTimes className="text-gray-500 text-xl" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto">

              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder="Search people..."
                  value={shareSearchQuery}
                  onChange={(e) => handleShareSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaSearch className="h-3.5 w-3.5 text-gray-400" />
                </div>
              </div>

              <div className="flex justify-between items-center mb-2 px-1">
                <h5 className="text-sm font-medium text-gray-700">
                  {shareSearchQuery.trim() ? "Search Results" : "Select Friends"}
                </h5>
                <span className="text-xs text-gray-500">{selectedShareUsers.size} selected</span>
              </div>

              <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-2">
                {(() => {
                  const usersToDisplay = shareSearchQuery.trim() ? shareSearchResults : myFollowers;
                  const hasUsers = usersToDisplay && usersToDisplay.length > 0;

                  if (!hasUsers) {
                    return <p className="text-center text-sm text-gray-500 p-4">{shareSearchQuery.trim() ? "No users found." : "No followers found."}</p>;
                  }

                  return usersToDisplay.map((user, idx) => {
                    // Normalize user object: 
                    // Followers have `follower_client`, search results are direct user objects
                    const userData = user.follower_client || user;
                    const userId = userData.id; // User ID is always at root of user object for search, or in follower_client

                    // Fallback for ID if strict structure fails (shouldn't happen based on API)
                    const finalId = userId || user.id;

                    const isSelected = selectedShareUsers.has(finalId);

                    return (
                      <div
                        key={`${finalId}-${idx}`}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        onClick={() => handleUserSelect(finalId)}
                      >
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-100 bg-gray-100">
                            <img
                              src={getClientImageUrl(userData.image)}
                              alt={userData.fname || userData.name || "User"}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.src = "/common-avator.jpg"; }}
                            />
                          </div>
                          <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600' : 'bg-gray-200'}`}>
                            {isSelected && <FaLink className="text-[10px] text-white" />}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {userData.fname ? `${userData.fname} ${userData.last_name || ''}` : userData.name || "User"}
                          </div>
                          {userData.username && <div className="text-xs text-gray-500 truncate">@{userData.username}</div>}
                        </div>

                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => { }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleMessengerSelectBack}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleBatchShare}
                disabled={selectedShareUsers.size === 0 || batchShareLoading}
                className={`flex-1 py-2.5 text-sm font-medium text-white rounded-lg flex items-center justify-center gap-2 transition-colors ${selectedShareUsers.size > 0 && !batchShareLoading ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300 cursor-not-allowed'}`}
              >
                {batchShareLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <BsMessenger /> Send to {selectedShareUsers.size > 0 ? selectedShareUsers.size : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Popup Card */}
      {
        profilePopup.isVisible && (
          <div
            className="fixed z-[10000] bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-80 max-w-sm"
            style={{
              left: `${profilePopup.position.x - 160}px`,
              top: `${profilePopup.position.y - 20}px`,
              transform: 'translateY(-100%)'
            }}
            onMouseEnter={cancelHidePopup}
            onMouseLeave={() => hideProfilePopup(false)}
          >
            {profilePopup.profileData ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-gray-200">
                    <img
                      src={profilePopup.profileData.image}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.src = "/common-avator.jpg"; }}
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{profilePopup.profileData.name}</h4>
                    {profilePopup.profileData.location && (
                      <p className="text-xs text-gray-500">{profilePopup.profileData.location}</p>
                    )}
                  </div>
                </div>
                {profilePopup.profileData.bio && (
                  <p className="text-sm text-gray-600 line-clamp-2">{profilePopup.profileData.bio}</p>
                )}
                <div className="flex justify-around py-2 border-t border-b border-gray-100">
                  <div className="text-center cursor-pointer" onClick={() => handleStatsClick('posts', profilePopup.userId)}>
                    <div className="font-semibold text-gray-900">{profilePopup.profileData.postsCount}</div>
                    <div className="text-xs text-gray-500">Posts</div>
                  </div>
                  <div className="text-center cursor-pointer" onClick={() => handleStatsClick('followers', profilePopup.userId)}>
                    <div className="font-semibold text-gray-900">{profilePopup.profileData.followersCount}</div>
                    <div className="text-xs text-gray-500">Followers</div>
                  </div>
                  <div className="text-center cursor-pointer" onClick={() => handleStatsClick('following', profilePopup.userId)}>
                    <div className="font-semibold text-gray-900">{profilePopup.profileData.followingCount}</div>
                    <div className="text-xs text-gray-500">Following</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {profile?.client?.id !== profilePopup.userId && (
                    <>
                      <button
                        onClick={() => handleFollowToggle(profilePopup.userId, profilePopup.profileData.isFollowing)}
                        disabled={followLoading}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${profilePopup.profileData.isFollowing
                          ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                          } ${followLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {followLoading ? '...' : profilePopup.profileData.isFollowing ? 'Following' : 'Follow'}
                      </button>
                      <button
                        onClick={() => handleSendMessage(profilePopup.userId, profilePopup.profileData.name)}
                        className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-300"
                      >
                        Message
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
            <div className="absolute bottom-0 left-1/2 transform translate-y-full -translate-x-1/2">
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white"></div>
            </div>
          </div>
        )
      }

      {/* Delete Confirmation Modal */}
      {deleteConfirmPostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteConfirmPostId(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Post</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete this post? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmPostId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                No
              </button>
              <button
                onClick={confirmDeletePost}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div >
  );
};

// Add display name for debugging
PostList.displayName = 'PostList';

// Memoize the entire component to prevent unnecessary re-renders
export default memo(PostList);
