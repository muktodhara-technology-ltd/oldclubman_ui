"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import Cookies from 'js-cookie';
import Link from 'next/link';
import moment from 'moment';
import toast from "react-hot-toast";
import { FaGlobeAmericas, FaLock, FaRegComment, FaChevronLeft, FaChevronRight, FaTimes } from 'react-icons/fa';
import { SlLike } from 'react-icons/sl';
import { IoMdShareAlt } from 'react-icons/io';
import api from '@/helpers/axios';
import { getImageUrl, resolveActorAvatarUrl } from '@/utility';
import { getAllFollowers, getMyProfile } from "@/views/settings/store";
import {
    storePostReactions,
    deletePostReaction,
    getPostById,
    sharePost
} from '@/views/gathering/store';
import LoginPrompt from '@/components/auth/LoginPrompt';
import ShareModal from '@/components/common/ShareModal';
import CommentSection from '@/components/common/comments/CommentSection';

/** Total reactions — feed API uses multiple_reaction_counts, not reactions.length */
function sumPostReactionCounts(p) {
    if (!p) return 0;
    const rows = p.multiple_reaction_counts;
    if (Array.isArray(rows) && rows.length > 0) {
        return rows.reduce((sum, row) => sum + Number(row?.count ?? 0), 0);
    }
    if (p.reaction_count != null && p.reaction_count !== "") return Number(p.reaction_count);
    return (p.reactions || []).length;
}

/** Up to 3 reaction types for stat icons */
function reactionTypesForDisplay(p) {
    const rows = p?.multiple_reaction_counts;
    if (Array.isArray(rows) && rows.length > 0) {
        return [...rows]
            .filter((r) => r?.type && Number(r?.count) > 0)
            .sort((a, b) => Number(b.count) - Number(a.count))
            .slice(0, 3)
            .map((r) => r.type);
    }
    return (p?.reactions || []).slice(0, 3).map((r) => r.type).filter(Boolean);
}

function applyReactionChange(prev, newType) {
    const prevSingle = prev.single_reaction;
    const mrc = Array.isArray(prev.multiple_reaction_counts) ? [...prev.multiple_reaction_counts] : [];
    const idx = (t) => mrc.findIndex((r) => r.type === t);
    const bump = (t, delta) => {
        const i = idx(t);
        if (i < 0) {
            if (delta > 0) mrc.push({ type: t, count: delta });
            return;
        }
        const next = Math.max(0, Number(mrc[i].count) + delta);
        if (next <= 0) mrc.splice(i, 1);
        else mrc[i] = { ...mrc[i], count: next };
    };
    if (prevSingle?.type) {
        if (prevSingle.type !== newType) {
            bump(prevSingle.type, -1);
            bump(newType, 1);
        }
    } else {
        bump(newType, 1);
    }
    return mrc;
}

function applyRemoveOwnReaction(prev) {
    const single = prev.single_reaction;
    if (!single?.type) return prev.multiple_reaction_counts;
    const mrc = [...(prev.multiple_reaction_counts || [])];
    const i = mrc.findIndex((r) => r.type === single.type);
    if (i < 0) return mrc;
    const next = Math.max(0, Number(mrc[i].count) - 1);
    if (next <= 0) mrc.splice(i, 1);
    else mrc[i] = { ...mrc[i], count: next };
    return mrc;
}

const PostDetailsPage = () => {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const dispatch = useDispatch();
    const { profile } = useSelector(({ settings }) => settings);

    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeMediaIndex, setActiveMediaIndex] = useState(0);
    const [showReactions, setShowReactions] = useState(false);

    // Image preview (comment / reply attachments)
    const [showImagePreview, setShowImagePreview] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [previewImages, setPreviewImages] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const commentsPanelRef = useRef(null);

    // Share Modal State
    const [showShareModal, setShowShareModal] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [isMessageExpanded, setIsMessageExpanded] = useState(false);

    const initialImageIndex = searchParams.get('image');

    // Fetch Post Details - use getPostById for consistency with PostCommentsModal (includes comments)
    const fetchPostDetails = useCallback(async (loadingState = true) => {
        try {
            if (loadingState) setLoading(true);
            let postData = null;
            try {
                const result = await dispatch(getPostById(params.id)).unwrap();
                postData = result;
            } catch (clientErr) {
                console.warn('Client endpoint failed, trying fallback to public endpoint...', clientErr);
                try {
                    const response = await api.get(`/public/post/${params.id}`);
                    postData = response.data?.data?.value || response.data?.data?.post || response.data?.post || response.data?.value;
                    if (!postData?.comments?.length && (response.data?.data?.comments || response.data?.comments)) {
                        postData = { ...postData, comments: response.data?.data?.comments || response.data?.comments };
                    }
                } catch (publicErr) {
                    console.error('Fallback endpoint also failed:', publicErr);
                    throw publicErr;
                }
            }

            if (postData) {
                setPost({ ...postData, comments: postData.comments ?? [] });
                setError(null);
            } else {
                setPost((prev) => {
                    if (!prev) setError('Post not found');
                    return prev;
                });
            }
        } catch (err) {
            console.error('Error fetching post:', err);
            setPost((prev) => {
                if (!prev) setError('Failed to load post');
                return prev;
            });
        } finally {
            if (loadingState) setLoading(false);
        }
    }, [params.id, dispatch]);

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

    const handleImagePreview = useCallback((imageSrc, allImages = [], index = 0) => {
        setPreviewImage(imageSrc);
        setPreviewImages(allImages?.length ? allImages : [imageSrc]);
        setCurrentImageIndex(index);
        setShowImagePreview(true);
    }, []);

    const closeImagePreview = useCallback(() => {
        setShowImagePreview(false);
        setPreviewImage(null);
        setPreviewImages([]);
        setCurrentImageIndex(0);
    }, []);

    const scrollToComments = () => {
        commentsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // --- Interaction Handlers ---

    // Post Reactions
    const handleReaction = (reactionType) => {
        if (!post) return;

        // Save current state for potential revert (deep copy)
        const previousPost = JSON.parse(JSON.stringify(post));

        setPost((prev) => {
            const updated = { ...prev };
            updated.single_reaction = { type: reactionType };
            updated.multiple_reaction_counts = applyReactionChange(prev, reactionType);
            if (!prev.single_reaction) {
                updated.reactions = [...(prev.reactions || []), { type: reactionType }];
            }
            return updated;
        });
        setShowReactions(false);

        dispatch(storePostReactions({ post_id: post.id, reaction_type: reactionType }))
            .unwrap()
            .then(() => {
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

        setPost((prev) => ({
            ...prev,
            single_reaction: null,
            multiple_reaction_counts: applyRemoveOwnReaction(prev),
            reactions: (prev.reactions || []).filter((r) => r.client_id !== profile?.client?.id),
        }));

        dispatch(deletePostReaction(post.id))
            .unwrap()
            .then(() => {
                fetchPostDetails(false);
            })
            .catch((error) => {
                console.error('[PostDetails] Delete reaction failed:', error);
                setPost(previousPost);
                toast.error("Failed to remove reaction");
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


    const actorAvatar = (path) =>
        resolveActorAvatarUrl(path) || "/common-avator.jpg";

    const stripHtmlTags = (html) => {
        if (!html) return "";
        return html.replace(/<[^>]*>?/gm, '');
    };

    useEffect(() => {
        if (!showImagePreview) return;
        const onKey = (e) => {
            if (e.key === "Escape") closeImagePreview();
            if (e.key === "ArrowLeft" && currentImageIndex > 0) {
                const n = currentImageIndex - 1;
                setCurrentImageIndex(n);
                setPreviewImage(previewImages[n]);
            }
            if (e.key === "ArrowRight" && currentImageIndex < previewImages.length - 1) {
                const n = currentImageIndex + 1;
                setCurrentImageIndex(n);
                setPreviewImage(previewImages[n]);
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [showImagePreview, currentImageIndex, previewImages, closeImagePreview]);

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

    const reactionTotal = sumPostReactionCounts(post);
    const reactionIconTypes = reactionTypesForDisplay(post);

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
                                    <div
                                        className="bg-gray-800 p-8 rounded-lg max-w-2xl text-xl font-normal"
                                        dangerouslySetInnerHTML={{ __html: post.message }}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT SIDE - DETAILS SIDEBAR */}
                <div className="w-full md:w-[400px] h-[50vh] md:h-full bg-white flex flex-col border-l border-gray-200 min-h-0">

                    {/* Header */}
                    <div className="p-4 border-b flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <img
                                src={actorAvatar(post.client?.image)}
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

                    {/* Caption + stats + actions (shrink); comments use shared CommentSection */}
                    <div className="flex-shrink-0 overflow-y-auto p-4 custom-scrollbar max-h-[42vh] md:max-h-[45%] border-b border-gray-100">
                        {(!post.background_url || !/\/post_background\/.+/.test(post.background_url)) && post.message && (
                            <div className="mb-4">
                                <div
                                    className={`text-gray-900 text-sm whitespace-pre-wrap break-words ${!isMessageExpanded ? 'line-clamp-2' : ''}`}
                                    dangerouslySetInnerHTML={{ __html: post.message }}
                                />
                                {stripHtmlTags(post.message).length > 150 && (
                                    <button
                                        type="button"
                                        onClick={() => setIsMessageExpanded(!isMessageExpanded)}
                                        className="text-gray-500 hover:text-gray-700 text-sm font-medium mt-1"
                                    >
                                        {isMessageExpanded ? 'See less' : 'See more'}
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-between py-2 text-sm text-gray-600 mb-2">
                            <div className="flex items-center gap-1">
                                {reactionIconTypes.map((type, idx) => (
                                    <img key={`${type}-${idx}`} src={`/${type}.png`} alt={type} className="w-4 h-4" />
                                ))}
                                <span className="ml-1 hover:underline cursor-pointer">{reactionTotal}</span>
                            </div>
                            <div className="flex gap-4">
                                <button type="button" onClick={scrollToComments} className="hover:underline cursor-pointer">
                                    {post.comments_count ?? post.comments?.length ?? 0} Comments
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-1 py-1 border-t border-b border-gray-200">
                            <div className="relative flex-1">
                                <button
                                    type="button"
                                    onMouseEnter={() => setShowReactions(true)}
                                    onMouseLeave={() => setShowReactions(false)}
                                    onClick={() => {
                                        if (post.single_reaction) {
                                            handleDeleteReaction();
                                        } else {
                                            handleReaction('like');
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
                                            <img src={`/${post.single_reaction.type}.png`} alt="" className="w-5 h-5" />
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
                            <button
                                type="button"
                                onClick={scrollToComments}
                                className="flex-1 py-2 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors text-sm font-medium"
                            >
                                <FaRegComment className="w-5 h-5" />
                                <span>Comment</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleShareClick}
                                className="flex-1 py-2 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors text-sm font-medium"
                            >
                                <IoMdShareAlt className="w-5 h-5" />
                                <span>Share</span>
                            </button>
                        </div>
                    </div>

                    <div
                        id="post-comments-panel"
                        ref={commentsPanelRef}
                        className="flex-1 flex flex-col min-h-0 overflow-hidden border-t border-gray-100"
                    >
                        <CommentSection
                            postId={post.id}
                            mode="modal"
                            comments={post.comments || []}
                            commentsCount={post.comments_count ?? post.comments?.length ?? 0}
                            onImagePreview={handleImagePreview}
                            onPostRefresh={() => fetchPostDetails(false)}
                            profile={profile}
                        />
                    </div>
                </div>

                {/* Share Modal */}
                <ShareModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    postId={post?.id}
                    onShareSuccess={() => fetchPostDetails(false)}
                />

                {showImagePreview && previewImage && (
                    <div
                        className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4"
                        onClick={closeImagePreview}
                        role="presentation"
                    >
                        <button
                            type="button"
                            onClick={closeImagePreview}
                            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 z-10"
                            aria-label="Close"
                        >
                            ×
                        </button>
                        {previewImages.length > 1 && currentImageIndex > 0 && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const n = currentImageIndex - 1;
                                    setCurrentImageIndex(n);
                                    setPreviewImage(previewImages[n]);
                                }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-4xl hover:text-gray-300 z-10"
                                aria-label="Previous"
                            >
                                ‹
                            </button>
                        )}
                        {previewImages.length > 1 && currentImageIndex < previewImages.length - 1 && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const n = currentImageIndex + 1;
                                    setCurrentImageIndex(n);
                                    setPreviewImage(previewImages[n]);
                                }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-4xl hover:text-gray-300 z-10"
                                aria-label="Next"
                            >
                                ›
                            </button>
                        )}
                        <img
                            src={previewImage}
                            alt="Preview"
                            className="max-w-full max-h-[90vh] object-contain"
                            onClick={(e) => e.stopPropagation()}
                        />
                        {previewImages.length > 1 && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white bg-black/50 px-3 py-1 rounded text-sm">
                                {currentImageIndex + 1} / {previewImages.length}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};

export default PostDetailsPage;
