"use client";
import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import FeedHeader from "./FeedHeader";
import ContactsList from "./ContactsList";
import SidebarSearch from "./SidebarSearch";
import SearchResults from "./SearchResults";

const FeedLayout = ({ children, showMsgBtn, showFriends, userProfile, hideSearch }) => {
  const { query, results } = useSelector((state) => state.search);
  const isAdvancedMode = query === "Advanced Search";
  const showAdvancedOnly =
    isAdvancedMode && Array.isArray(results) && results.length > 0;

  const [bgColors, setBgColors] = useState({
    top: 'rgb(212, 167, 154)',
    middle: 'rgb(155, 117, 109)',
    bottom: 'rgb(107, 79, 73)'
  });

  useEffect(() => {
    const handleColorExtraction = (event) => {
      const { colors } = event.detail;
      if (colors && colors.length >= 3) {
        setBgColors({
          top: colors[0],
          middle: colors[0],
          bottom: colors[2]
        });
      }
    };

    window.addEventListener('coverColorsExtracted', handleColorExtraction);
    return () => window.removeEventListener('coverColorsExtracted', handleColorExtraction);
  }, []);

  return (
    <div className="grid grid-cols-11 min-h-screen">
      <div className="col-span-11 md:col-span-11 overflow-y-auto">
        {showAdvancedOnly ? (
          <SearchResults />
        ) : (
          <>
            <div
              className="relative transition-all duration-500"
              style={{
                background: `linear-gradient(to bottom, ${bgColors.top} 0%, ${bgColors.middle} 30%, rgba(255, 255, 255, 0.7) 70%, #FFFFFF 100%)`,
                borderColor: '#EFF2F6'
              }}
            >
              <div
                className="md:px-60 relative"
              >
                <FeedHeader
                  showMsgBtn={showMsgBtn}
                  showFriends={showFriends}
                  userProfile={userProfile}
                />
              </div>
            </div>
            <div className="grid grid-cols-11">

              {!hideSearch && (
                <div className="col-span-2 hidden md:block sticky top-0 p-2  h-screen overflow-y-auto">
                  {/* Left sidebar - Search box */}
                  <SidebarSearch />
                </div>
              )}
              <div className={`col-span-11 ${hideSearch ? 'md:col-span-9' : 'md:col-span-7'} overflow-y-auto`}>
                {children}
              </div>
              <div className="col-span-2 hidden md:block sticky top-0 h-screen">
                <ContactsList />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FeedLayout;
