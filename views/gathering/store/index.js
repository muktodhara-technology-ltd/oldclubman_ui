import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "@/helpers/axios";
import errorResponse from "@/utility";
import { showPreloader, hidePreloader } from "@/redux/common";


export const initialPostData = {
  message: "",
  privacy_mode: "public",
  files: []
}


export const getGathering = createAsyncThunk('gathering/getGathering', async (_, { dispatch }) => {
  dispatch(showPreloader());
  const result = axios.get("client/gathering")
    .then((res) => {
      const resData = res.data.data;
      dispatch(hidePreloader());
      return resData;
    })
    .catch((err) => {
      dispatch(hidePreloader());
      errorResponse(err);
    })
  return result;
})

export const getPosts = createAsyncThunk('gathering/getPosts', async ({ page = 1, search = "" } = {}) => {
  const result = axios.get(`post/10?page=${page}&search=${search}`)
    .then((res) => {
      console.log('📄 API Response for page', page, ':', res.data);
      const resData = res.data.data;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

export const getPostById = createAsyncThunk('gathering/getPostById', async (id, { dispatch }) => {
  dispatch(showPreloader());
  const result = axios.get(`client/singlePost/${id}`)
    .then((res) => {
      console.log('get by id', res.data.data.value)
      const resData = res.data.data.value;
      dispatch(hidePreloader());
      return resData;
    })
    .catch((err) => {
      dispatch(hidePreloader());
      errorResponse(err);
    })
  return result;
})

export const storePost = createAsyncThunk('gathering/storePost', async (data, { dispatch }) => {
  dispatch(showPreloader());
  const result = axios.post("post/store", data)
    .then((res) => {
      const resData = res.data.data;
      dispatch(hidePreloader());
      return resData;
    })
    .catch((err) => {
      dispatch(hidePreloader());
      errorResponse(err);
    })
  return result;
})

export const updatePost = createAsyncThunk('gathering/updatePost', async (data, { dispatch }) => {
  dispatch(showPreloader());
  const result = axios.post(`/post/update/${data?.id}`, data)
    .then((res) => {
      const resData = res.data.data;
      dispatch(hidePreloader());
      return resData;
    })
    .catch((err) => {
      dispatch(hidePreloader());
      errorResponse(err);
    })
  return result;
})

export const sharePost = createAsyncThunk('gathering/sharePost', async (id, { dispatch }) => {
  dispatch(showPreloader());
  const result = axios.post("post/share", id)
    .then((res) => {
      const resData = res.data.data;
      dispatch(hidePreloader());
      return resData;
    })
    .catch((err) => {
      dispatch(hidePreloader());
      errorResponse(err);
    })
  return result;
})

export const storeComments = createAsyncThunk('gathering/storeComments', async (data, { dispatch }) => {
  dispatch(showPreloader());
  const result = axios.post("comment/store", data)
    .then((res) => {
      const resData = res.data.data;
      dispatch(hidePreloader());
      return resData;
    })
    .catch((err) => {
      dispatch(hidePreloader());
      errorResponse(err);
    })
  return result;
})

export const storeCommentReactions = createAsyncThunk('gathering/storeCommentReactions', async (data, { dispatch }) => {
  dispatch(showPreloader());
  const result = axios.post("comment/reaction_save", data)
    .then((res) => {
      const resData = res.data.data;
      dispatch(hidePreloader());
      return resData;
    })
    .catch((err) => {
      dispatch(hidePreloader());
      errorResponse(err);
    })
  return result;
})

export const storePostReactions = createAsyncThunk('gathering/storePostReactions', async (data, { dispatch }) => {
  dispatch(showPreloader());
  const result = axios.post("/post/reaction", data)
    .then((res) => {
      const resData = res.data.data;
      dispatch(hidePreloader());
      return resData;
    })
    .catch((err) => {
      dispatch(hidePreloader());
      errorResponse(err);
    })
  return result;
})

export const updatePostPrivacy = createAsyncThunk('gathering/updatePostPrivacy', async (data, { dispatch }) => {
  dispatch(showPreloader());
  const result = axios.post(`/post/privacy/${data.id}`, data)
    .then((res) => {
      const resData = res.data.data;
      dispatch(hidePreloader());
      return resData;
    })
    .catch((err) => {
      dispatch(hidePreloader());
      errorResponse(err);
    })
  return result;
})

export const deletePost = createAsyncThunk('gathering/deletePost', async (id, { dispatch }) => {
  dispatch(showPreloader());
  const result = axios.post(`/post/delete/${id}`)
    .then((res) => {
      const resData = res.data.data;
      dispatch(hidePreloader());
      return resData;
    })
    .catch((err) => {
      dispatch(hidePreloader());
      errorResponse(err);
    })
  return result;
})

export const deletePostReaction = createAsyncThunk('gathering/deletePostReaction', async (postId, { dispatch }) => {
  dispatch(showPreloader());
  const result = axios.post(`/post_reaction_delete`, { post_id: postId })
    .then((res) => {
      const resData = res.data.data;
      dispatch(hidePreloader());
      return resData;
    })
    .catch((err) => {
      dispatch(hidePreloader());
      errorResponse(err);
    })
  return result;
})

export const searchPosts = createAsyncThunk('gathering/searchPosts', async (searchQuery, { dispatch }) => {
  dispatch(showPreloader());
  const result = axios.get(`post/search?search=${searchQuery}`)
    .then((res) => {
      const resData = res.data.data;
      dispatch(hidePreloader());
      return resData;
    })
    .catch((err) => {
      dispatch(hidePreloader());
      errorResponse(err);
    })
  return result;
})

export const likeComment = createAsyncThunk(
  "gathering/likeComment",
  async (data, { dispatch }) => {
    dispatch(showPreloader());
    try {
      const response = await axios.post(`comment/reaction_save`, data);
      dispatch(hidePreloader());
      return response.data;
    } catch (err) {
      dispatch(hidePreloader());
      errorResponse(err);
      throw err;
    }
  }
);

export const likeReply = createAsyncThunk(
  "gathering/likeComment",
  async (data, { dispatch }) => {
    dispatch(showPreloader());
    try {
      const response = await axios.post(`/comment/replay/reaction`, data);
      dispatch(hidePreloader());
      return response.data;
    } catch (err) {
      dispatch(hidePreloader());
      errorResponse(err);
      throw err;
    }
  }
);

export const replyToComment = createAsyncThunk(
  "gathering/replyToComment",
  async (data, { dispatch }) => {
    dispatch(showPreloader());
    try {
      const response = await axios.post(`/comment/replay`, data);
      dispatch(hidePreloader());
      return response.data;
    } catch (err) {
      dispatch(hidePreloader());
      errorResponse(err);
      throw err;
    }
  }
);



export const getCommentReplies = createAsyncThunk(
  'gathering/getCommentReplies',
  async (commentId, { dispatch }) => {
    dispatch(showPreloader());
    try {
      const response = await axios.get(`comment/reply?comment_id=${commentId}`);
      console.log('comment reply', response)
      dispatch(hidePreloader());
      return response.data;
    } catch (err) {
      dispatch(hidePreloader());
      errorResponse(err);
      throw err;
    }
  }
);




export const gatheringSlice = createSlice({
  name: "gathering",
  initialState: {
    gatheringData: {},
    singlePostData: {},
    postsData: {},
    loading: false,
    basicPostData: initialPostData,
    isPostModalOpen: false
  },
  reducers: {
    bindPostData: (state, action) => {
      state.basicPostData = action.payload || initialPostData
    },

    setPostModalOpen: (state, action) => {
      state.isPostModalOpen = action.payload
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(getGathering.fulfilled, (state, action) => {
        state.gatheringData = action.payload;
        state.loading = false;
      })
      .addCase(getGathering.pending, (state, action) => {
        state.loading = true;
      })
      .addCase(getGathering.rejected, (state, action) => {
        state.loading = false;
      })
      .addCase(getPosts.pending, (state, action) => {
        state.loading = true;
      })
      .addCase(getPosts.rejected, (state, action) => {
        state.loading = false;
      })
      .addCase(getPosts.fulfilled, (state, action) => {
        const newData = action.payload;
        console.log('🔄 Redux - Page:', newData?.current_page, '/', newData?.last_page, '| Posts:', newData?.data?.length);

        // Handle the case where API doesn't return pagination metadata
        if (!newData) {
          console.log('❌ Redux - No data received');
          state.loading = false;
          return;
        }

        // If no pagination data is present, treat as simple data array
        if (!newData.current_page && Array.isArray(newData)) {
          console.log('⚠️ Redux - Handling array response without pagination');
          state.postsData = {
            data: newData,
            current_page: 1,
            last_page: 1
          };
          state.loading = false;
          return;
        }

        // Standard pagination handling
        if (newData?.current_page === 1) {
          // First page - replace all data
          console.log('🆕 Redux - Setting first page data');
          state.postsData = newData;
        } else {
          // Subsequent pages - append data
          console.log('➕ Redux - Appending page data');
          const existingData = state.postsData?.data || [];
          const newPosts = newData?.data || [];

          state.postsData = {
            ...newData,
            data: [...existingData, ...newPosts]
          };
        }
        console.log('✅ Redux - Total posts:', state.postsData?.data?.length);
        state.loading = false;
      })
      .addCase(getPostById.fulfilled, (state, action) => {
        state.basicPostData = action.payload;
        state.loading = false;
      })

      .addCase(storePost.pending, (state, action) => {
        state.loading = true;
      })
      .addCase(storePost.fulfilled, (state, action) => {
        state.loading = false;
      })
      .addCase(storePost.rejected, (state, action) => {
        state.loading = false;
      })

      .addCase(updatePost.pending, (state, action) => {
        state.loading = true;
      })
      .addCase(updatePost.fulfilled, (state, action) => {
        state.loading = false;
      })
      .addCase(updatePost.rejected, (state, action) => {
        state.loading = false;
      })
      .addCase(searchPosts.pending, (state, action) => {
        state.loading = true;
      })
      .addCase(searchPosts.fulfilled, (state, action) => {
        const searchData = action.payload;
        console.log('🔍 Search Results:', searchData?.data?.length);

        if (!searchData) {
          console.log('❌ Search - No data received');
          state.loading = false;
          return;
        }

        // Handle search results similar to regular posts
        if (!searchData.current_page && Array.isArray(searchData)) {
          console.log('⚠️ Search - Handling array response without pagination');
          state.postsData = {
            data: searchData,
            current_page: 1,
            last_page: 1
          };
        } else {
          // Standard pagination handling for search results
          state.postsData = searchData;
        }
        console.log('✅ Search - Total posts:', state.postsData?.data?.length);
        state.loading = false;
      })
      .addCase(searchPosts.rejected, (state, action) => {
        state.loading = false;
      })
  },
});

export const { bindPostData, setPostModalOpen } = gatheringSlice.actions;
export default gatheringSlice.reducer;
