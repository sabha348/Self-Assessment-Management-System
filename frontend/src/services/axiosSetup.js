import axios from 'axios';
import { reportError } from './errorReportingService';

// Add a response interceptor for global error handling
axios.interceptors.response.use(
  response => response,
  error => {
    // Only report server errors (500+) or specific API errors you want to track
    if (!error.response || error.response.status >= 500) {
      reportError(error, 'AxiosRequest');
    }
    return Promise.reject(error);
  }
);