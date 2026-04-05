"use client";

import React, { useRef, useEffect } from "react";

const REACTION_TYPES = [
  { type: "like", label: "Like", color: "text-blue-500" },
  { type: "love", label: "Love", color: "text-red-700" },
  { type: "care", label: "Care", color: "text-yellow-700" },
  { type: "haha", label: "Haha", color: "text-yellow-700" },
  { type: "wow", label: "Wow", color: "text-yellow-700" },
  { type: "sad", label: "Sad", color: "text-yellow-700" },
  { type: "angry", label: "Angry", color: "text-red-500" },
];

/**
 * ReactionPicker - Floating reaction emoji bar (like / love / care / haha / wow / sad / angry).
 * @param {function} onReact - Called with reaction type string when user clicks.
 * @param {boolean} isOpen - Whether picker is visible.
 * @param {function} onClose - Called when picker should close.
 * @param {string} className - Extra classes.
 */
const ReactionPicker = ({ onReact, isOpen, onClose, className = "" }) => {
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={ref}
      className={`absolute bottom-full left-0 mb-1 bg-white p-2 rounded-full shadow-lg flex space-x-2 z-10 ${className}`}
    >
      {REACTION_TYPES.map(({ type }) => (
        <img
          key={type}
          src={`/${type}.png`}
          alt={type}
          className="w-5 h-5 transform hover:scale-125 transition-transform cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onReact(type);
          }}
        />
      ))}
    </div>
  );
};

/**
 * ReactionDisplay - Shows the user's current reaction as colored text.
 */
export const ReactionDisplay = ({ reaction }) => {
  if (!reaction) return <span>Like</span>;

  const info = REACTION_TYPES.find((r) => r.type === reaction.type);
  if (!info) return <span>Like</span>;

  return (
    <span className={`font-semibold ${info.color} text-[12px]`}>
      {info.label}
    </span>
  );
};

/**
 * ReactionIcons - Small reaction icon pills (aggregated on a comment / reply).
 */
export const ReactionIcons = ({ reactions, totalCount }) => {
  if (!reactions || reactions.length === 0) return null;

  return (
    <span className="flex items-center -space-x-1">
      {reactions.slice(0, 3).map((r, i) =>
        r?.type ? (
          <img
            key={i}
            src={`/${r.type}.png`}
            alt={r.type}
            className="w-4 h-4 inline-block"
          />
        ) : null
      )}
      {totalCount > 0 && (
        <span className="text-xs text-gray-500 ml-1">{totalCount}</span>
      )}
    </span>
  );
};

export { REACTION_TYPES };
export default ReactionPicker;
