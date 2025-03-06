import axios from "axios";

const API_URL = "http://localhost:8000/api/timetable";

// Get all timetable entries
export const getTimetable = async (token) => {
  try {
    const response = await axios.get(API_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching timetable:", error);
    throw error;
  }
};

// Create a timetable entry
export const createTimetableEntry = async (data, token) => {
  try {
    const response = await axios.post(API_URL, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error creating timetable entry:", error);
    throw error;
  }
};

// Update timetable entry
export const updateTimetableEntry = async (data, token) => {
  try {
    const response = await axios.put(API_URL, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error updating timetable entry:", error);
    throw error;
  }
};

// Update a specific subject in the timetable
export const updateSubject = async (data, token) => {
  try {
    const response = await axios.put(`${API_URL}/update-subject`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error updating subject:", error);
    throw error;
  }
};

// Delete a subject
export const deleteSubject = async (data, token) => {
  try {
    const response = await axios.put(`${API_URL}/delete-subject`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error deleting subject:", error);
    throw error;
  }
};
