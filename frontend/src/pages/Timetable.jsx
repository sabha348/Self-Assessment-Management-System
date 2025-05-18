import React, { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import { useNavigate,useLocation } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Typography,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
  Box,
} from "@mui/material";
import { TimePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';


const Timetable = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [timetable, setTimetable] = useState({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState({
    id: "",
    subjectName: "",
    startTime: null,
    endTime: null,
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

   useEffect(() => {
      const fetchUser = async () => {
        try {
          const token = localStorage.getItem("token");
          if (!token) {
            navigate("/login");
            return;
          }
  
          
          // Decode token to get user ID
          const decoded = jwtDecode(token);
          const userId = decoded.userId;
  
          // Fetch the latest user data from backend
          const response = await axios.get(`${API_URL}/user/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
  
  
          if (!response) {
            throw new Error("Failed to fetch user data");
          }
  
          const userData = await response.data;
          console.log(userData);
          setCurrentUser(userData); // Update state with fresh data
          // if(userData.membership !== "premium") {
            // navigate("/dashboard");
          // }

        } catch (error) {
          console.error("Fetching user error:", error);
        }
      };
  
      fetchUser();
    }, [location.pathname]);

  // Fetch timetable
  const fetchTimetable = async () => {
    setLoading(true);
    
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      const res = await axios.get(`${API_URL}/timetable`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Group entries by day
      const groupedTimetable = res.data.reduce((acc, entry) => {
        if (!acc[entry.day]) {
          acc[entry.day] = [];
        }
        acc[entry.day].push({
          id: entry._id,
          subjectName: entry.subjectName,
          startTime: entry.startTime,
          endTime: entry.endTime,
          isFinished: entry.isFinished,
        });
        return acc;
      }, {});

      setTimetable(groupedTimetable);
    } catch (err) {
      setError("Failed to load timetable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, []);

  // Handle edit
  const handleEditClick = (entry) => {
    setEditData({
      id: entry.id,
      subjectName: entry.subjectName,
      startTime: dayjs(`2024-01-01T${entry.startTime}`),
      endTime: dayjs(`2024-01-01T${entry.endTime}`),
    });
    setEditDialogOpen(true);
  };

  const handleEditChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleEditSubmit = async () => {
    try {
      const token = localStorage.getItem("token");
      const updateData = {
        subjectName: editData.subjectName,
        startTime: editData.startTime.format("HH:mm"),
        endTime: editData.endTime.format("HH:mm"),
      };

      await axios.put(
        `${API_URL}/timetable/${editData.id}`,
        updateData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setEditDialogOpen(false);
      setSuccessMessage("Subject updated successfully!");
      fetchTimetable(); // Refresh the timetable data
    } catch (err) {
      setError("Failed to update subject.");
    }
  };

  const handleDeleteEntry = async (id) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_URL}/timetable/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setSuccessMessage("Entry deleted successfully!");
      fetchTimetable(); // Refresh the timetable data
    } catch (err) {
      setError("Failed to delete entry.");
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ padding: "20px", maxWidth: "900px", margin: "auto", bgcolor: "white" }}>
        <Typography variant="h4" align="center" gutterBottom>
          Weekly Timetable
        </Typography>

        {/* Buttons Container */}
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => navigate("/dashboard")}
          >
            Go to Dashboard
          </Button>

          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => navigate("/entry")}
          >
            Add Entry
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ boxShadow: 3, borderRadius: 2, bgcolor: "#f9f9f9" }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: "#e0e0e0" }}>
                  <TableCell sx={{ fontWeight: "bold" }}>Day</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Subject</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Time</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) =>
                  timetable[day] && timetable[day].length > 0 ? (
                    timetable[day].map((entry, index) => (
                      <TableRow key={entry.id} sx={{ bgcolor: "white" }}>
                        <TableCell>{index === 0 ? <strong>{day}</strong> : ""}</TableCell>
                        <TableCell>{entry.subjectName}</TableCell>
                        <TableCell>
                          {entry.startTime} - {entry.endTime}
                        </TableCell>
                        <TableCell align="center">
                          <Button 
                            variant="contained" 
                            color="primary" 
                            size="small" 
                            sx={{ mr: 1 }}
                            onClick={() => handleEditClick(entry)}
                          >
                            Edit
                          </Button>
                          <Button 
                            variant="contained" 
                            color="error" 
                            size="small"
                            onClick={() => handleDeleteEntry(entry.id)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow key={day} sx={{ bgcolor: "white" }}>
                      <TableCell><strong>{day}</strong></TableCell>
                      <TableCell colSpan={3} align="center">
                        No classes scheduled
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Edit Dialog */}
        <Dialog 
          open={editDialogOpen} 
          onClose={() => setEditDialogOpen(false)}
          PaperProps={{ sx: { p: 2 } }}
        >
          <DialogTitle>Edit Subject</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              margin="dense"
              label="Subject Name"
              value={editData.subjectName}
              onChange={(e) => handleEditChange("subjectName", e.target.value)}
            />
            <TimePicker
              label="Start Time"
              value={editData.startTime}
              onChange={(newTime) => handleEditChange("startTime", newTime)}
              sx={{ mt: 2, width: "100%" }}
            />
            <TimePicker
              label="End Time"
              value={editData.endTime}
              onChange={(newTime) => handleEditChange("endTime", newTime)}
              sx={{ mt: 2, width: "100%" }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)} color="secondary">
              Cancel
            </Button>
            <Button 
              onClick={handleEditSubmit} 
              color="primary"
              disabled={!editData.subjectName || !editData.startTime || !editData.endTime}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Timetable;