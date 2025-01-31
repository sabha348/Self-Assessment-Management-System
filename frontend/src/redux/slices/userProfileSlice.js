// src/redux/slices/userProfileSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  profile: null,
  loading: false,
  error: null
};

const userProfileSlice = createSlice({
  name: 'userProfile',
  initialState,
  reducers: {
    // Add reducers here
  }
});

export default userProfileSlice.reducer;