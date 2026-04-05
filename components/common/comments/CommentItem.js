"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FaCheckCircle, FaEllipsisH } from "react-icons/fa";
import { MdOutlineDeleteOutline, MdEdit } from "react-icons/md";
import moment from "moment";
import { getImageUrl } from "@/utility";
import ReactionPicker, { ReactionDisplay, ReactionIcons } from "./ReactionPicker";
import CommentInput from "./CommentInput";

// Helper function to get client image URL
const getClientImageUrl = (imagePath, fallback = "/common-avator.jpg") => {
  if (!imagePath) return fallback;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://"))
    return imagePath;
  return process.env.NEXT_PUBLIC_FILE_PATH + imagePath;
};

// Compact time formatter
const formatCompactTime = (timestamp) => {
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
};

/**
 * Merge reply trees into a deduped id → reply map (flat list + nested children may duplicate ids).
 */
function mergeReplyIntoMap(map, reply) {
  if (!reply?.id) return;
  if (!map.has(reply.id)) map.set(reply.id, reply);
  (reply.children || []).forEach((ch) => mergeReplyIntoMap(map, ch));
}

function collectRepliesMapFromComment(comment, loadedReplies) {
  const map = new Map();
  const source =
    loadedReplies != null ? loadedReplies : Array.isArray(comment?.replies) ? comment.replies : [];
  const list = Array.isArray(source) ? source : [];
  list.forEach((r) => mergeReplyIntoMap(map, r));
  return map;
}

function isRootReply(r) {
  const p = r?.parent_id;
  return p == null || p === "" || p === "null";
}

/**
 * Flat display order: each direct reply, then all its descendants (same indent tier), then next direct reply.
 */
function buildFlatReplyRows(comment, loadedReplies) {
  const map = collectRepliesMapFromComment(comment, loadedReplies);
  const byParent = new Map();
  for (const r of map.values()) {
    const key = isRootReply(r) ? "__root__" : String(r.parent_id);
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(r);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  const roots = byParent.get("__root__") || [];
  const rows = [];
  const walkDescendants = (replyId) => {
    const kids = byParent.get(replyId) || [];
    for (const k of kids) {
      rows.push({ reply: k, tier: 2 });
      walkDescendants(k.id);
    }
  };
  for (const root of roots) {
    rows.push({ reply: root, tier: 1 });
    walkDescendants(root.id);
  }
  return rows;
}

function countAllReplies(comment, loadedReplies) {
  return collectRepliesMapFromComment(comment, loadedReplies).size;
}

// Simple mention renderer (parses [Name](id) → clickable Link)
const renderMentionContent = (text) => {
  if (!text) return null;

  // Clean up @ from mention formats
  let cleaned = text
    .replace(/@(\[.+?\]\([a-zA-Z0-9_-]+\))/g, "$1")
    .replace(/@([^\s@]+(?:\s[^\s@]+)*)/g, "$1");

  const regex = /\[(.+?)\]\(([a-zA-Z0-9_-]+)\)/g;
  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(cleaned)) !== null) {
    const start = match.index;
    const [full, name, id] = match;
    if (start > lastIndex) elements.push(cleaned.slice(lastIndex, start));
    elements.push(
      <Link
        href={`/${id}`}
        className="text-black hover:text-gray-700 font-bold cursor-pointer bg-blue-50 hover:bg-blue-100 px-1 py-0.5 rounded transition-colors duration-200"
        key={`m-${start}`}
      >
        {name}
      </Link>
    );
    lastIndex = start + full.length;
  }
  if (lastIndex < cleaned.length) elements.push(cleaned.slice(lastIndex));

  if (elements.length > 0)
    return elements.map((el, i) => (typeof el === "string" ? <span key={i}>{el}</span> : el));

  return <span>{cleaned}</span>;
};

/**
 * Build correct CDN URLs for comment/reply attachments. Using getImageUrl(path, "post") alone
 * breaks when file_path already starts with comment/, reply/, or post/ (double prefix).
 */
function getCommentFileUrlCandidates(filePath) {
  if (!filePath) return [];
  const raw = String(filePath).trim();
  if (raw.startsWith("http://") || raw.startsWith("https://")) return [raw];
  const clean = raw.replace(/^\/+/, "");
  if (clean.startsWith("comment/")) return [getImageUrl(filePath, "comment")];
  if (clean.startsWith("reply/")) return [getImageUrl(filePath, "reply")];
  if (clean.startsWith("post/")) return [getImageUrl(filePath, "post")];
  return [
    getImageUrl(filePath, "comment"),
    getImageUrl(filePath, "reply"),
    getImageUrl(filePath, "post"),
  ].filter((u, i, arr) => u && arr.indexOf(u) === i);
}

function previewUrlsFromFiles(files) {
  return (files || [])
    .map((f) => getCommentFileUrlCandidates(f?.file_path)[0])
    .filter(Boolean);
}

/** Thumbnail + preview use the same resolved URL; onError tries alternate path prefixes. */
function CommentAttachmentThumb({ filePath, fileIndex, files, onImagePreview }) {
  const candidates = getCommentFileUrlCandidates(filePath);
  const [cIdx, setCIdx] = useState(0);
  if (!candidates.length) return null;
  const src = candidates[Math.min(cIdx, candidates.length - 1)];
  const gallery = previewUrlsFromFiles(files);

  return (
    <img
      src={src}
      width={120}
      height={120}
      className="mt-2 cursor-pointer hover:opacity-90 transition-opacity rounded-lg"
      onClick={() => onImagePreview?.(src, gallery.length ? gallery : [src], fileIndex)}
      alt="Attachment"
      onError={() => {
        if (cIdx < candidates.length - 1) setCIdx((n) => n + 1);
      }}
    />
  );
}

/**
 * CommentItem – Renders a single comment or reply with:
 * - Avatar, name, timestamp, verification badge
 * - Content with mention rendering
 * - Image attachments
 * - Reaction display + picker
 * - Like / Reply / 3-dot menu (edit/delete)
 * - Replies: two visual tiers (indent) — direct to comment vs deeper replies (flattened).
 *
 * @param {object}   comment - The comment/reply data object from API
 * @param {number}   commentIndex - Position index in parent array
 * @param {number}   replyRowTier - 1 = direct reply, 2 = deeper reply (flat thread); omit for top-level comment
 * @param {function} onReactComment - (commentId, reactionType) => void
 * @param {function} onReactReply - (replyId, reactionType, commentId) => void
 * @param {function} onReplySubmit - (commentId, parentId, content, files, mentions) => void
 * @param {function} onDeleteComment - (commentId) => void
 * @param {function} onEditComment - (commentId, newContent) => void
 * @param {function} onViewReplies - (commentId, index) => void
 * @param {function} onImagePreview - (url, urls, index) => void
 * @param {function} renderContent - Optional custom content renderer (from parent for profile popup support)
 * @param {object}   profile - Current user profile
 * @param {boolean}  isReply - Whether this is a reply (not top-level comment)
 * @param {array}    loadedReplies - Replies from lazy fetch; when null/undefined, uses comment.replies
 * @param {boolean}  repliesLoading - Whether replies are loading
 * @param {boolean}  defaultShowReplies - Start with replies expanded (e.g. inline feed preview)
 */
const CommentItem = ({
  comment,
  commentIndex,
  replyRowTier,
  onReactComment,
  onReactReply,
  onReplySubmit,
  onDeleteComment,
  onEditComment,
  onViewReplies,
  onImagePreview,
  renderContent,
  profile,
  isReply = false,
  loadedReplies,
  repliesLoading = false,
  defaultShowReplies,
}) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment?.content || "");
  const [showReplies, setShowReplies] = useState(
    () => defaultShowReplies === true || (defaultShowReplies !== false && !isReply && (comment?.replies?.length > 0 || comment?.children?.length > 0))
  );

  // Determine data source fields (comments vs replies have slightly different shapes)
  const clientData = comment?.client_comment || comment?.client;
  const fname = clientData?.fname || "";
  const lastName = clientData?.last_name || "";
  const fullName = `${fname} ${lastName}`.trim() || "Unknown User";
  const username = comment?.username || clientData?.username;
  const avatarUrl = getClientImageUrl(clientData?.image);
  const isVerified = clientData?.is_verified;
  const isOwnComment = profile?.client?.id === (comment?.client_id || clientData?.id);

  // Use custom renderer or default
  const contentRenderer = renderContent || renderMentionContent;

  const flatRows = !isReply ? buildFlatReplyRows(comment, loadedReplies) : [];
  const repliesCount =
    comment?.replies_count != null && comment?.replies_count !== ""
      ? Number(comment.replies_count)
      : !isReply
        ? countAllReplies(comment, loadedReplies)
        : 0;

  const handleReact = (type) => {
    setShowReactionPicker(false);
    if (isReply) {
      onReactReply?.(comment.id, type, comment.comment_id);
    } else {
      onReactComment?.(comment.id, type);
    }
  };

  const handleReplyClick = () => {
    setShowReplyInput((v) => !v);
  };

  const handleReplySubmitted = (content, files, mentions = []) => {
    const parentId = isReply ? comment.id : null;
    const rootCommentId = isReply ? comment.comment_id : comment.id;
    onReplySubmit?.(rootCommentId, parentId, content, files, mentions);
    setShowReplyInput(false);
  };

  const handleDelete = () => {
    setShowMenu(false);
    onDeleteComment?.(comment.id);
  };

  const handleEditSave = () => {
    onEditComment?.(comment.id, editText);
    setIsEditing(false);
    setShowMenu(false);
  };

  const handleViewRepliesToggle = () => {
    if (showReplies) {
      setShowReplies(false);
    } else {
      setShowReplies(true);
      onViewReplies?.(comment.id, commentIndex);
    }
  };

  const rowIndentClass =
    isReply && replyRowTier === 1
      ? "ml-1 sm:ml-3 pl-2"
      : isReply && replyRowTier === 2
        ? "ml-10 sm:ml-16 pl-3"
        : "";

  // Reply name for placeholder
  const replyToName = fname || "user";

  return (
    <div className={`${isReply ? "" : "mb-4"} ${rowIndentClass}`}>
      <div className="flex items-start gap-2">
        {/* Avatar */}
        <div className={`${isReply ? "w-7 h-7" : "w-9 h-9"} rounded-full overflow-hidden flex-shrink-0`}>
          <img
            src={avatarUrl}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.src = "/common-avator.jpg"; }}
            alt={fullName}
          />
        </div>

        {/* Content bubble */}
        <div className="flex-1 min-w-0">
          <div className="bg-gray-100 rounded-md px-3 py-2 relative group">
            {/* 3-dot menu (own comments only) */}
            {/* {isOwnComment && (
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200"
                  onClick={() => setShowMenu((v) => !v)}
                >
                  <FaEllipsisH size={12} />
                </button>

               
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-xl z-20 min-w-[120px]">
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => { setIsEditing(true); setShowMenu(false); }}
                    >
                      <MdEdit size={14} /> Edit
                    </button>
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      onClick={handleDelete}
                    >
                      <MdOutlineDeleteOutline size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            )} */}

            {/* Name + time */}
            <div className="flex items-center flex-wrap gap-1">
              <Link href={`/${username || comment?.client_id}`} className="font-[600] text-md hover:underline cursor-pointer">
                {fullName}
              </Link>
              {isVerified && <FaCheckCircle className="text-blue-500 text-[10px]" />}
             
            </div>

            {/* Content */}
            {isEditing ? (
              <div className="mt-1">
                <input
                  type="text"
                  className="w-full text-sm bg-white border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(); if (e.key === "Escape") setIsEditing(false); }}
                  autoFocus
                />
                <div className="flex gap-2 mt-1">
                  <button className="text-xs text-blue-600 hover:underline" onClick={handleEditSave}>Save</button>
                  <button className="text-xs text-gray-500 hover:underline" onClick={() => setIsEditing(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="text-gray-900 text-[15px] mt-0.5">
                {contentRenderer(comment?.content)}
              </div>
            )}

            {/* Image attachments — URL matches preview (path-aware, not always "post") */}
            {comment?.files?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {comment.files.map((file, fi) => (
                  <CommentAttachmentThumb
                    key={file?.id || fi}
                    filePath={file?.file_path}
                    fileIndex={fi}
                    files={comment.files}
                    onImagePreview={onImagePreview}
                  />
                ))}
              </div>
            )}

            {/* Reaction pill */}
            {comment?.reactions?.length > 0 && (
              <div className="absolute -bottom-2 right-2">
                <ReactionIcons reactions={comment.reactions} totalCount={comment.reactions_count} />
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-3 ml-2 text-[12px] text-gray-600 mt-1">
            <span>{formatCompactTime(comment?.created_at)}</span>
            <span>•</span>
            {/* Like button with picker */}
            <button
              className="hover:underline relative cursor-pointer"
              onClick={() => setShowReactionPicker((v) => !v)}
              type="button"
            >
              <ReactionDisplay reaction={comment?.single_reaction} />
              <ReactionPicker
                isOpen={showReactionPicker}
                onReact={handleReact}
                onClose={() => setShowReactionPicker(false)}
              />
            </button>

            <span>•</span>

            {/* Reply button */}
            <button
              className="hover:underline cursor-pointer font-semibold"
              onClick={handleReplyClick}
              type="button"
            >
              Reply
            </button>
          </div>

          {/* View replies button (for top-level comments with replies) */}
          {!isReply && repliesCount > 0 && (
            <div className="mt-1 ml-2">
              <button
                onClick={handleViewRepliesToggle}
                className="text-gray-500 cursor-pointer text-xs hover:underline"
                disabled={repliesLoading}
              >
                {repliesLoading
                  ? "Loading..."
                  : showReplies
                    ? "Hide replies"
                    : `View all replies${repliesCount ? ` (${repliesCount})` : ""}`}
              </button>
            </div>
          )}

          {/* Flat thread: * direct replies, ** all deeper replies (same tier) */}
          {showReplies && !isReply && flatRows.length > 0 && (
            <div className="mt-2 space-y-3">
              {flatRows.map(({ reply, tier }, ri) => (
                <CommentItem
                  key={reply?.id || ri}
                  comment={reply}
                  commentIndex={commentIndex}
                  replyRowTier={tier}
                  onReactComment={onReactComment}
                  onReactReply={onReactReply}
                  onReplySubmit={onReplySubmit}
                  onDeleteComment={onDeleteComment}
                  onEditComment={onEditComment}
                  onViewReplies={onViewReplies}
                  onImagePreview={onImagePreview}
                  renderContent={renderContent}
                  profile={profile}
                  isReply={true}
                  defaultShowReplies={false}
                />
              ))}
            </div>
          )}

          {/* Reply input */}
          {showReplyInput && (
            <div className="mt-2 ml-2">
              <CommentInput
                onSubmit={handleReplySubmitted}
                placeholder={`Reply to ${replyToName}...`}
                profile={profile}
                autoFocus
                compact
                initialValue={`@${fullName} `}
                initialMention={{ name: fullName, id: comment?.client_id || clientData?.id }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { formatCompactTime, renderMentionContent, getClientImageUrl };
export default CommentItem;
