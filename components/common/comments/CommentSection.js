"use client";

import React, { useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  storeComments,
  likeComment,
  replyToComment,
  getCommentReplies,
  likeReply,
  getPostById,
  getPosts,
  getGathering,
  deleteComment,
  editComment,
} from "@/views/gathering/store";
import CommentInput from "./CommentInput";
import CommentItem from "./CommentItem";

/**
 * CommentSection – Self-contained orchestrator for posts' comment system.
 *
 * Handles both "inline" (post feed) and "modal" (full comments modal) modes.
 *
 * @param {string}   postId - Post ID
 * @param {string}   mode - "inline" | "modal"
 * @param {array}    comments - Full comment array (modal mode)
 * @param {object}   latestComment - Latest comment object (inline mode)
 * @param {number}   commentsCount - Total comments count
 * @param {function} onViewAllComments - Callback to open the comments modal (inline mode)
 * @param {function} onImagePreview - Callback for image preview
 * @param {function} renderContent - Optional custom content renderer
 * @param {object}   profile - Override profile (optional)
 */
const CommentSection = ({
  postId,
  mode = "inline",
  comments = [],
  latestComment = null,
  commentsCount = 0,
  onViewAllComments,
  onImagePreview,
  renderContent,
  profile: profileProp,
}) => {
  const dispatch = useDispatch();
  const reduxProfile = useSelector(({ settings }) => settings.profile);
  const profile = profileProp || reduxProfile;

  // Local state for loaded replies { [commentId]: replies[] }
  const [loadedReplies, setLoadedReplies] = useState({});
  const [repliesLoading, setRepliesLoading] = useState({});

  // Use ref for handleViewReplies to avoid stale closure issues
  const viewRepliesRef = useRef(null);

  // ----- View Replies -----
  const handleViewReplies = useCallback(
    (commentId, index) => {
      setRepliesLoading((prev) => ({ ...prev, [commentId]: true }));
      dispatch(getCommentReplies(commentId))
        .then((response) => {
          if (response?.payload?.data?.comment?.replies) {
            setLoadedReplies((prev) => ({
              ...prev,
              [commentId]: response.payload.data.comment.replies,
            }));
          }
        })
        .finally(() => {
          setRepliesLoading((prev) => ({ ...prev, [commentId]: false }));
        });
    },
    [dispatch]
  );

  // Keep ref in sync
  viewRepliesRef.current = handleViewReplies;

  // Helper to refresh post data after a mutation
  const refreshPostData = useCallback(() => {
    dispatch(getPosts());
    dispatch(getPostById(postId));
  }, [dispatch, postId]);

  // ----- Comment Submit -----
  const handleCommentSubmit = useCallback(
    (content, files, mentions = []) => {
      if (!content?.trim() && (!files || files.length === 0)) return;

      let payload;
      if (files?.length > 0) {
        const fd = new FormData();
        fd.append("post_id", postId);
        if (content) fd.append("content", content);
        files.forEach((f, idx) => fd.append(`files[${idx}]`, f));
        if (mentions?.length) {
          mentions.forEach((id) => fd.append("mentions[]", id));
        }
        payload = fd;
      } else {
        payload = { post_id: postId, content, mentions: mentions || [] };
      }

      dispatch(storeComments(payload)).then(() => {
        // Refresh immediately after comment is stored
        dispatch(getGathering());
        refreshPostData();
      });
    },
    [dispatch, postId, refreshPostData]
  );

  // ----- Comment Reaction -----
  const handleReactComment = useCallback(
    (commentId, reactionType) => {
      dispatch(likeComment({ comment_id: commentId, reaction_type: reactionType })).then(() => {
        refreshPostData();
      });
    },
    [dispatch, refreshPostData]
  );

  // ----- Reply Reaction -----
  const handleReactReply = useCallback(
    (replyId, reactionType, commentId) => {
      dispatch(likeReply({ reply_id: replyId, type: reactionType })).then(() => {
        refreshPostData();
        if (commentId) viewRepliesRef.current?.(commentId);
      });
    },
    [dispatch, refreshPostData]
  );

  // ----- Reply Submit -----
  const handleReplySubmit = useCallback(
    (commentId, parentId, content, files, mentions = []) => {
      if (!content?.trim() && (!files || files.length === 0)) return;

      let payload;
      if (files?.length > 0) {
        const fd = new FormData();
        fd.append("comment_id", commentId);
        if (parentId !== null && parentId !== undefined) fd.append("parent_id", parentId);
        else fd.append("parent_id", "null");
        if (content) fd.append("content", content);
        files.forEach((f, idx) => fd.append(`files[${idx}]`, f));
        if (mentions?.length) {
          mentions.forEach((id) => fd.append("mentions[]", id));
        }
        payload = fd;
      } else {
        payload = {
          comment_id: commentId,
          parent_id: parentId !== null && parentId !== undefined ? parentId : "null",
          content,
          mentions: mentions || [],
        };
      }

      dispatch(replyToComment(payload)).then(() => {
        // Refresh immediately after reply is stored
        refreshPostData();
        viewRepliesRef.current?.(commentId);
      });
    },
    [dispatch, refreshPostData]
  );

  // ----- Delete Comment (placeholder endpoint) -----
  const handleDeleteComment = useCallback(
    (commentId) => {
      if (!window.confirm("Are you sure you want to delete this comment?")) return;
      dispatch(deleteComment(commentId)).then(() => {
        refreshPostData();
      });
    },
    [dispatch, refreshPostData]
  );

  // ----- Edit Comment (placeholder endpoint) -----
  const handleEditComment = useCallback(
    (commentId, newContent) => {
      dispatch(editComment({ id: commentId, content: newContent })).then(() => {
        refreshPostData();
      });
    },
    [dispatch, refreshPostData]
  );

  // ===================== INLINE MODE =====================
  if (mode === "inline") {
    return (
      <div className="mt-2 px-2 pb-2">
        {/* "View all X comments" link */}
        {commentsCount > 1 && (
          <button
            className="text-gray-500 text-sm hover:underline mb-2 cursor-pointer"
            onClick={onViewAllComments}
          >
            View all {commentsCount} comments
          </button>
        )}

        {/* Latest comment */}
        {latestComment && (
          <CommentItem
            comment={latestComment}
            commentIndex={0}
            onReactComment={handleReactComment}
            onReactReply={handleReactReply}
            onReplySubmit={handleReplySubmit}
            onDeleteComment={handleDeleteComment}
            onEditComment={handleEditComment}
            onViewReplies={handleViewReplies}
            onImagePreview={onImagePreview}
            renderContent={renderContent}
            profile={profile}
            isReply={false}
            loadedReplies={latestComment?.replies}
            repliesLoading={repliesLoading[latestComment?.id]}
            defaultShowReplies={
              !!(latestComment?.replies?.length || latestComment?.children?.length)
            }
          />
        )}

        {/* Comment input */}
        <div className="mt-2">
          <CommentInput
            onSubmit={handleCommentSubmit}
            placeholder="Add a comment..."
            profile={profile}
          />
        </div>
      </div>
    );
  }

  // ===================== MODAL MODE =====================
  return (
    <div className="flex flex-col h-full">
      {/* Scrollable comment list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {comments && comments.length > 0 ? (
          comments.map((comment, i) => (
            <CommentItem
              key={comment?.id || i}
              comment={comment}
              commentIndex={i}
              onReactComment={handleReactComment}
              onReactReply={handleReactReply}
              onReplySubmit={handleReplySubmit}
              onDeleteComment={handleDeleteComment}
              onEditComment={handleEditComment}
              onViewReplies={handleViewReplies}
              onImagePreview={onImagePreview}
              renderContent={renderContent}
              profile={profile}
              isReply={false}
              loadedReplies={loadedReplies[comment?.id]}
              repliesLoading={repliesLoading[comment?.id]}
            />
          ))
        ) : (
          <div className="text-gray-400 text-center py-8">No comments yet.</div>
        )}
      </div>

      {/* Comment input footer */}
      <div className="p-4 bg-gray-50 border-t">
        <CommentInput
          onSubmit={handleCommentSubmit}
          placeholder="Write a comment..."
          profile={profile}
        />
      </div>
    </div>
  );
};

export default CommentSection;
