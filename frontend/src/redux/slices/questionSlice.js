// src/redux/slices/questionSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  questions: [],
  loading: false,
  error: null
};

const questionSlice = createSlice({
  name: 'questions',
  initialState,
  reducers: {
    // Add reducers here
  }
});

export default questionSlice.reducer;