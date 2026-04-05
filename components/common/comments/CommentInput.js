"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useSelector } from "react-redux";
import api from "@/helpers/axios";

// Helper function to get client image URL
const getClientImageUrl = (imagePath, fallback = "/common-avator.jpg") => {
  if (!imagePath) return fallback;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://"))
    return imagePath;
  return process.env.NEXT_PUBLIC_FILE_PATH + imagePath;
};

// Emoji categories data
const EMOJI_CATEGORIES = {
  smileys: {
    name: "Smileys & People",
    emojis: ["😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","😋","😎","😍","😘","🥰","😗","😙","😚","☺️","🙂","🤗","🤩","🤔","🫡","😐","😑","😶","🙄","😏","😣","😥","😮","🤐","😯","😪","😫","🥱","😴","😌","😛","😜","😝","🤤","😒","😓","😔","😕","🙃","🫠","🤑","😲","☹️","🙁","😖","😞","😟","😤","😢","😭","😦","😧","😨","😩","🤯","😬","😰","😱","🥵","🥶","😳","🤪","😵","🥴","😠","😡","🤬","😷","🤒","🤕","🤢","🤮","🤧","😇","🥳","🥺","🤠","🤡","🤥","🤫","🤭","🧐","🤓","😈","👿","👹","👺","💀","👻","👽","🤖","💩"],
  },
  animals: {
    name: "Animals & Nature",
    emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐽","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜"],
  },
  food: {
    name: "Food & Drink",
    emojis: ["🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🍔","🍟","🍕","🥪","🌭","🍗","🍖","🍝","🍜","🍲","🍛","🍣","🍱","🥟"],
  },
  symbols: {
    name: "Symbols",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🔯","✡️","☸️","🕉️","☯️","✴️","🆚","💮","❌","⭕","🛑","⛔","📛","🚫","💯","💢","♨️","🚷"],
  },
};

/**
 * CommentInput – A fully self-contained comment / reply input component.
 *
 * Includes:
 *  - Text input with auto-focus
 *  - @Mention detection + API search + dropdown
 *  - Emoji picker
 *  - Image attachment (upload, preview, remove)
 *  - Send button
 *
 * @param {function} onSubmit - (processedContent:string, imageFiles:File[], mentions:string[]) => void
 * @param {string}   placeholder - Input placeholder text
 * @param {object}   profile - Current user profile (for avatar)
 * @param {boolean}  autoFocus - Auto-focus on mount
 * @param {string}   initialValue - Pre-fill text (e.g. @mention for reply)
 * @param {boolean}  compact - Smaller layout for nested replies
 * @param {boolean}  showAvatar - Whether to show the user's avatar
 * @param {object}   initialMention - { name, id } to store in mapping on mount
 * @param {string}   submitLabel - Label on the send button ("Post" | "Send")
 */
const CommentInput = ({
  onSubmit,
  placeholder = "Write a comment...",
  profile,
  autoFocus = false,
  initialValue = "",
  compact = false,
  showAvatar = true,
  initialMention = null,
  submitLabel = "",
}) => {
  const { myFollowers } = useSelector(({ settings }) => settings);
  const { basicPostData } = useSelector(({ gathering }) => gathering);

  // ----- Input State -----
  const [text, setText] = useState(initialValue);
  const [images, setImages] = useState([]); // { file, previewUrl, name }[]
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // ----- Mention State -----
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionOptions, setMentionOptions] = useState([]);
  const [mentionActiveIdx, setMentionActiveIdx] = useState(0);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionPage, setMentionPage] = useState(1);
  const [mentionHasMore, setMentionHasMore] = useState(true);
  const mentionAnchorRef = useRef(0); // caret index of the trigger @
  const mentionMappingsRef = useRef(new Map());
  const abortRef = useRef(null);
  const dropdownRef = useRef(null);

  // ----- Emoji State -----
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState("smileys");

  // Store initial mention mapping on mount
  useEffect(() => {
    if (initialMention?.name && initialMention?.id) {
      const key = initialMention.name.toLowerCase().trim().replace(/\s+/g, " ");
      mentionMappingsRef.current.set(key, {
        id: initialMention.id,
        name: initialMention.name,
      });
    }
  }, []); // only on mount

  // Auto-focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [autoFocus]);

  // ----- Mention API -----
  const fetchMentions = useCallback(async (query, page = 1, append = false) => {
    try {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setMentionLoading(true);

      const res = await api.get(`/client/mentioned_people/10`, {
        params: { search: query, page },
        signal: abortRef.current.signal,
      });

      const conn = res.data?.data?.follow_connections;
      if (conn?.data) {
        const users = conn.data.map((u) => ({
          id: u.id,
          name: u.display_name || `${u.fname || ""} ${u.middle_name ? u.middle_name + " " : ""}${u.last_name || ""}`.trim() || "Unknown User",
          avatar: getClientImageUrl(u.image),
          source: "api",
          rawData: u,
        }));
        if (append) setMentionOptions((prev) => [...prev, ...users]);
        else setMentionOptions(users);
        setMentionHasMore(conn.current_page < conn.last_page);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        // Fallback to local followers
        if (!append) {
          const local = buildLocalCandidates(query);
          setMentionOptions(local);
        }
      }
    } finally {
      setMentionLoading(false);
      abortRef.current = null;
    }
  }, []);

  const buildLocalCandidates = useCallback(
    (query = "") => {
      let all = [];
      if (myFollowers?.length) {
        all.push(
          ...myFollowers.map((f) => ({
            id: f?.follower_client?.id,
            name: `${f?.follower_client?.fname || ""} ${f?.follower_client?.last_name || ""}`.trim(),
            avatar: getClientImageUrl(f?.follower_client?.image),
            source: "follower",
          }))
        );
      }
      if (basicPostData?.comments) {
        basicPostData.comments.forEach((c) => {
          all.push({
            id: c.client_id,
            name: `${c?.client_comment?.fname || ""} ${c?.client_comment?.last_name || ""}`.trim(),
            avatar: getClientImageUrl(c?.client_comment?.image),
            source: "comment",
          });
        });
      }
      const q = query.toLowerCase();
      const unique = [];
      const ids = new Set();
      all.forEach((u) => {
        if (u.id && u.name && !ids.has(u.id) && (!q || u.name.toLowerCase().includes(q))) {
          ids.add(u.id);
          unique.push(u);
        }
      });
      return unique.slice(0, 8);
    },
    [myFollowers, basicPostData]
  );

  const resetMention = useCallback(() => {
    setMentionOpen(false);
    setMentionQuery("");
    setMentionOptions([]);
    setMentionActiveIdx(0);
    setMentionPage(1);
    setMentionHasMore(true);
    setMentionLoading(false);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  // Close mention on outside click
  useEffect(() => {
    if (!mentionOpen) return;
    const handler = (e) => {
      if (dropdownRef.current?.contains(e.target)) return;
      if (inputRef.current?.contains(e.target)) return;
      resetMention();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mentionOpen, resetMention]);

  // ----- Handlers -----
  const handleChange = async (e) => {
    const value = e.target.value;
    setText(value);

    // Mention detection
    const caret = e.target.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const atIdx = before.lastIndexOf("@");

    if (atIdx === -1) {
      if (mentionOpen) resetMention();
      return;
    }
    const prevChar = atIdx === 0 ? " " : before[atIdx - 1];
    const query = before.slice(atIdx + 1);
    if (!/\s|^|[(\[{]/.test(prevChar) || !/^[a-zA-Z0-9._-]*$/.test(query)) {
      if (mentionOpen) resetMention();
      return;
    }
    mentionAnchorRef.current = atIdx;
    setMentionQuery(query);
    setMentionActiveIdx(0);
    setMentionOpen(true);
    setMentionPage(1);
    setMentionHasMore(true);
    await fetchMentions(query, 1, false);
  };

  const insertMention = useCallback(
    (user) => {
      const key = user.name.toLowerCase().trim().replace(/\s+/g, " ");
      mentionMappingsRef.current.set(key, { id: user.id, name: user.name, rawData: user.rawData });

      const anchor = mentionAnchorRef.current;
      const caret = inputRef.current?.selectionStart ?? text.length;
      const before = text.slice(0, anchor);
      const after = text.slice(caret);
      const token = `@${user.name} `;
      const newVal = before + token + after;
      setText(newVal);
      resetMention();
      setTimeout(() => {
        if (inputRef.current) {
          const nc = (before + token).length;
          inputRef.current.focus();
          inputRef.current.setSelectionRange(nc, nc);
        }
      }, 0);
    },
    [text, resetMention]
  );

  const handleKeyDown = (e) => {
    // Mention keyboard nav
    if (mentionOpen && mentionOptions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionActiveIdx((i) => (i + 1) % mentionOptions.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionActiveIdx((i) => (i - 1 + mentionOptions.length) % mentionOptions.length); return; }
      if (e.key === "Enter") { e.preventDefault(); insertMention(mentionOptions[mentionActiveIdx]); return; }
      if (e.key === "Escape") { e.preventDefault(); resetMention(); return; }
    }

    // Submit on Enter
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleMentionScroll = useCallback(
    async (e) => {
      const { scrollTop, scrollHeight, clientHeight } = e.target;
      if (scrollTop + clientHeight >= scrollHeight - 10 && mentionHasMore && !mentionLoading) {
        const next = mentionPage + 1;
        setMentionPage(next);
        await fetchMentions(mentionQuery, next, true);
      }
    },
    [mentionHasMore, mentionLoading, mentionPage, mentionQuery, fetchMentions]
  );

  /** Unique client IDs from [Name](id) tokens in processed content (supports multiple mentions). */
  const extractMentionIds = useCallback((processedContent) => {
    if (!processedContent) return [];
    const ids = new Set();
    const re = /\[(.+?)\]\(([a-fA-F0-9-]{36}|[a-zA-Z0-9_-]+)\)/g;
    let m;
    while ((m = re.exec(processedContent)) !== null) {
      if (m[2]) ids.add(m[2]);
    }
    return Array.from(ids);
  }, []);

  // Process @mentions → [Name](id)
  const processContent = useCallback(
    (content) => {
      if (!content) return content;
      let result = content;
      const regex = /@([^\s@]+(?:\s+[^\s@]+)*)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const mentionText = match[1].trim();
        const lookupKey = mentionText.toLowerCase().trim().replace(/\s+/g, " ");

        // Exact match
        let mapping = mentionMappingsRef.current.get(lookupKey);

        // Partial match
        if (!mapping) {
          for (const [key, val] of mentionMappingsRef.current.entries()) {
            if (lookupKey.startsWith(key) && key.length > 0) {
              mapping = val;
              const actualText = mentionText.split(" ").slice(0, key.split(" ").length).join(" ");
              result = result.replace(`@${actualText}`, `[${val.name}](${val.id})`);
              mapping = null; // already replaced
              break;
            }
          }
        }

        if (mapping) {
          result = result.replace(`@${mentionText}`, `[${mapping.name}](${mapping.id})`);
        }
      }
      return result;
    },
    []
  );

  // ----- Image Handling -----
  const handleImageClick = () => fileInputRef.current?.click();

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newImgs = files.map((f) => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
      name: f.name,
    }));
    setImages((prev) => [...prev, ...newImgs]);
    e.target.value = "";
  };

  const removeImage = (idx) => {
    setImages((prev) => {
      const img = prev[idx];
      if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl);
      });
    };
  }, []);

  // ----- Emoji -----
  const handleEmojiSelect = (emoji) => {
    setText((prev) => prev + emoji);
    setShowEmoji(false);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }, 10);
  };

  // Close emoji on outside click
  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e) => {
      if (!e.target.closest(".ci-emoji-picker")) setShowEmoji(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmoji]);

  // ----- Submit -----
  const handleSubmit = () => {
    const processed = processContent(text);
    const hasContent = processed?.trim();
    const hasImages = images.length > 0;
    if (!hasContent && !hasImages) return;
    const mentions = extractMentionIds(processed);
    onSubmit?.(processed, images.map((i) => i.file), mentions);
    setText("");
    setImages([]);
  };

  const hasContent = text?.trim() || images.length > 0;
  const avatarSize = compact ? "w-7 h-7" : "w-8 h-8";

  return (
    <div className="flex items-start gap-2">
      {/* Avatar */}
      {showAvatar && (
        <div className={`${avatarSize} rounded-full overflow-hidden flex-shrink-0 mt-0.5`}>
          <img
            src={getClientImageUrl(profile?.client?.image || profile?.image)}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.src = "/common-avator.jpg"; }}
            alt="avatar"
          />
        </div>
      )}

      {/* Input area */}
      <div className="flex-1 relative overflow-visible" data-mention-anchor="true">
        <div className={`bg-gray-100 border border-gray-200 rounded-md px-3 py-2 focus-within:ring-2 focus-within:ring-gray-100 focus-within:bg-white transition-all ${compact ? "text-xs" : "text-sm"}`}>
          {/* Image previews (inline) */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-10 h-10 flex-shrink-0">
                  <img src={img.previewUrl} className="w-10 h-10 object-cover rounded" alt="preview" />
                  <button
                    type="button"
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] leading-4 flex items-center justify-center"
                    onClick={() => removeImage(idx)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent focus:outline-none placeholder-gray-500"
              placeholder={placeholder}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
            />

            {/* Action buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Photo */}
              <button
                type="button"
                className="p-1 text-gray-500 hover:text-blue-500 transition-colors"
                onClick={handleImageClick}
                title="Add photo"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                </svg>
              </button>

              {/* Emoji */}
              <button
                type="button"
                className="p-1 text-gray-500 hover:text-yellow-500 transition-colors"
                onClick={() => setShowEmoji((v) => !v)}
                title="Add emoji"
              >
                <span className="text-base">😊</span>
              </button>

              {/* Send */}
              {hasContent && (
                <button
                  type="button"
                  className="p-1 text-blue-500 hover:text-blue-700 transition-colors"
                  onClick={handleSubmit}
                  title="Send"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageChange}
        />

        {/* Mention dropdown */}
        {mentionOpen && (mentionOptions.length > 0 || mentionLoading) && (
          <div
            ref={dropdownRef}
            className="absolute left-0 top-full mt-1 w-full bg-white border rounded-md shadow-xl max-h-56 overflow-auto z-[11000]"
            onScroll={handleMentionScroll}
          >
            {mentionOptions.map((u, idx) => (
              <div
                key={u.id}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 ${idx === mentionActiveIdx ? "bg-gray-100" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(u);
                }}
              >
                <img src={u.avatar} className="w-8 h-8 rounded-full object-cover" alt={u.name} />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{u.name}</span>
                  <span className="text-xs text-gray-500">{u.source === "api" ? "Suggested" : u.source}</span>
                </div>
              </div>
            ))}
            {mentionLoading && (
              <div className="flex items-center justify-center py-2 border-t">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                <span className="ml-2 text-xs text-gray-500">Loading...</span>
              </div>
            )}
            {!mentionHasMore && mentionOptions.length > 0 && !mentionLoading && (
              <div className="text-center py-2 text-xs text-gray-500 border-t">No more results</div>
            )}
          </div>
        )}

        {/* Emoji picker */}
        {showEmoji && (
          <div
            className="ci-emoji-picker absolute left-0 top-full mt-1 bg-white border rounded-lg shadow-xl z-[9999] w-80"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-3">
              <div className="flex gap-1 mb-2 border-b pb-2">
                {Object.entries(EMOJI_CATEGORIES).map(([key, cat]) => (
                  <button
                    key={key}
                    className={`px-2 py-1 text-xs rounded ${emojiCategory === key ? "bg-blue-100 text-blue-600" : "text-gray-600 hover:bg-gray-100"}`}
                    onClick={() => setEmojiCategory(key)}
                  >
                    {cat.name.split(" ")[0]}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                {EMOJI_CATEGORIES[emojiCategory]?.emojis.map((em, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="p-1 hover:bg-gray-100 rounded text-lg"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleEmojiSelect(em);
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentInput;
