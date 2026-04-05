"use client";

import React, { useState, useCallback } from "react";
import { useSelector } from "react-redux";
import Link from "next/link";
import moment from "moment";
import { FaGlobeAmericas, FaLock } from "react-icons/fa";
import { SlLike } from "react-icons/sl";
import { IoMdShareAlt } from "react-icons/io";
import { FaRegComment } from "react-icons/fa6";
import { getImageUrl } from "@/utility";
import CommentSection from "./comments/CommentSection";

/**
 * PostCommentsModal - Displays the comments modal for a post.
 * Now delegates all comment/reply logic to CommentSection.
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
    // Legacy props (kept for backward compat, now handled by CommentSection internally)
    emojiCategories,
    commentInputs,
    setCommentInputs,
    handleCommentSubmit,
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
    modalReplyImages,
    setModalReplyImages,
    handleReplyImageClick,
    handleReplyImageChange,
    clearReplyImage,
}) => {
    const [showReactionsFor, setShowReactionsFor] = useState(null);

    // Strip HTML tags helper for background posts
    const stripHtmlTags = useCallback((html) => {
        if (!html) return "";
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>\s*<p>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }, []);

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
                <div className="flex-1 overflow-y-auto">
                    <div className="px-6 pt-4 pb-2">
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
                    </div>

                    {/* ====== Comments (powered by CommentSection) ====== */}
                    <CommentSection
                        postId={basicPostData.id}
                        mode="modal"
                        comments={basicPostData?.comments || []}
                        onImagePreview={handleImagePreview}
                        renderContent={renderContentWithMentions}
                        profile={profile}
                    />
                </div>
            </div>
        </div>
    );
};

PostCommentsModal.displayName = 'PostCommentsModal';

export default React.memo(PostCommentsModal);
