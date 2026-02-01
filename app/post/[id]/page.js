"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import Cookies from 'js-cookie';
import Link from 'next/link';
import moment from 'moment';
import Image from "next/image";
import toast from "react-hot-toast";
import { FaGlobeAmericas, FaLock, FaRegComment, FaChevronLeft, FaChevronRight, FaTimes, FaEllipsisH, FaCamera } from 'react-icons/fa';
import { SlLike } from 'react-icons/sl';
import { IoMdShareAlt, IoIosShareAlt, IoLogoWhatsapp } from 'react-icons/io';
import { FaFacebookMessenger, FaLink, FaUserFriends, FaUsers, FaBookOpen } from "react-icons/fa";
import { BsMessenger } from "react-icons/bs";
import api from '@/helpers/axios';
import { getImageUrl } from '@/utility';
import { getAllFollowers, getMyProfile } from "@/views/settings/store";
import {
    storePostReactions,
    deletePostReaction,
    storeComments,
    getPostById,
    likeComment,
    replyToComment,
    likeReply,
    getCommentReplies,
    sharePost
} from '@/views/gathering/store';
import LoginPrompt from '@/components/auth/LoginPrompt';
import ShareModal from '@/components/common/ShareModal';

const PostDetailsPage = () => {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const dispatch = useDispatch();
    const { profile, myFollowers } = useSelector(({ settings }) => settings);

    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeMediaIndex, setActiveMediaIndex] = useState(0);
    const [showReactions, setShowReactions] = useState(false);

    // Comment & Reply States
    const [commentInput, setCommentInput] = useState('');
    const [replyInputs, setReplyInputs] = useState({}); // { [inputKey]: text }
    const [showCommentReactionsFor, setShowCommentReactionsFor] = useState(null);
    const [modalReplies, setModalReplies] = useState({}); // To store fetched replies
    const [loadingReplies, setLoadingReplies] = useState({});

    // Share Modal State
    const [showShareModal, setShowShareModal] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [isMessageExpanded, setIsMessageExpanded] = useState(false);

    const initialImageIndex = searchParams.get('image');

    // Fetch Post Details
    const fetchPostDetails = useCallback(async (loadingState = true) => {
        try {
            if (loadingState && !post) setLoading(true);
            console.log('Fetching post for ID:', params.id);
            let response;
            try {
                // Try client endpoint first (Authenticated) to get user-specific data like 'single_reaction'
                response = await api.get(`/client/singlePost/${params.id}`);
            } catch (clientErr) {
                console.warn('Client endpoint failed, trying fallback to public endpoint...', clientErr);
                try {
                    response = await api.get(`/public/post/${params.id}`);
                } catch (publicErr) {
                    console.error('Fallback endpoint also failed:', publicErr);
                    throw publicErr;
                }
            }

            console.log('API Response:', response);

            const postData = response.data?.data?.value || response.data?.data?.post || response.data?.post || response.data?.value;

            if (postData) {
                console.log('Post data found:', postData);
                setPost(postData);
            } else {
                console.error('Post data missing in response:', response.data);
                if (!post) setError('Post not found');
            }
        } catch (err) {
            console.error('Error fetching post:', err);
            if (!post) setError('Failed to load post');
        } finally {
            if (loadingState) setLoading(false);
        }
    }, [params.id]);

    useEffect(() => {
        if (params?.id) {
            fetchPostDetails();
            dispatch(getAllFollowers());
            dispatch(getMyProfile());
        }
    }, [params?.id, fetchPostDetails, dispatch]);

    // Set initial image index
    useEffect(() => {
        if (post?.files?.length > 0 && initialImageIndex !== null) {
            const index = parseInt(initialImageIndex, 10);
            if (!isNaN(index) && index >= 0 && index < post.files.length) {
                setActiveMediaIndex(index);
            }
        }
    }, [post, initialImageIndex]);

    // Media Navigation
    const handleNextMedia = (e) => {
        e.stopPropagation();
        if (!post?.files?.length) return;
        setActiveMediaIndex((prev) => (prev + 1) % post.files.length);
    };

    const handlePrevMedia = (e) => {
        e.stopPropagation();
        if (!post?.files?.length) return;
        setActiveMediaIndex((prev) => (prev - 1 + post.files.length) % post.files.length);
    };

    const handleClose = () => {
        router.push('/');
    };

    // --- Interaction Handlers ---

    // Post Reactions
    const handleReaction = (reactionType) => {
        if (!post) return;

        // Save current state for potential revert (deep copy)
        const previousPost = JSON.parse(JSON.stringify(post));

        // Optimistic Update using functional state update
        setPost(prev => {
            const updated = { ...prev };
            updated.single_reaction = { type: reactionType };

            // Update reactions array
            if (!prev.single_reaction) {
                updated.reactions = [...(prev.reactions || []), { type: reactionType }];
            }
            return updated;
        });
        setShowReactions(false);

        dispatch(storePostReactions({ post_id: post.id, reaction_type: reactionType }))
            .unwrap()
            .then(() => {
                console.log('[PostDetails] Reaction saved successfully');
                fetchPostDetails(false);
            })
            .catch((error) => {
                console.error('[PostDetails] Reaction failed:', error);
                setPost(previousPost);
                toast.error("Failed to react");
            });
    };

    const handleDeleteReaction = () => {
        if (!post) return;

        // Save current state for revert (deep copy)
        const previousPost = JSON.parse(JSON.stringify(post));

        // Optimistic Update using functional state update
        setPost(prev => ({
            ...prev,
            single_reaction: null,
            reactions: (prev.reactions || []).filter(r => r.client_id !== profile?.client?.id)
        }));

        dispatch(deletePostReaction(post.id))
            .unwrap()
            .then(() => {
                console.log('[PostDetails] Reaction deleted successfully');
                fetchPostDetails(false);
            })
            .catch((error) => {
                console.error('[PostDetails] Delete reaction failed:', error);
                setPost(previousPost);
                toast.error("Failed to remove reaction");
            });
    };

    // Main Comment Submit
    const handleCommentSubmit = (e) => {
        e.preventDefault();
        if (!commentInput.trim() || !post) return;

        const commentContent = commentInput.trim();
        const previousPost = { ...post };

        const optimisticComment = {
            id: `temp-${Date.now()}`,
            content: commentContent,
            created_at: new Date().toISOString(),
            client_comment: {
                fname: profile?.client?.fname || 'You',
                last_name: profile?.client?.last_name || '',
                image: profile?.client?.image,
                username: profile?.client?.username
            },
            reactions_count: 0,
            replies_count: 0
        };

        // Optimistic update - add comment to the list
        setPost(prev => ({
            ...prev,
            comments: [optimisticComment, ...(prev.comments || [])]
        }));
        setCommentInput('');

        dispatch(storeComments({ post_id: post.id, content: commentContent }))
            .unwrap()
            .then((response) => {
                console.log('[PostDetails] Comment response:', response);
                // The response could be in different formats
                const newComment = response?.comment || response?.data?.comment || response;

                if (newComment && newComment.id) {
                    // Replace optimistic comment with real one
                    setPost(prev => ({
                        ...prev,
                        comments: prev.comments.map(c =>
                            c.id === optimisticComment.id ? { ...newComment, client_comment: optimisticComment.client_comment } : c
                        )
                    }));
                } else {
                    // Re-fetch to get proper data
                    fetchPostDetails(false);
                }
            })
            .catch((error) => {
                console.error('[PostDetails] Comment failed:', error);
                setPost(previousPost);
                setCommentInput(commentContent);
                toast.error("Failed to post comment");
            });
    };

    // Comment Likes
    const handleCommentReaction = (comment_id, reaction) => {
        dispatch(likeComment({ comment_id, reaction_type: reaction })).then(() => {
            setShowCommentReactionsFor(null);
            fetchPostDetails(false);
        });
    };

    // Reply Likes
    const handleReplyReaction = (reply_id, reaction, commentId) => {
        dispatch(likeReply({ reply_id, type: reaction })).then(() => {
            setShowCommentReactionsFor(null);
            fetchPostDetails(false);
            // Also refresh replies for this comment if they are loaded
            if (modalReplies[commentId]) {
                handleViewAllReplies(commentId);
            }
        });
    };

    // Fetch Replies
    const handleViewAllReplies = (commentId) => {
        setLoadingReplies((prev) => ({ ...prev, [commentId]: true }));
        dispatch(getCommentReplies(commentId))
            .then((response) => {
                if (response?.payload?.data?.comment?.replies) {
                    setModalReplies((prev) => ({
                        ...prev,
                        [commentId]: response.payload.data.comment.replies || [],
                    }));
                }
            })
            .finally(() => {
                setLoadingReplies((prev) => ({ ...prev, [commentId]: false }));
            });
    };

    // Handle Reply to Reply Input Change
    const handleReplyInputChange = (key, value) => {
        setReplyInputs(prev => ({ ...prev, [key]: value }));
    };

    // Handle Reply Submit
    const handleReplySubmit = (commentId, replyId, inputKey) => {
        const content = replyInputs[inputKey];
        if (!content?.trim()) return;

        const payload = {
            comment_id: commentId,
            parent_id: replyId === commentId ? null : replyId, // If replying to main comment, parent_id is null? No, usually null for top-level, but API might expect id
            content: content
        };
        // Fix: parent_id should be the ID of the comment/reply being replied to, OR null if it's a direct reply to the comment?
        // Checking PostCommentsModal logic: parent_id: replyId === comment.id ? null : replyId
        // Wait, comment.id is the top level comment.

        dispatch(replyToComment(payload))
            .then(() => {
                setReplyInputs(prev => {
                    const copy = { ...prev };
                    delete copy[inputKey];
                    return copy;
                });
                fetchPostDetails();
                handleViewAllReplies(commentId);
            });
    };


    // --- Share Logic ---
    const handleShareClick = () => {
        if (!post) return;
        setShowShareModal(true);
    };

    const cancelShare = () => {
        setShowShareModal(false);
        setIsSharing(false);
    };

    const confirmShare = () => {
        if (!post || isSharing) return;
        setIsSharing(true);
        dispatch(sharePost({ post_id: post.id }))
            .then(() => {
                toast.success("Shared Successfully");
                setShowShareModal(false);
                fetchPostDetails();
            })
            .catch((err) => {
                console.error('Share failed:', err);
                toast.error("Failed to share");
            })
            .finally(() => {
                setIsSharing(false);
            });
    };


    // Helpers
    const getClientImageUrl = (imagePath) => {
        if (!imagePath) return "/common-avator.jpg";
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return imagePath;
        }
        return process.env.NEXT_PUBLIC_FILE_PATH + imagePath;
    };

    const stripHtmlTags = (html) => {
        if (!html) return "";
        return html.replace(/<[^>]*>?/gm, '');
    };

    // Time formatting
    const formatCompactTime = (timestamp) => {
        if (!timestamp) return "";
        const duration = moment.duration(moment().diff(moment(timestamp)));
        const days = Math.floor(duration.asDays());
        const hours = Math.floor(duration.asHours()) % 24;
        const minutes = Math.floor(duration.asMinutes()) % 60;
        if (days > 0) return `${days}d`;
        if (hours > 0) return `${hours}h`;
        if (minutes > 0) return `${minutes}m`;
        return `Just now`;
    };


    // Render Recursive Replies
    const renderReplies = (replies, commentId, level = 1) => {
        if (!Array.isArray(replies) || replies.length === 0) return null;

        return replies.map((reply) => (
            <div key={reply.id} className="flex gap-2 mt-2" style={{ marginLeft: `${level * 12}px` }}>
                <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mt-1">
                    <img
                        src={getClientImageUrl(reply.client_comment?.image)}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.src = "/common-avator.jpg"; }}
                    />
                </div>
                <div className="flex-1">
                    <div className="bg-gray-100 rounded-2xl px-3 py-2 inline-block">
                        <Link href={`/${reply.client_comment?.username}`} className="font-semibold text-xs hover:underline block">
                            {`${reply.client_comment?.fname || ''} ${reply.client_comment?.last_name || ''}`}
                        </Link>
                        <p className="text-xs text-gray-800">{reply.content}</p>
                    </div>
                    <div className="flex items-center gap-2 px-2 mt-0.5 text-[10px] text-gray-500">
                        <span>{formatCompactTime(reply.created_at)}</span>

                        {/* Reply Like Button */}
                        <div className="relative group">
                            <button
                                className={`font-semibold hover:underline ${reply.single_reaction ? 'text-blue-600' : ''}`}
                                onClick={() => setShowCommentReactionsFor(showCommentReactionsFor === reply.id ? null : reply.id)}
                            >
                                {reply.single_reaction ? reply.single_reaction.type : 'Like'}
                            </button>
                            {showCommentReactionsFor === reply.id && (
                                <div className="absolute bottom-full left-0 mb-0 bg-white shadow-xl rounded-full flex gap-0.5 px-2 py-1.5 z-50" onMouseEnter={() => setShowCommentReactionsFor(reply.id)} onMouseLeave={() => setShowCommentReactionsFor(null)}>
                                    {['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'].map((type) => (
                                        <img
                                            key={type}
                                            src={`/${type}.png`}
                                            className="w-4 h-4 cursor-pointer hover:scale-125 transition-transform"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleReplyReaction(reply.id, type, commentId);
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            className="font-semibold hover:underline"
                            onClick={() => setReplyInputs(prev => ({ ...prev, [`reply-${reply.id}`]: `@${reply.client_comment?.fname} ` }))}
                        >
                            Reply
                        </button>
                    </div>

                    {/* Reply Input Field (if active) */}
                    {replyInputs[`reply-${reply.id}`] !== undefined && (
                        <div className="mt-2 flex gap-2">
                            <input
                                autoFocus
                                className="bg-gray-100 border rounded-full px-3 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                                value={replyInputs[`reply-${reply.id}`]}
                                onChange={(e) => handleReplyInputChange(`reply-${reply.id}`, e.target.value)}
                                placeholder={`Reply to ${reply.client_comment?.fname}...`}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleReplySubmit(commentId, reply.id, `reply-${reply.id}`); }}
                            />
                        </div>
                    )}

                    {/* Nested Replies */}
                    {reply.children && renderReplies(reply.children, commentId, level + 1)}
                </div>
            </div>
        ));
    };


    if (loading) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center z-50 text-white">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Unavailable</h2>
                    <p className="mb-4">{error || 'This post is no longer available.'}</p>
                    <button onClick={handleClose} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const currentFile = post.files?.[activeMediaIndex];
    const isVideo = currentFile ? /\.(mp4|webm|ogg|mov|avi)$/i.test(currentFile.file_path || currentFile.path || '') : false;
    const mediaSrc = currentFile ? getImageUrl(currentFile.file_path || currentFile.path, 'post') : null;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col h-screen w-screen bg-black overflow-hidden">
            {!profile?.client?.id && !Cookies.get('old_token') && <LoginPrompt />}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative w-full h-full">

                {/* LEFT SIDE - MEDIA */}
                <div className="relative flex-1 bg-black flex items-center justify-center h-[50vh] md:h-full overflow-hidden">
                    {/* Close Button */}
                    <button
                        onClick={handleClose}
                        className="absolute top-4 left-4 z-20 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                        <FaTimes size={24} />
                    </button>

                    {/* Navigation Buttons */}
                    {post.files?.length > 1 && (
                        <>
                            <button
                                onClick={handlePrevMedia}
                                className="absolute left-4 z-10 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors hidden md:block"
                            >
                                <FaChevronLeft size={24} />
                            </button>
                            <button
                                onClick={handleNextMedia}
                                className="absolute right-4 z-10 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors hidden md:block"
                            >
                                <FaChevronRight size={24} />
                            </button>
                        </>
                    )}

                    {/* Media Content */}
                    <div className="w-full h-full flex items-center justify-center p-4">
                        {post.files?.length > 0 ? (
                            isVideo ? (
                                <video controls autoPlay className="max-w-full max-h-full object-contain">
                                    <source src={mediaSrc} />
                                    Your browser does not support the video tag.
                                </video>
                            ) : (
                                <img
                                    src={mediaSrc}
                                    alt="Post content"
                                    className="max-w-full max-h-full object-contain"
                                />
                            )
                        ) : (
                            // Text-only post with background
                            <div
                                className="w-full h-full flex items-center justify-center text-center p-10 text-white text-3xl font-bold"
                                style={post.background_url && /\/post_background\/.+/.test(post.background_url) ? {
                                    backgroundImage: `url(${post.background_url})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    maxWidth: '800px',
                                    maxHeight: '800px',
                                    aspectRatio: '1/1',
                                    borderRadius: '12px'
                                } : {}}
                            >
                                {post.background_url && /\/post_background\/.+/.test(post.background_url) ? stripHtmlTags(post.message) : (
                                    <div className="bg-gray-800 p-8 rounded-lg max-w-2xl text-xl font-normal">
                                        {post.message}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT SIDE - DETAILS SIDEBAR */}
                <div className="w-full md:w-[400px] h-[50vh] md:h-full bg-white flex flex-col border-l border-gray-200">

                    {/* Header */}
                    <div className="p-4 border-b flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <img
                                src={getClientImageUrl(post.client?.image)}
                                className="w-10 h-10 rounded-full object-cover border border-gray-200"
                                onError={(e) => { e.currentTarget.src = "/common-avator.jpg"; }}
                            />
                            <div>
                                <Link href={`/${post.client?.username}`} className="font-semibold text-gray-900 hover:underline block leading-tight">
                                    {post.client?.display_name || `${post.client?.fname} ${post.client?.last_name}`}
                                </Link>
                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                    <span>{moment(post.created_at).fromNow()}</span>
                                    <span>•</span>
                                    {post.privacy_mode === "public" ? <FaGlobeAmericas /> : <FaLock />}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {/* Post Caption (if not background post) */}
                        {(!post.background_url || !/\/post_background\/.+/.test(post.background_url)) && post.message && (
                            <div className="mb-4">
                                <div
                                    className={`text-gray-900 text-sm whitespace-pre-wrap break-words ${!isMessageExpanded ? 'line-clamp-2' : ''}`}
                                    dangerouslySetInnerHTML={{ __html: post.message }}
                                />
                                {/* Show See more/less only if message is long enough */}
                                {stripHtmlTags(post.message).length > 150 && (
                                    <button
                                        onClick={() => setIsMessageExpanded(!isMessageExpanded)}
                                        className="text-gray-500 hover:text-gray-700 text-sm font-medium mt-1"
                                    >
                                        {isMessageExpanded ? 'See less' : 'See more'}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Stats */}
                        <div className="flex items-center justify-between py-2 text-sm text-gray-600 mb-2">
                            <div className="flex items-center gap-1">
                                {post.reactions?.slice(0, 3).map((reaction, idx) => (
                                    <img key={idx} src={`/${reaction.type}.png`} alt={reaction.type} className="w-4 h-4" />
                                ))}
                                <span className="ml-1 hover:underline cursor-pointer">{post.reactions?.length || 0}</span>
                            </div>
                            <div className="flex gap-4">
                                <span className="hover:underline cursor-pointer">{post.comments?.length || 0} Comments</span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-1 py-1 border-t border-b border-gray-200 mb-4">
                            <div className="relative flex-1">
                                <button
                                    onMouseEnter={() => setShowReactions(true)}
                                    onMouseLeave={() => setShowReactions(false)}
                                    onClick={() => {
                                        if (post.single_reaction) {
                                            handleDeleteReaction();
                                        }
                                    }}
                                    className="w-full py-2 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors text-sm font-medium"
                                >
                                    {!post.single_reaction ? (
                                        <>
                                            <SlLike className="w-5 h-5" />
                                            <span>Like</span>
                                        </>
                                    ) : (
                                        <>
                                            <img src={`/${post.single_reaction.type}.png`} className="w-5 h-5" />
                                            <span className={`capitalize ${post.single_reaction.type === 'like' ? 'text-blue-600' :
                                                post.single_reaction.type === 'love' ? 'text-red-600' : 'text-yellow-600'
                                                }`}>{post.single_reaction.type}</span>
                                        </>
                                    )}
                                </button>
                                {showReactions && (
                                    <div
                                        className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-0 w-full bg-white rounded-full shadow-xl px-2 py-1.5 flex gap-0.5 z-50"
                                        onMouseEnter={() => setShowReactions(true)}
                                        onMouseLeave={() => setShowReactions(false)}
                                    >
                                        {['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'].map((type) => (
                                            <img
                                                key={type}
                                                src={`/${type}.png`}
                                                alt={type}
                                                className="w-8 h-8 cursor-pointer hover:scale-125 transition-transform"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleReaction(type);
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button className="flex-1 py-2 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors text-sm font-medium">
                                <FaRegComment className="w-5 h-5" />
                                <span>Comment</span>
                            </button>
                            <button
                                onClick={handleShareClick}
                                className="flex-1 py-2 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors text-sm font-medium"
                            >
                                <IoMdShareAlt className="w-5 h-5" />
                                <span>Share</span>
                            </button>
                        </div>

                        {/* Comments List */}
                        <div className="space-y-4">
                            {post.comments?.map((comment) => (
                                <div key={comment.id} className="flex gap-2 group">
                                    <img
                                        src={getClientImageUrl(comment.client_comment?.image)}
                                        className="w-8 h-8 rounded-full object-cover mt-1 shrink-0"
                                        onError={(e) => { e.currentTarget.src = "/common-avator.jpg"; }}
                                    />
                                    <div className="flex-1">
                                        <div className="bg-gray-100 rounded-2xl px-3 py-2 inline-block">
                                            <Link href={`/${comment.client_comment?.username}`} className="font-semibold text-sm hover:underline block">
                                                {`${comment.client_comment?.fname || ''} ${comment.client_comment?.last_name || ''}`}
                                            </Link>
                                            <p className="text-sm text-gray-800">{comment.content}</p>
                                        </div>
                                        <div className="flex items-center gap-3 px-2 mt-0.5 text-xs text-gray-500">
                                            <span>{moment(comment.created_at).fromNow()}</span>

                                            {/* Comment Like Button */}
                                            <div className="relative group">
                                                <button
                                                    className={`font-semibold hover:underline ${comment.single_reaction ? 'text-blue-600' : ''}`}
                                                    onClick={() => setShowCommentReactionsFor(showCommentReactionsFor === comment.id ? null : comment.id)}
                                                >
                                                    {comment.single_reaction ? comment.single_reaction.type : 'Like'}
                                                </button>
                                                {showCommentReactionsFor === comment.id && (
                                                    <div className="absolute bottom-full left-0 mb-0 bg-white shadow-xl rounded-full flex gap-0.5 px-2 py-1.5 z-50" onMouseEnter={() => setShowCommentReactionsFor(comment.id)} onMouseLeave={() => setShowCommentReactionsFor(null)}>
                                                        {['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'].map((type) => (
                                                            <img
                                                                key={type}
                                                                src={`/${type}.png`}
                                                                className="w-4 h-4 cursor-pointer hover:scale-125 transition-transform"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCommentReaction(comment.id, type);
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                className="font-semibold hover:underline"
                                                onClick={() => setReplyInputs(prev => ({ ...prev, [`comment-${comment.id}`]: '' }))}
                                            >
                                                Reply
                                            </button>
                                            {comment.single_reaction && (
                                                <span className="flex items-center gap-1">
                                                    <img src={`/${comment.single_reaction.type}.png`} className="w-3 h-3" />
                                                    <span className="text-blue-600">{comment.reactions_count}</span>
                                                </span>
                                            )}
                                        </div>

                                        {/* Reply Input for Main Comment */}
                                        {replyInputs[`comment-${comment.id}`] !== undefined && (
                                            <div className="mt-2 flex gap-2">
                                                <img
                                                    src={getClientImageUrl(profile?.client?.image)}
                                                    className="w-6 h-6 rounded-full object-cover shrink-0"
                                                />
                                                <div className="flex-1">
                                                    <input
                                                        autoFocus
                                                        className="bg-gray-100 border rounded-full px-3 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                                                        value={replyInputs[`comment-${comment.id}`]}
                                                        onChange={(e) => handleReplyInputChange(`comment-${comment.id}`, e.target.value)}
                                                        placeholder="Write a reply..."
                                                        onKeyDown={(e) => { if (e.key === 'Enter') handleReplySubmit(comment.id, comment.id, `comment-${comment.id}`); }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* View Replies Button */}
                                        {(comment.replies_count > 0 || (modalReplies[comment.id] && modalReplies[comment.id].length > 0)) && (
                                            <div className="mt-1 ml-2">
                                                {(!modalReplies[comment.id] || modalReplies[comment.id].length === 0) ? (
                                                    <button
                                                        onClick={() => handleViewAllReplies(comment.id)}
                                                        className="text-xs font-semibold text-gray-600 hover:underline flex items-center gap-1"
                                                    >
                                                        <div className="w-4 h-px bg-gray-400"></div>
                                                        View {comment.replies_count} replies
                                                    </button>
                                                ) : (
                                                    <div className="mt-2">
                                                        {renderReplies(modalReplies[comment.id], comment.id)}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer Input */}
                    <div className="p-3 border-t shrink-0 bg-white z-20">
                        <form onSubmit={handleCommentSubmit} className="flex gap-2">
                            <img
                                src={getClientImageUrl(profile?.client?.image)}
                                className="w-8 h-8 rounded-full object-cover"
                                onError={(e) => { e.currentTarget.src = "/common-avator.jpg"; }}
                            />
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={commentInput}
                                    onChange={(e) => setCommentInput(e.target.value)}
                                    placeholder="Write a comment..."
                                    className="w-full px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <button
                                    type="submit"
                                    disabled={!commentInput.trim()}
                                    className={`absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-600 hover:bg-blue-50 p-1 rounded-full ${!commentInput.trim() && 'opacity-0 pointer-events-none'}`}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="22" y1="2" x2="11" y2="13"></line>
                                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                    </svg>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Share Modal */}
                <ShareModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    postId={post?.id}
                    onShareSuccess={() => fetchPostDetails(false)}
                />

            </div>
        </div>
    );
};

export default PostDetailsPage;
