// src/redux/slices/analyticsSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  analytics: null,
  loading: false,
  error: null
};

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    // Add reducers here
  }
});

export default analyticsSlice.reducer;