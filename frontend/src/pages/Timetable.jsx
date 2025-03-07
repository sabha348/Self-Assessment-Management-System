// import React, { useEffect, useState } from "react";
// import axios from "axios";
// import { useNavigate } from "react-router-dom";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableContainer,
//   TableHead,
//   TableRow,
//   Paper,
//   Button,
//   Typography,
//   TextField,
//   Dialog,
//   DialogActions,
//   DialogContent,
//   DialogTitle,
//   Snackbar,
//   Alert,
//   CircularProgress,
// } from "@mui/material";

// const Timetable = () => {
//   const navigate = useNavigate();
//   const [timetable, setTimetable] = useState({});
//   const [editDialogOpen, setEditDialogOpen] = useState(false);
//   const [editData, setEditData] = useState({ day: "", subjectId: "", subjectName: "", startTime: "", endTime: "" });
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);
//   const [successMessage, setSuccessMessage] = useState("");

//   // Fetch timetable
//   const fetchTimetable = async () => {
//     setLoading(true);
    
//     try {
//       const token = localStorage.getItem("token");
//       if (!token) {
//         navigate("/login"); // Redirect to login if no token is found
//         return;
//       }
//       const res = await axios.get("http://localhost:8000/api/timetable", {
//         headers: { Authorization: `Bearer ${token}` },
//       });
      

//       const groupedTimetable = res.data.reduce((acc, entry) => {
//         if (!acc[entry.day]) {
//           acc[entry.day] = [];
//         }
//         acc[entry.day].push(...entry.subjects);
//         return acc;
//       }, {});

//       setTimetable(groupedTimetable);
//     } catch (err) {
//       setError("Failed to load timetable.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchTimetable();
//   }, []);

//   // Handle edit
//   const handleEditClick = (day, subject) => {
//     setEditData({ day, subjectId: subject._id, subjectName: subject.subjectName, startTime: subject.startTime, endTime: subject.endTime });
//     setEditDialogOpen(true);
//   };

//   const handleEditChange = (e) => {
//     setEditData({ ...editData, [e.target.name]: e.target.value });
//   };

//   const handleEditSubmit = async () => {
//     try {
//       const token = localStorage.getItem("token");
//       await axios.put(
//         "http://localhost:8000/api/timetable/update-subject",
//         { day: editData.day, subjectId: editData.subjectId, updatedSubject: { subjectName: editData.subjectName, startTime: editData.startTime, endTime: editData.endTime } },
//         { headers: { Authorization: `Bearer ${token}` } }
//       );
//       setEditDialogOpen(false);
//       setSuccessMessage("Subject updated successfully!");
//       setTimetable((prev) => ({
//         ...prev,
//         [editData.day]: prev[editData.day].map((sub) =>
//           sub._id === editData.subjectId ? { ...sub, ...editData } : sub
//         ),
//       }));
//     } catch (err) {
//       setError("Failed to update subject.");
//     }
//   };

//   const handleDeleteSubject = async (day, subjectId) => {
//     try {
//       const token = localStorage.getItem("token");
//       await axios.delete("http://localhost:8000/api/timetable/delete-subject", {
//         headers: { Authorization: `Bearer ${token}` },
//         data: { day, subjectId },
//       });
//       setSuccessMessage("Subject deleted successfully!");
//       setTimetable((prev) => ({
//         ...prev,
//         [day]: prev[day].filter((subject) => subject._id !== subjectId),
//       }));
//     } catch (err) {
//       setError("Failed to delete subject.");
//     }
//   };

//   return (
//     <div style={{ padding: "20px", maxWidth: "900px", margin: "auto", backgroundColor: "white", color: "black" }}>
//       <Typography variant="h4" align="center" gutterBottom>
//         Weekly Timetable
//       </Typography>

//       {/* Buttons Container */}
//       <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
//         {/* Dashboard Button */}
//         <Button variant="contained" color="success" onClick={() => navigate("/dashboard")}>
//           Go to Dashboard
//         </Button>

//         {/* Add Entry Button */}
//         <Button variant="contained" color="success" onClick={() => navigate("/entry")}>
//           Add Entry
//         </Button>
//       </div>

//       {loading ? (
//         <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
//           <CircularProgress />
//         </div>
//       ) : (
//         <TableContainer component={Paper} sx={{ boxShadow: 3, borderRadius: 2, backgroundColor: "#f9f9f9" }}>
//           <Table>
//             <TableHead>
//               <TableRow sx={{ bgcolor: "#e0e0e0" }}>
//                 <TableCell sx={{ color: "black", fontWeight: "bold" }}>Day</TableCell>
//                 <TableCell sx={{ color: "black", fontWeight: "bold" }}>Subject</TableCell>
//                 <TableCell sx={{ color: "black", fontWeight: "bold" }}>Time</TableCell>
//                 <TableCell sx={{ color: "black", fontWeight: "bold" }} align="center">
//                   Actions
//                 </TableCell>
//               </TableRow>
//             </TableHead>
//             <TableBody>
//               {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) =>
//                 timetable[day] && timetable[day].length > 0 ? (
//                   timetable[day].map((subject, index) => (
//                     <TableRow key={`${day}-${index}`} sx={{ backgroundColor: "#ffffff" }}>
//                       <TableCell>{index === 0 ? <strong>{day}</strong> : ""}</TableCell>
//                       <TableCell>{subject.subjectName}</TableCell>
//                       <TableCell>
//                         {subject.startTime} - {subject.endTime}
//                       </TableCell>
//                       <TableCell align="center">
//                         <Button variant="contained" color="primary" size="small" sx={{ marginRight: 1 }} onClick={() => handleEditClick(day, subject)}>
//                           Edit
//                         </Button>
//                         <Button variant="contained" color="error" size="small" onClick={() => handleDeleteSubject(day, subject._id)}>
//                           Delete
//                         </Button>
//                       </TableCell>
//                     </TableRow>
//                   ))
//                 ) : (
//                   <TableRow key={day} sx={{ backgroundColor: "#ffffff" }}>
//                     <TableCell>
//                       <strong>{day}</strong>
//                     </TableCell>
//                     <TableCell colSpan={3} align="center">
//                       No classes scheduled
//                     </TableCell>
//                   </TableRow>
//                 )
//               )}
//             </TableBody>
//           </Table>
//         </TableContainer>
//       )}

//       {/* Edit Modal */}
//       <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
//         <DialogTitle>Edit Subject</DialogTitle>
//         <DialogContent>
//           <TextField fullWidth margin="dense" label="Subject Name" name="subjectName" value={editData.subjectName} onChange={handleEditChange} />
//           <TextField fullWidth margin="dense" type="time" label="Start Time" name="startTime" value={editData.startTime} onChange={handleEditChange} />
//           <TextField fullWidth margin="dense" type="time" label="End Time" name="endTime" value={editData.endTime} onChange={handleEditChange} />
//         </DialogContent>
//         <DialogActions>
//           <Button onClick={() => setEditDialogOpen(false)} color="secondary">
//             Cancel
//           </Button>
//           <Button onClick={handleEditSubmit} color="primary">
//             Save
//           </Button>
//         </DialogActions>
//       </Dialog>
//     </div>
//   );
// };

// export default Timetable;

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
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

const Timetable = () => {
  const navigate = useNavigate();
  const [timetable, setTimetable] = useState({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState({
    id: "",
    subjectName: "",
    startTime: null,
    endTime: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch timetable
  const fetchTimetable = async () => {
    setLoading(true);
    
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      const res = await axios.get("http://localhost:8000/api/timetable", {
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
        `http://localhost:8000/api/timetable/${editData.id}`,
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
      await axios.delete(`http://localhost:8000/api/timetable/${id}`, {
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