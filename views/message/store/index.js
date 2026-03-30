import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "@/helpers/axios";
import errorResponse from "@/utility";

export const getAllChat = createAsyncThunk('chat/getAllChat', async () => {
    const result = axios.get("chat")
    .then((res) => {
        const resData = res.data.data;
        return resData;
    })
    .catch((err) => {
        errorResponse(err);
    })
    return result;
})

export const startConversation = createAsyncThunk('chat/startConversation', async (data) => {
  const result = axios.post(`chat`, data)
  .then((res) => {
      const resData = res.data.data;
      return resData;
  })
  .catch((err) => {
      errorResponse(err);
  })
  return result;
})

export const allConversation = createAsyncThunk('chat/allConversation', async (data) => {
  const result = axios.get(`chat`)
  .then((res) => {
      const resData = res.data.data;
      return resData;
  })
  .catch((err) => {
      errorResponse(err);
  })
  return result;
})

export const sendMessage = createAsyncThunk('chat/sendMessage', async (data, { rejectWithValue }) => {
  try {
    let formData = new FormData();
    
    // Add message content
    formData.append('content', data.content || '');
    
    // Add file if exists
    if (data.file) {
      formData.append('files[]', data.file);
    }

    // Add message type
    formData.append('type', data.type || 'text');

    const result = await axios.post(`chat/${data.chatId}/messages`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Accept': 'application/json'
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          // Callback to update UI progress if provided
          if (data.onProgress) {
            data.onProgress(percentCompleted);
          }
        }
      }
    });

    if (result.data.success === false) {
      throw new Error(result.data.message || 'Failed to send message');
    }

    // Backend returns message directly in response
    // Handle both wrapped and unwrapped responses
    const message = result.data.data || result.data;
    return message;
  } catch (err) {
    console.error('Error sending message:', err);
    errorResponse(err);
    return rejectWithValue(err.response?.data || err.message);
  }
});

export const getMessage = createAsyncThunk('chat/getMessage', async (data) => {
  try {
    const result = await axios.get(`chat/${data?.id}/messages`);
    return {
      messages: result.data.data,
      conversation: {
        id: data.id,
        ...result.data.conversation // Include any additional conversation data from the response
      }
    };
  } catch (err) {
    errorResponse(err);
    throw err;
  }
});

export const chatSlice = createSlice({
  name: "chat",
  initialState: {
    allChat: [],
    prevChat: [],
    loading: false,
    convarsationData: null,
    error: null,
    unreadCounts: {} // { conversationId: count }
  },
  reducers: {
    setCurrentConversation: (state, action) => {
      state.convarsationData = action.payload;
    },
    addMessageToChat: (state, action) => {
      // Add a single message to the current chat
      if (state.prevChat) {
        const newMessage = action.payload;
        
        // Remove optimistic message if this is the real one
        if (!newMessage._optimistic) {
          state.prevChat = state.prevChat.filter(msg => !msg._optimistic || msg.id !== `temp-${newMessage.id}`);
        }
        
        // Check if message already exists to avoid duplicates
        const messageExists = state.prevChat.some(msg => 
          msg.id === newMessage.id && !msg._optimistic
        );
        
        if (!messageExists) {
          state.prevChat = [...state.prevChat, newMessage];
        }
      }
    },
    incrementUnreadCount: (state, action) => {
      const conversationId = action.payload;
      state.unreadCounts[conversationId] = (state.unreadCounts[conversationId] || 0) + 1;
    },
    clearUnreadCount: (state, action) => {
      const conversationId = action.payload;
      state.unreadCounts[conversationId] = 0;
    },
    setUnreadCount: (state, action) => {
      const { conversationId, count } = action.payload;
      state.unreadCounts[conversationId] = count;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(getAllChat.fulfilled, (state, action) => {
        state.allChat = action.payload;
        state.loading = false;
      })
      .addCase(getMessage.fulfilled, (state, action) => {
        state.prevChat = action.payload.messages;
        state.convarsationData = action.payload.conversation;
        state.loading = false;
      })
      .addCase(startConversation.fulfilled, (state, action) => {
        state.convarsationData = action.payload.conversation;
        if (action.payload.conversation) {
          state.allChat = [...state.allChat, action.payload.conversation];
        }
        state.loading = false;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.loading = false;
        // action.payload is the message object itself
        if (state.prevChat && action.payload) {
          // Remove optimistic messages
          state.prevChat = state.prevChat.filter(msg => !msg._optimistic);
          
          // Check if real message already exists
          const messageExists = state.prevChat.some(msg => msg.id === action.payload.id);
          
          // Add the real message
          if (!messageExists) {
            state.prevChat = [...state.prevChat, action.payload];
          }
        }
      })
      .addCase(getAllChat.pending, (state) => {
        state.loading = true;
      })
      .addCase(getMessage.pending, (state) => {
        state.loading = true;
        state.prevChat = []; // clear stale messages before loading a new conversation
      })
      .addCase(startConversation.pending, (state) => {
        state.loading = true;
      })
      .addCase(sendMessage.pending, (state) => {
        state.loading = true;
      })
      .addCase(getAllChat.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getMessage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(startConversation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { setCurrentConversation, addMessageToChat, incrementUnreadCount, clearUnreadCount, setUnreadCount } = chatSlice.actions;
export default chatSlice.reducer;
