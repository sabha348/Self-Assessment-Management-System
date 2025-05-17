import React, { useState, useEffect } from "react";
import axios from "axios";
import { TextField, Button, MenuItem, Box, Card, Typography } from "@mui/material";
import { TimePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";

const AddEntry = ({ onEntryAdded }) => {
  const navigate = useNavigate();
  const [day, setDay] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [error, setError] = useState(""); // New state for error handling
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

  // Token state
  const [token, setToken] = useState(localStorage.getItem("token"));

  useEffect(() => {
    if (!token) {
      navigate("/login"); // Redirect if not authenticated
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // Clear any previous errors

    // Form validation
    if (!day || !subjectName || !startTime || !endTime) {
      setError("Please fill in all fields");
      return;
    }

    // Validation: Ensure End Time is after Start Time
    if (dayjs(endTime).isBefore(startTime)) {
      setError("End time must be after start time");
      return;
    }

    try {
      await axios.post(
        `${API_URL}/timetable`,
        {
          day,
          subjectName,
          startTime: dayjs(startTime).format("HH:mm"),
          endTime: dayjs(endTime).format("HH:mm")
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Success handling
      alert("Entry added successfully!");
      resetForm();
      if (onEntryAdded) onEntryAdded();
      navigate("/timetable"); // Redirect to timetable after adding entry
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to add entry. Please try again.");
    }
  };

  const resetForm = () => {
    setDay("");
    setSubjectName("");
    setStartTime(null);
    setEndTime(null);
    setError("");
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <Card sx={{ 
          p: 4, 
          width: 400, 
          borderRadius: 2, 
          boxShadow: 5, 
          bgcolor: "#f9f9f9"
        }}>
          <Typography 
            variant="h5" 
            align="center" 
            sx={{ mb: 2, fontWeight: "bold", color: "#1976d2" }}
          >
            Add Timetable Entry
          </Typography>

          {/* Error Message Display */}
          {error && (
            <Typography 
              color="error" 
              sx={{ mb: 2, textAlign: "center" }}
            >
              {error}
            </Typography>
          )}

          <TextField
            select
            label="Day"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            required
            fullWidth
            sx={{ mb: 2 }}
          >
            {[
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday"
            ].map((d) => (
              <MenuItem key={d} value={d}>
                {d}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Subject Name"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            required
            fullWidth
            sx={{ mb: 2 }}
          />

          <TimePicker
            label="Start Time"
            value={startTime}
            onChange={(newTime) => setStartTime(newTime)}
            sx={{ mb: 2, width: "100%" }}
          />

          <TimePicker
            label="End Time"
            value={endTime}
            onChange={(newTime) => setEndTime(newTime)}
            sx={{ mb: 2, width: "100%" }}
          />
          
          {/* Navigation Buttons */}
          <Box sx={{ 
            display: "flex", 
            justifyContent: "space-between", 
            mt: 2 
          }}>
            <Button 
              variant="outlined" 
              color="secondary" 
              onClick={() => navigate("/timetable")}
            >
              Back to Timetable
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit}
              disabled={!day || !subjectName || !startTime || !endTime}
            >
              Add Entry
            </Button>
          </Box>
        </Card>
      </Box>
    </LocalizationProvider>
  );
};

export default AddEntry;