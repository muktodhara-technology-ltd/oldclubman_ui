"use client";

import React from 'react';
import { useChatBox } from '@/contexts/ChatBoxContext';
import ChatBox from './ChatBox';

const GlobalChatBox = () => {
  const { isOpen, activeChat, activeUser, activeInitialMessage, closeChat } = useChatBox();

  if (!isOpen) return null;

  return (
    <ChatBox
      user={activeUser}
      currentChat={activeChat}
      initialMessage={activeInitialMessage}
      onClose={closeChat}
    />
  );
};

export default GlobalChatBox;

