"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import Link from "next/link";
import moment from "moment";
import { FaGlobeAmericas, FaLock, FaCamera } from "react-icons/fa";
import { SlLike } from "react-icons/sl";
import { IoMdShareAlt } from "react-icons/io";
import { FaRegComment } from "react-icons/fa6";
import { MdClose } from "react-icons/md";
import {
    likeComment,
    replyToComment,
    getCommentReplies,
    likeReply,
    getPostById,
    getPosts,
    getGathering,
} from "@/views/gathering/store";
import { getImageUrl } from "@/utility";

/**
 * PostCommentsModal - Displays the comments modal for a post
 * Extracted from PostList.js for better performance
 */
const PostCommentsModal = ({
    isOpen,
    onClose,
    basicPostData,
    profile,
    // Handlers passed from parent
    handleShare,
    handleDeleteReaction,
    handleReaction,
    handleImagePreview,
    // Render helpers passed from parent
    renderContentWithMentions,
    showingReactionsIcon,
    likingReactions,
    reactionsImages,
    // Emoji categories
    emojiCategories,
    // Comment state
    commentInputs,
    setCommentInputs,
    handleCommentSubmit,
    // Mention system
    mentionOpenFor,
    mentionOptions,
    mentionActiveIndex,
    mentionLoading,
    mentionHasMore,
    handleMentionDetect,
    handleMentionKeyDown,
    insertMentionToken,
    renderMentionDropdown,
    inputRefs,
    fileInputRefs,
    // Reply images
    modalReplyImages,
    setModalReplyImages,
    handleReplyImageClick,
    handleReplyImageChange,
    clearReplyImage,
}) => {
    const dispatch = useDispatch();

    // Local state
    const [showReactionsFor, setShowReactionsFor] = useState(null);
    const [showCommentReactionsFor, setShowCommentReactionsFor] = useState(null);
    const [modalReplyInputs, setModalReplyInputs] = useState({});
    const [modalReplies, setModalReplies] = useState({});
    const [loadingReplies, setLoadingReplies] = useState({});
    const [showEmojiPicker, setShowEmojiPicker] = useState(null);
    const [activeEmojiCategory, setActiveEmojiCategory] = useState('smileys');

    const commentReactionRef = useRef(null);

    // Strip HTML tags helper for background posts
    const stripHtmlTags = useCallback((html) => {
        if (!html) return "";
        // Remove HTML tags and decode entities
        const stripped = html
            .replace(/<br\s*\/?>/gi, '\n')  // Convert <br> to newlines
            .replace(/<\/p>\s*<p>/gi, '\n') // Convert paragraph breaks to newlines
            .replace(/<[^>]*>/g, '')         // Remove all other HTML tags
            .replace(/&nbsp;/g, ' ')         // Replace &nbsp; with spaces
            .replace(/&amp;/g, '&')          // Decode &amp;
            .replace(/&lt;/g, '<')           // Decode &lt;
            .replace(/&gt;/g, '>')           // Decode &gt;
            .replace(/\n{3,}/g, '\n\n')      // Collapse multiple newlines
            .trim();
        return stripped;
    }, []);

    // Format time helper
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

    // Handle comment reaction
    const handleCommentReaction = useCallback((comment_id, reaction) => {
        dispatch(likeComment({ comment_id, reaction_type: reaction })).then(() => {
            setShowCommentReactionsFor(null);
            dispatch(getPosts());
            dispatch(getPostById(basicPostData.id));
        });
    }, [dispatch, basicPostData?.id]);

    // Handle reply reaction
    const handleReplyReaction = useCallback((reply_id, reaction, commentId, commentIndex) => {
        dispatch(likeReply({ reply_id, type: reaction })).then(() => {
            setShowCommentReactionsFor(null);
            dispatch(getPosts());
            dispatch(getPostById(basicPostData.id));
            handleViewAllReplies(commentId, commentIndex);
        });
    }, [dispatch, basicPostData?.id]);

    // View all replies for a comment
    const handleViewAllReplies = useCallback((commentId, index) => {
        setLoadingReplies((prev) => ({ ...prev, [commentId]: true }));
        dispatch(getCommentReplies(commentId))
            .then((response) => {
                if (response?.payload?.data?.comment?.replies) {
                    setModalReplies((prev) => ({
                        ...prev,
                        [index]: response.payload.data.comment.replies || [],
                    }));
                }
            })
            .finally(() => {
                setLoadingReplies((prev) => ({ ...prev, [commentId]: false }));
            });
    }, [dispatch]);

    // Handle modal comment like
    const handleModalCommentLike = useCallback((comment) => {
        setShowCommentReactionsFor(comment.id);
    }, []);

    // Handle reply to reply
    const handleReplyToReply = useCallback((commentIndex, replyOrId, firstLevelReplyId = null) => {
        const replyId = typeof replyOrId === 'object' ? replyOrId?.id : replyOrId;
        const inputKey = `reply-${commentIndex}-${replyId}`;

        let defaultValue = "";
        if (typeof replyOrId === 'object') {
            const name = `${replyOrId?.client_comment?.fname || ""} ${replyOrId?.client_comment?.last_name || ""}`.trim();
            if (name) {
                defaultValue = `@${name} `;
            }
        }

        setModalReplyInputs(prev => {
            const next = {};
            if (firstLevelReplyId) {
                next[`first-parent-${commentIndex}`] = firstLevelReplyId;
            } else if (prev[`first-parent-${commentIndex}`] !== undefined) {
                next[`first-parent-${commentIndex}`] = prev[`first-parent-${commentIndex}`];
            }
            const finalValue = prev[inputKey] === undefined ? defaultValue : prev[inputKey];
            next[inputKey] = finalValue;
            return next;
        });

        setTimeout(() => {
            const el = inputRefs.current?.[inputKey];
            if (el) {
                el.focus();
                const caret = (el.value || '').length;
                el.setSelectionRange(caret, caret);
            }
        }, 0);
    }, [inputRefs]);

    // Handle reply to reply submit
    const handleReplyToReplySubmit = useCallback((commentIndex, replyId) => {
        const inputKey = `reply-${commentIndex}-${replyId}`;
        const reply = modalReplyInputs[inputKey];
        const hasImage = Array.isArray(modalReplyImages?.[inputKey]) && modalReplyImages[inputKey].length > 0;

        if (!reply?.trim() && !hasImage) return;

        const comment = basicPostData?.comments?.[commentIndex];

        let payload;
        if (hasImage) {
            const fd = new FormData();
            fd.append("comment_id", comment.id);
            fd.append("parent_id", replyId === comment.id ? "null" : replyId);
            if (reply) fd.append("content", reply);
            (modalReplyImages[inputKey] || []).forEach((img, idx) => {
                if (img?.file) fd.append(`files[${idx}]`, img.file);
            });
            payload = fd;
        } else {
            payload = {
                comment_id: comment.id,
                parent_id: replyId === comment.id ? null : replyId,
                content: reply
            };
        }

        dispatch(replyToComment(payload))
            .then(() => {
                dispatch(getPostById(basicPostData.id));
                setModalReplyInputs(prev => {
                    const copy = { ...prev };
                    delete copy[inputKey];
                    return copy;
                });
                if (setModalReplyImages) {
                    setModalReplyImages(prev => {
                        const copy = { ...prev };
                        delete copy[inputKey];
                        return copy;
                    });
                }
                handleViewAllReplies(comment?.id, commentIndex);
            });
    }, [dispatch, basicPostData, modalReplyInputs, modalReplyImages, setModalReplyImages, handleViewAllReplies]);

    // Handle emoji select
    const handleEmojiSelect = useCallback((emoji, inputKey) => {
        if (inputKey.includes("reply")) {
            setModalReplyInputs((prev) => ({
                ...prev,
                [inputKey]: (prev[inputKey] || '') + emoji,
            }));
        } else if (inputKey.includes("comment")) {
            const postId = inputKey.replace(/^(post-comment-|modal-comment-)/, '');
            setCommentInputs((prev) => ({
                ...prev,
                [postId]: (prev[postId] || '') + emoji,
            }));
        }
        setShowEmojiPicker(null);
    }, [setCommentInputs]);

    // Render replies recursively
    const renderReplies = useCallback((replies, commentIndex, level = 1, parentFirstReplyId = null) => {
        if (!Array.isArray(replies) || replies.length === 0) return null;

        return replies.map((reply, ri) => (
            <div
                className="relative flex mt-2"
                style={{ marginLeft: `${level * 16}px` }}
                key={`${reply?.id || ri}-${level}`}
            >
                <div className="w-6 h-6 rounded-full overflow-hidden mr-2 mt-1">
                    <img
                        src={
                            (reply?.client_comment?.image &&
                                `${process.env.NEXT_PUBLIC_FILE_PATH}${reply?.client_comment?.image?.startsWith('/') ? '' : '/'}${reply?.client_comment?.image}`)
                            || "/common-avator.jpg"
                        }
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.src = "/common-avator.jpg"; }}
                    />
                </div>

                <div className="flex flex-col w-full">
                    <div className="bg-gray-50 w-full p-2 rounded-md border border-gray-200 flex flex-col">
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
                                />
                            )}
                        </span>
                    </div>

                    {/* Reply actions */}
                    <div className="flex gap-3 mt-1 ml-2 text-xs text-gray-500">
                        <div>{formatCompactTime(reply?.created_at)}</div>
                        <button
                            className="hover:underline relative cursor-pointer"
                            onClick={() => setShowCommentReactionsFor(
                                showCommentReactionsFor === reply.id ? null : reply.id
                            )}
                            type="button"
                        >
                            {!reply?.single_reaction ? (
                                <span>Like</span>
                            ) : (
                                <span className="font-semibold text-blue-500">
                                    {reply?.single_reaction?.type}
                                </span>
                            )}
                            {showCommentReactionsFor === reply.id && (
                                <div
                                    ref={commentReactionRef}
                                    className="absolute bottom-full w-50 bg-white p-2 rounded-full shadow-lg flex space-x-2 z-10"
                                >
                                    {['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'].map((type) => (
                                        <img
                                            key={type}
                                            src={`/${type}.png`}
                                            alt={type}
                                            className="w-5 h-5 transform hover:scale-125 transition-transform cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleReplyReaction(reply.id, type, reply.comment_id, commentIndex);
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </button>
                        <button
                            className="hover:underline cursor-pointer"
                            onClick={() => handleReplyToReply(commentIndex, reply, parentFirstReplyId || reply?.id)}
                            type="button"
                        >
                            Reply
                        </button>
                    </div>

                    {/* Reply input */}
                    {modalReplyInputs[`reply-${commentIndex}-${reply.id}`] !== undefined && (
                        <div className="mt-3 ml-6">
                            {/* Image preview for reply */}
                            {modalReplyImages?.[`reply-${commentIndex}-${reply.id}`]?.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {modalReplyImages[`reply-${commentIndex}-${reply.id}`].map((img, idx) => (
                                        <div key={idx} className="relative">
                                            <img
                                                src={img.preview || img.url}
                                                alt={`Attachment ${idx + 1}`}
                                                className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                                            />
                                            <button
                                                type="button"
                                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                                                onClick={() => clearReplyImage?.(`reply-${commentIndex}-${reply.id}`, idx)}
                                            >
                                                <MdClose size={10} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-start">
                                <img
                                    src={profile?.client?.image ?
                                        process.env.NEXT_PUBLIC_FILE_PATH + profile?.client?.image
                                        : "/common-avator.jpg"
                                    }
                                    className="w-8 h-8 rounded-full object-cover mr-2 flex-shrink-0"
                                    alt="Your avatar"
                                    onError={(e) => { e.target.src = "/common-avator.jpg"; }}
                                />
                                <div className="flex-1 bg-gray-100 rounded-2xl border border-gray-200 px-3 py-2 flex items-center gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 bg-transparent focus:outline-none text-sm"
                                        placeholder={`Reply to ${reply?.client_comment?.fname || ""}...`}
                                        value={modalReplyInputs[`reply-${commentIndex}-${reply.id}`] || ""}
                                        ref={(el) => { if (inputRefs.current) inputRefs.current[`reply-${commentIndex}-${reply.id}`] = el; }}
                                        onChange={(e) => {
                                            setModalReplyInputs((prev) => ({
                                                ...prev,
                                                [`reply-${commentIndex}-${reply.id}`]: e.target.value
                                            }));
                                            if (handleMentionDetect) handleMentionDetect(e, `reply-${commentIndex}-${reply.id}`);
                                        }}
                                        onKeyDown={(e) => {
                                            const handled = handleMentionKeyDown?.(e, `reply-${commentIndex}-${reply.id}`);
                                            if (!handled && e.key === 'Enter') {
                                                e.preventDefault();
                                                handleReplyToReplySubmit(commentIndex, reply.id);
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                        onClick={() => handleReplyImageClick?.(`reply-${commentIndex}-${reply.id}`)}
                                        title="Add photo"
                                    >
                                        <FaCamera size={14} />
                                    </button>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        ref={(el) => { if (fileInputRefs?.current) fileInputRefs.current[`reply-${commentIndex}-${reply.id}`] = el; }}
                                        onChange={(e) => handleReplyImageChange?.(e, `reply-${commentIndex}-${reply.id}`)}
                                    />
                                </div>
                                {(modalReplyInputs[`reply-${commentIndex}-${reply.id}`]?.trim() || modalReplyImages?.[`reply-${commentIndex}-${reply.id}`]?.length > 0) && (
                                    <button
                                        className="ml-2 w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center"
                                        onClick={() => handleReplyToReplySubmit(commentIndex, reply.id)}
                                        type="button"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Nested children */}
                    {level < 2 && renderReplies(reply?.children || [], commentIndex, level + 1, parentFirstReplyId || reply?.id)}
                </div>
            </div>
        ));
    }, [
        formatCompactTime,
        renderContentWithMentions,
        showCommentReactionsFor,
        modalReplyInputs,
        modalReplyImages,
        profile,
        handleReplyReaction,
        handleReplyToReply,
        handleReplyToReplySubmit,
        handleMentionDetect,
        handleMentionKeyDown,
        handleImagePreview,
        handleReplyImageClick,
        handleReplyImageChange,
        clearReplyImage,
        inputRefs,
        fileInputRefs,
    ]);

    if (!isOpen || !basicPostData) return null;

    return (
        <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden relative shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="border-b border-gray-200 flex items-center justify-between p-4 pb-2 relative">
                    <div className="absolute text-xl font-bold left-0 w-full text-center">
                        {basicPostData.client?.fname + "'"}s Post
                    </div>
                    <div className="ml-auto z-10">
                        <button
                            className="text-3xl text-black cursor-pointer hover:text-gray-700"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 px-6 pt-4 pb-2 overflow-y-auto">
                    {/* Post Author Info */}
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-10 h-10 rounded-full overflow-hidden">
                            <img
                                src={basicPostData?.client?.image ?
                                    process.env.NEXT_PUBLIC_FILE_PATH + basicPostData?.client?.image
                                    : "/common-avator.jpg"
                                }
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.src = "/common-avator.jpg"; }}
                            />
                        </div>
                        <div>
                            <Link href={`/${basicPostData?.client?.username}`} className="cursor-pointer hover:underline">
                                <div className="font-semibold">
                                    {basicPostData?.client?.display_name ||
                                        `${basicPostData?.client?.fname} ${basicPostData?.client?.last_name}`}
                                </div>
                            </Link>
                            <div className="flex gap-2 text-xs text-gray-500 font-semibold">
                                {moment(basicPostData?.created_at).format("MMM DD") + " at " +
                                    moment(basicPostData.created_at).format("HH:MM A")}
                                <span>•</span>
                                {basicPostData.privacy_mode === "public" ? (
                                    <FaGlobeAmericas className="mt-[3px]" />
                                ) : (
                                    <FaLock className="mt-[3px]" />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Post Message */}
                    {/\/post_background\/.+/.test(basicPostData?.background_url) ? (
                        <div
                            className="relative text-white p-4 text-center text-[40px] w-full min-h-[300px] rounded-lg flex items-center justify-center bg-cover bg-center bg-no-repeat"
                            style={{ backgroundImage: `url(${basicPostData?.background_url})` }}
                        >
                            {stripHtmlTags(basicPostData?.message)}
                        </div>
                    ) : (
                        <div className="text-gray-800 mb-4 break-words">
                            {renderContentWithMentions(basicPostData.message)}
                        </div>
                    )}

                    {/* Post Images */}
                    {basicPostData.files?.length > 0 && (
                        <div className={`mt-3 grid cursor-pointer ${basicPostData.files.length === 1 ? "grid-cols-1" : "grid-cols-2"
                            } gap-2 mb-4`}>
                            {basicPostData.files.map((file, fileIndex) => {
                                const filePath = file.file_path || file.path || '';
                                const isVideo = /\.(mp4|webm|ogg|mov|avi)$/i.test(filePath);
                                const src = getImageUrl(filePath, 'post');
                                const allImages = basicPostData.files
                                    .filter(f => !/\.(mp4|webm|ogg|mov|avi)$/i.test(f.file_path || ''))
                                    .map(f => getImageUrl(f.file_path || f.path || '', 'post'));
                                const imageIndex = allImages.indexOf(src);

                                return (
                                    <div
                                        key={fileIndex}
                                        className={`overflow-hidden rounded-lg ${basicPostData.files.length === 1 ? "max-h-96" : "h-48"
                                            } bg-gray-100`}
                                    >
                                        {isVideo ? (
                                            <video controls className="w-full h-full object-cover">
                                                <source src={src} />
                                            </video>
                                        ) : (
                                            <img
                                                src={src}
                                                alt={`Post media ${fileIndex + 1}`}
                                                className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                                                onClick={() => handleImagePreview(src, allImages, imageIndex)}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Reactions Section */}
                    <div className="border-gray-200 border-t border-b py-2 mt-2">
                        <div className="flex items-center">
                            <span className="mr-2">
                                {basicPostData?.reactions?.slice(0, 2).map((reaction, index) => (
                                    showingReactionsIcon(reaction, index)
                                ))}
                            </span>
                            <span className="text-sm">{basicPostData?.reactions?.length || 0}</span>
                            <span className="flex items-center gap-2 ml-auto text-sm text-gray-500">
                                {basicPostData.comments?.length || 0} <FaRegComment />
                            </span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-between py-1 border-gray-200 border-b mb-4">
                        <div className="flex-1 relative">
                            <button
                                className="w-full py-1 cursor-pointer text-center text-blue-500 bg-gray-100 rounded-md"
                                onMouseEnter={() => setShowReactionsFor(basicPostData.id)}
                                onMouseLeave={() => setShowReactionsFor(null)}
                                onClick={() => {
                                    if (basicPostData.single_reaction) {
                                        handleDeleteReaction(basicPostData.id);
                                    } else {
                                        handleReaction(basicPostData.id, "like");
                                    }
                                }}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    {!basicPostData.single_reaction ? (
                                        <>
                                            <SlLike /> <span>Like</span>
                                        </>
                                    ) : (
                                        likingReactions(basicPostData?.single_reaction)
                                    )}
                                </div>
                            </button>
                            {showReactionsFor === basicPostData.id && (
                                <div
                                    className="reactions-container"
                                    onMouseEnter={() => setShowReactionsFor(basicPostData.id)}
                                    onMouseLeave={() => setShowReactionsFor(null)}
                                >
                                    {reactionsImages(basicPostData)}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => handleShare(basicPostData?.id)}
                            className="flex-1 py-1 cursor-pointer text-center text-gray-500 hover:bg-gray-100 rounded-md"
                        >
                            <div className="flex items-center justify-center gap-2">
                                <IoMdShareAlt /> <span>Share</span>
                            </div>
                        </button>
                    </div>

                    {/* Comments Section */}
                    <h4 className="font-semibold mb-4 text-lg">Comments</h4>
                    {basicPostData?.comments?.length > 0 ? (
                        basicPostData.comments.map((c, i) => (
                            <div key={i} className="mb-4 flex items-start">
                                <div className="relative mr-3">
                                    <div className="w-9 h-9 rounded-full overflow-hidden">
                                        <img
                                            src={c?.client_comment?.image ?
                                                process.env.NEXT_PUBLIC_FILE_PATH + c?.client_comment?.image
                                                : "/common-avator.jpg"
                                            }
                                            className="w-full h-full object-cover"
                                            onError={(e) => { e.target.src = "/common-avator.jpg"; }}
                                        />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <div className="bg-gray-100 p-3 rounded-2xl relative border border-gray-200">
                                        <div className="font-medium text-sm">
                                            <Link href={`/${c?.client_comment?.username || c?.client_id}`} className="cursor-pointer hover:underline">
                                                {`${c?.client_comment?.fname || ''} ${c?.client_comment?.last_name || ''}`}
                                            </Link>
                                        </div>
                                        <div className="text-gray-700 text-sm mt-1">
                                            {renderContentWithMentions(c.content)}
                                        </div>
                                        {/* Comment files */}
                                        {c?.files?.length > 0 && (
                                            <div className="mt-2">
                                                {c.files.map((file, fileIdx) => {
                                                    const filePath = file.file_path || file.path || '';
                                                    const imgSrc = getImageUrl(filePath, 'comment');
                                                    return (
                                                        <img
                                                            key={fileIdx}
                                                            src={imgSrc}
                                                            alt="Comment attachment"
                                                            className="w-auto max-w-full max-h-48 cursor-pointer hover:opacity-90 rounded-lg"
                                                            onClick={() => handleImagePreview(imgSrc, [imgSrc], 0)}
                                                            onError={(e) => {
                                                                // Try different paths
                                                                const postSrc = getImageUrl(filePath, 'post');
                                                                if (e.target.src !== postSrc) {
                                                                    e.target.src = postSrc;
                                                                }
                                                            }}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {/* Reaction pill */}
                                        {c?.reactions?.length > 0 && (
                                            <div className="absolute -bottom-2 right-3 flex items-center gap-1 bg-white rounded-full px-1.5 py-0.5 shadow-sm border border-gray-200">
                                                <div className="flex -space-x-1">
                                                    {c.reactions.slice(0, 2).map((reaction, idx) => (
                                                        showingReactionsIcon(reaction, idx)
                                                    ))}
                                                </div>
                                                <span className="text-[10px] text-gray-600">{c.reactions.length}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Comment Actions */}
                                    <div className="flex items-center gap-3 ml-2 text-[12px] text-gray-600 mt-1">
                                        <span className="text-gray-500">{formatCompactTime(c.created_at)}</span>
                                        <span>•</span>
                                        <button
                                            className="hover:underline relative cursor-pointer font-semibold"
                                            onClick={() => handleModalCommentLike(c)}
                                            type="button"
                                        >
                                            {!c.single_reaction ? "Like" : (
                                                <span className="text-blue-500">{c.single_reaction.type}</span>
                                            )}
                                            {showCommentReactionsFor === c.id && (
                                                <div
                                                    ref={commentReactionRef}
                                                    className="absolute bottom-full w-50 bg-white p-2 rounded-full shadow-lg flex space-x-2 z-10"
                                                >
                                                    {['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'].map((type) => (
                                                        <img
                                                            key={type}
                                                            src={`/${type}.png`}
                                                            alt={type}
                                                            className="w-5 h-5 transform hover:scale-125 transition-transform cursor-pointer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCommentReaction(c.id, type);
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </button>
                                        <span>•</span>
                                        <button
                                            className="hover:underline cursor-pointer font-semibold"
                                            onClick={() => handleReplyToReply(i, c.id)}
                                            type="button"
                                        >
                                            Reply
                                        </button>
                                    </div>

                                    {/* Reply Input */}
                                    {modalReplyInputs[`reply-${i}-${c.id}`] !== undefined && (
                                        <div className="mt-3">
                                            {/* Image preview for reply */}
                                            {modalReplyImages?.[`reply-${i}-${c.id}`]?.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    {modalReplyImages[`reply-${i}-${c.id}`].map((img, idx) => (
                                                        <div key={idx} className="relative">
                                                            <img
                                                                src={img.preview || img.url}
                                                                alt={`Attachment ${idx + 1}`}
                                                                className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                                                            />
                                                            <button
                                                                type="button"
                                                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                                                                onClick={() => clearReplyImage?.(`reply-${i}-${c.id}`, idx)}
                                                            >
                                                                <MdClose size={10} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex items-start">
                                                <img
                                                    src={profile?.client?.image ?
                                                        process.env.NEXT_PUBLIC_FILE_PATH + profile?.client?.image
                                                        : "/common-avator.jpg"
                                                    }
                                                    className="w-8 h-8 rounded-full object-cover mr-2"
                                                    onError={(e) => { e.target.src = "/common-avator.jpg"; }}
                                                />
                                                <div className="flex-1 bg-gray-100 rounded-2xl border border-gray-200 px-3 py-2 flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        className="flex-1 bg-transparent focus:outline-none text-sm"
                                                        placeholder={`Reply to ${c?.client_comment?.fname || ""}...`}
                                                        value={modalReplyInputs[`reply-${i}-${c.id}`] || ""}
                                                        ref={(el) => { if (inputRefs.current) inputRefs.current[`reply-${i}-${c.id}`] = el; }}
                                                        onChange={(e) => {
                                                            setModalReplyInputs((prev) => ({
                                                                ...prev,
                                                                [`reply-${i}-${c.id}`]: e.target.value
                                                            }));
                                                            if (handleMentionDetect) handleMentionDetect(e, `reply-${i}-${c.id}`);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            const handled = handleMentionKeyDown?.(e, `reply-${i}-${c.id}`);
                                                            if (!handled && e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleReplyToReplySubmit(i, c.id);
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                        onClick={() => handleReplyImageClick?.(`reply-${i}-${c.id}`)}
                                                        title="Add photo"
                                                    >
                                                        <FaCamera size={14} />
                                                    </button>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        multiple
                                                        className="hidden"
                                                        ref={(el) => { if (fileInputRefs?.current) fileInputRefs.current[`reply-${i}-${c.id}`] = el; }}
                                                        onChange={(e) => handleReplyImageChange?.(e, `reply-${i}-${c.id}`)}
                                                    />
                                                </div>
                                                {(modalReplyInputs[`reply-${i}-${c.id}`]?.trim() || modalReplyImages?.[`reply-${i}-${c.id}`]?.length > 0) && (
                                                    <button
                                                        className="ml-2 w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center"
                                                        onClick={() => handleReplyToReplySubmit(i, c.id)}
                                                        type="button"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* View Replies Button */}
                                    {(c.replies_count > 0 || c.replies?.length > 0) && (
                                        <div className="mt-2">
                                            <button
                                                onClick={() => {
                                                    if (modalReplies[i]?.length > 0) {
                                                        setModalReplies(prev => ({ ...prev, [i]: [] }));
                                                    } else {
                                                        handleViewAllReplies(c.id, i);
                                                    }
                                                }}
                                                className="text-gray-500 cursor-pointer text-md hover:underline"
                                                disabled={loadingReplies[c.id]}
                                            >
                                                {loadingReplies[c.id] ? "Loading..." :
                                                    modalReplies[i]?.length > 0 ? "Hide replies" :
                                                        `View all replies ${c.replies_count ? `(${c.replies_count})` : ''}`}
                                            </button>
                                        </div>
                                    )}

                                    {/* Replies */}
                                    {(() => {
                                        const repliesForComment = modalReplies[i] || [];
                                        const childIds = new Set();
                                        repliesForComment.forEach(r => (r?.children || []).forEach(ch => ch?.id && childIds.add(ch.id)));
                                        const topLevelReplies = repliesForComment.filter(r => !childIds.has(r?.id));
                                        return renderReplies(topLevelReplies, i, 1, null);
                                    })()}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-gray-400">No comments yet.</div>
                    )}
                </div>

                {/* Comment Input Footer */}
                <div className="p-4 bg-gray-50 border-t">
                    {/* Image preview for comment */}
                    {modalReplyImages?.[`modal-comment-${basicPostData.id}`]?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {modalReplyImages[`modal-comment-${basicPostData.id}`].map((img, idx) => (
                                <div key={idx} className="relative">
                                    <img
                                        src={img.preview || img.url}
                                        alt={`Attachment ${idx + 1}`}
                                        className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                                    />
                                    <button
                                        type="button"
                                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                                        onClick={() => clearReplyImage(`modal-comment-${basicPostData.id}`, idx)}
                                    >
                                        <MdClose size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                            <img
                                src={profile?.client?.image ?
                                    process.env.NEXT_PUBLIC_FILE_PATH + profile?.client?.image
                                    : "/common-avator.jpg"
                                }
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.src = "/common-avator.jpg"; }}
                            />
                        </div>
                        <div className="flex-1 relative overflow-visible" data-mention-anchor="true">
                            {/* Mention Dropdown - positioned above the input */}
                            {renderMentionDropdown && mentionOpenFor === `modal-comment-${basicPostData.id}` && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        bottom: '48px',
                                        left: 0,
                                        width: '100%',
                                        zIndex: 11000,
                                    }}
                                >
                                    <div
                                        className="bg-white border rounded-md shadow-xl max-h-56 overflow-auto"
                                        style={{ width: '100%' }}
                                    >
                                        {mentionOptions?.map((u, idx) => (
                                            <div
                                                key={u.id}
                                                className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 ${idx === mentionActiveIndex ? 'bg-gray-100' : ''}`}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    if (insertMentionToken) insertMentionToken(u, `modal-comment-${basicPostData.id}`);
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
                                                <span className="ml-2 text-xs text-gray-500">Loading...</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="bg-white border border-gray-300 rounded-full px-4 py-2 flex items-center gap-2 overflow-visible">
                                <input
                                    type="text"
                                    className="flex-1 focus:outline-none text-sm"
                                    placeholder="Write a comment..."
                                    value={commentInputs[basicPostData.id] || ""}
                                    ref={(el) => { if (inputRefs.current) inputRefs.current[`modal-comment-${basicPostData.id}`] = el; }}
                                    onChange={(e) => {
                                        setCommentInputs((prev) => ({ ...prev, [basicPostData.id]: e.target.value }));
                                        if (handleMentionDetect) handleMentionDetect(e, `modal-comment-${basicPostData.id}`);
                                    }}
                                    onKeyDown={(e) => {
                                        const handled = handleMentionKeyDown?.(e, `modal-comment-${basicPostData.id}`);
                                        if (!handled && e.key === 'Enter') {
                                            e.preventDefault();
                                            handleCommentSubmit(basicPostData.id);
                                        }
                                    }}
                                />
                                {/* Photo upload button */}
                                <button
                                    type="button"
                                    className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                                    onClick={() => handleReplyImageClick?.(`modal-comment-${basicPostData.id}`)}
                                    title="Add photo"
                                >
                                    <FaCamera size={18} />
                                </button>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    ref={(el) => { if (fileInputRefs?.current) fileInputRefs.current[`modal-comment-${basicPostData.id}`] = el; }}
                                    onChange={(e) => handleReplyImageChange?.(e, `modal-comment-${basicPostData.id}`)}
                                />
                            </div>
                        </div>
                        <button
                            onClick={() => handleCommentSubmit(basicPostData.id)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-semibold disabled:opacity-50"
                            disabled={!(commentInputs[basicPostData.id]?.trim() || modalReplyImages?.[`modal-comment-${basicPostData.id}`]?.length > 0)}
                        >
                            Post
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

PostCommentsModal.displayName = 'PostCommentsModal';

export default React.memo(PostCommentsModal);
