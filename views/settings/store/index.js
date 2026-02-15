import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "@/helpers/axios";
import errorResponse from "@/utility";

const initialProfileSettingsData = {
  cover_photo: "",
  image: "",
  profile_overview: "",
  tagline: ""
}

export const getMyProfile = createAsyncThunk('settings/getMyProfile', async () => {
  const result = axios.get("client/myprofile")
    .then((res) => {
      const resData = res.data.data;

      const myProfile = {
        ...resData,
        client: {
          ...resData.client,
          marital_status_name: resData?.client?.marital_status === 1 ? "Single" : resData?.client?.marital_status === 2 ? "Married" : resData?.client?.marital_status === 3 ? "Divorced" : "Widowed",
          profile_visibility: JSON.parse(resData?.client?.profile_visibility)
        }

      }
      console.log('resData from myprofile', resData)

      return myProfile;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

export const getUserProfile = createAsyncThunk('settings/getUserProfile', async (id, limit = 10) => {
  const result = axios.get(`client/user_profile/${id}/10`)
    .then((res) => {
      const resData = res.data.data;
      const userProfile = {
        ...resData,
        client: {
          ...resData.client,
          marital_status_name: resData?.client?.marital_status === 1 ? "Single" : resData?.client?.marital_status === 2 ? "Married" : resData?.client?.marital_status === 3 ? "Divorced" : "Widowed",
          profile_visibility: JSON.parse(resData?.client?.profile_visibility)
        }

      }
      return userProfile;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

export const getUserProfileByUsername = createAsyncThunk('settings/getUserProfileByUsername', async (id, limit = 10) => {
  const result = axios.get(`/client/user_profile_by_username/${id}`)
    .then((res) => {
      const resData = res.data.data;
      const userProfile = {
        ...resData,
        client: {
          ...resData.client,
          marital_status_name: resData?.client?.marital_status === 1 ? "Single" : resData?.client?.marital_status === 2 ? "Married" : resData?.client?.marital_status === 3 ? "Divorced" : "Widowed",
          profile_visibility: JSON.parse(resData?.client?.profile_visibility)
        }

      }
      return userProfile;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

export const storeBsicInformation = createAsyncThunk('settings/storeBsicInformation', async (data) => {
  const result = axios.post("/client/save_profile", data)
    .then((res) => {
      const resData = res.data.data;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

export const storeProfileSetting = createAsyncThunk('settings/storeBsicInformation', async (data) => {
  const result = axios.post("/client/save_cover_profile_photo", data)
    .then((res) => {
      const resData = res.data.data;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

export const getAllFollowers = createAsyncThunk('settings/getAllFollowers', async () => {
  const result = axios.get("client/all_followers")
    .then((res) => {
      const resData = res.data.data.followers;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

export const followTo = createAsyncThunk('settings/followTo', async (id) => {
  const result = axios.post("/follow", id)
    .then((res) => {
      const resData = res.data.data;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

export const unFollowTo = createAsyncThunk('settings/unFollowTo', async (id) => {
  const result = axios.post("/unfollow", id)
    .then((res) => {
      const resData = res.data.data;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

export const saveContact = createAsyncThunk('settings/saveContact', async (id) => {
  const result = axios.get(`/public/nfc/card/save_contact/${id}`)
    .then((res) => {
      const resData = res.data.data;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

export const getUserFollowers = createAsyncThunk('settings/getUserFollowers', async (id, limit = 20) => {
  const result = axios.get(`/client/all_followers_user/${id}/20`)
    .then((res) => {
      console.log(res.data.data.followers)
      const resData = res.data.data.followers;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

export const getUserFollowing = createAsyncThunk('settings/getUserFollowing', async (id, limit = 20) => {
  const result = axios.get(`/client/all_following_user/${id}/20`)
    .then((res) => {
      console.log(res.data.data.followers)

      const resData = res.data.data.followers;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

export const getFollowSuggestions = createAsyncThunk('settings/getFollowSuggestions', async (page = 1) => {
  const result = axios.get(`/client/random_people/5?page=${page}`)
    .then((res) => {
      console.log('📄 API Response for FollowSuggestions', res.data.data.follow_connections);
      const resData = res.data.data?.follow_connections?.data;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

export const getPostBackgrounds = createAsyncThunk('settings/getPostBackgrounds', async () => {
  const result = axios.get(`/post_background`)
    .then((res) => {
      console.log('posts backgorund', res.data.data)
      const resData = res.data.data;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})


// work settings in edit details page
export const saveWork = createAsyncThunk('settings/saveWork', async (data) => {
  try {
    const res = await axios.post(`/client/save_work`, data);
    return res.data.data;
  } catch (err) {
    errorResponse(err);
    throw err; // Re-throw so the thunk properly rejects
  }
})

export const updateWork = createAsyncThunk('settings/updateWork', async (data) => {
  const result = axios.post(`/client/update_work`, data)
    .then((res) => {
      const resData = res.data.data;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

export const deleteWork = createAsyncThunk('settings/deleteWork', async (id) => {
  const result = axios.post(`/client/delete_work`, id)
    .then((res) => {
      const resData = res.data.data;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

// education settings in edit details page
export const saveEducation = createAsyncThunk('settings/saveEducation', async (data) => {
  try {
    const res = await axios.post(`/client/save_education`, data);
    return res.data.data;
  } catch (err) {
    errorResponse(err);
    throw err; // Re-throw so the thunk properly rejects
  }
})

export const updateEducation = createAsyncThunk('settings/updateEducation', async (data) => {
  const result = axios.post(`/client/update_education`, data)
    .then((res) => {
      const resData = res.data.data;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

export const deleteEducation = createAsyncThunk('settings/deleteEducation', async (id) => {
  const result = axios.post(`/client/delete_education`, id)
    .then((res) => {
      const resData = res.data.data;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

// category settings in edit details page
export const saveCategory = createAsyncThunk('settings/saveCategory', async (data) => {
  const result = axios.post(`/client/save_category`, data)
    .then((res) => {
      const resData = res.data.data;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

export const updateCategory = createAsyncThunk('settings/updateCategory', async (data) => {
  const result = axios.post(`/client/update_category`, data)
    .then((res) => {
      const resData = res.data.data;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})

export const deleteCategory = createAsyncThunk('settings/deleteCategory', async (id) => {
  const result = axios.post(`/client/delete_category`, id)
    .then((res) => {
      const resData = res.data.data;
      return resData;
    })
    .catch((err) => {
      errorResponse(err);
    })
  return result;
})




export const settingsSlice = createSlice({
  name: "settings",
  initialState: {
    profileData: {},
    profileSettingData: initialProfileSettingsData,
    personalPosts: [],
    loading: false,
    followLoading: false,
    myFollowers: [],
    profile: {},
    totalFollowers: 0,
    userProfileData: {},
    userFollowers: [],
    userFollowing: [],
    followSuggestion: [],
    backgroundOptions: [],
    privacyDetailsModalOpen: false
  },
  reducers: {
    bindProfileData: (state, action) => {
      state.profileData = action.payload || {}
    },
    bindProfileSettingData: (state, action) => {
      state.profileSettingData = action.payload || initialProfileSettingsData
    },
    setPrivacyDetailsModal: (state, action) => {
      state.privacyDetailsModalOpen = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(getMyProfile.fulfilled, (state, action) => {
        state.profileData = action.payload.client;
        state.profileSettingData = action.payload.client;
        state.profile = action.payload;
        state.personalPosts = action.payload.post;
        state.loading = false;
      })
      .addCase(getMyProfile.pending, (state, action) => {
        state.loading = true;
      })
      .addCase(getMyProfile.rejected, (state, action) => {
        state.loading = false;
      })
      .addCase(getAllFollowers.fulfilled, (state, action) => {
        state.myFollowers = action.payload;
        state.loading = false;
        state.totalFollowers = action.payload.length;
      })
      .addCase(storeBsicInformation.pending, (state, action) => {
        state.loading = true;
      })
      .addCase(storeBsicInformation.fulfilled, (state, action) => {
        state.loading = false;
      })
      .addCase(getUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.userProfileData = action.payload;
      })
      .addCase(getUserProfileByUsername.fulfilled, (state, action) => {
        state.loading = false;
        state.userProfileData = action.payload;
      })
      .addCase(unFollowTo.fulfilled, (state, action) => {
        state.followLoading = false;
      })
      .addCase(unFollowTo.pending, (state, action) => {
        state.followLoading = true;
      })
      .addCase(unFollowTo.rejected, (state, action) => {
        state.followLoading = false;
      })
      .addCase(followTo.fulfilled, (state, action) => {
        state.followLoading = false;
      })
      .addCase(followTo.pending, (state, action) => {
        state.followLoading = true;
      })
      .addCase(followTo.rejected, (state, action) => {
        state.followLoading = false;
      })
      .addCase(getUserFollowers.fulfilled, (state, action) => {
        state.userFollowers = action.payload;
      })
      .addCase(getUserFollowing.fulfilled, (state, action) => {
        state.userFollowing = action.payload;
      })
      .addCase(getFollowSuggestions.fulfilled, (state, action) => {
        state.followSuggestion = action.payload;
      })
      .addCase(getPostBackgrounds.fulfilled, (state, action) => {
        state.backgroundOptions = action.payload;
      })

  },
});

export const { bindProfileData, bindProfileSettingData, setPrivacyDetailsModal } = settingsSlice.actions;

export default settingsSlice.reducer;
