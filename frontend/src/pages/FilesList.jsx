import React, { useRef, useState, useEffect } from "react";
import { uploadFile } from "../services/fileService";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import { useNavigate, useLocation } from "react-router-dom";
import { User } from "lucide-react";
import "react-toastify/dist/ReactToastify.css";
import { jwtDecode } from "jwt-decode";
import Joyride from 'react-joyride';


// Import Material UI components
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Typography,
  Button,
  Box,
  Grid,
  Paper,
  IconButton,
  CircularProgress,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Breadcrumbs,
  Link,
} from "@mui/material";

// Import icons
import DeleteIcon from "@mui/icons-material/Delete";
import FileIcon from "@mui/icons-material/InsertDriveFile";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import SettingsIcon from "@mui/icons-material/Settings";
import TimeIcon from "@mui/icons-material/AccessTime";
import DateIcon from "@mui/icons-material/DateRange";
import FolderIcon from "@mui/icons-material/Folder";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const FilesList = () => {
  const location = useLocation();
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState(null);
  const [newName, setNewName] = useState("");
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [moveFileDialogOpen, setMoveFileDialogOpen] = useState(false);
  const [fileToMove, setFileToMove] = useState(null);
  const [folderPath, setFolderPath] = useState([]);
 const [runSettingsTour, setRunSettingsTour] = useState(false);
  const [settingsStep] = useState([
    {
      target: '.question-settings-button',
      content: 'Configure how questions are generated from your reading materials. Set number of questions, time limit',
      title: 'Question Settings',
      disableBeacon: true,
    }
  ]);

   // Check if user has seen this tour before
  useEffect(() => {
    if (currentUser) {
      const hasSeenTour = localStorage.getItem('hasSeenSettingsButtonTour');
      if (!hasSeenTour) {
        // Short delay to ensure button is rendered
        const timer = setTimeout(() => {
          setRunSettingsTour(true);
        }, 1000);
        
        // Set flag after showing tour once        
        return () => clearTimeout(timer);
      }
    }
  }, [currentUser]);

   // Joyride callback handler
  const handleJoyrideCallback = (data) => {
    const { status } = data;
    if (status === 'finished' || status === 'skipped') {
      setRunSettingsTour(false);
      localStorage.setItem('hasSeenSettingsButtonTour', 'true');
    }
  };

  // Get token from localStorage
  const token = localStorage.getItem("token");

  const handleUpload = () => {
    fileInputRef.current.click();
  };

  useEffect(() => {
    const fetchUser = async () => {
      // ... existing user fetch code ...
      try {
        setUserLoading(true);
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }

        // Decode token to get user ID
        const decoded = jwtDecode(token);
        const userId = decoded.userId;

        // Fetch the latest user data from backend
        const response = await axios.get(
          `${API_URL}/user/${userId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response) {
          throw new Error("Failed to fetch user data");
        }

        const userData = await response.data;
        setCurrentUser(userData || { membership: "free" }); // Ensure we have a default
      } catch (error) {
        console.error("Fetching user error:", error);
        // Set a default user with free membership if there's an error
        setCurrentUser({ membership: "free" });
      } finally {
        setUserLoading(false);
      }
    };

    fetchUser();
  }, [location.pathname, navigate]);

  // Question generation configuration state
  const [questionConfig, setQuestionConfig] = useState(() => {
    // ... existing question config code ...
    const savedConfig = localStorage.getItem("questionConfigPrefs");
    return savedConfig
      ? JSON.parse(savedConfig)
      : {
          numQuestions: 5,
          difficulty: "medium",
          questionTypes: ["open-ended"],
          timeLimit: 0, // 0 means no time limit
        };
  });

  useEffect(() => {
    const fetchFoldersAndFiles = async () => {
      try {
        setLoading(true);

        // Fetch ALL folders (regardless of current folder)
        const foldersResponse = await axios.get(
          `${API_URL}/folders`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setFolders(foldersResponse.data);

        // Fetch ALL files (we'll filter them in the UI)
        const filesResponse = await axios.get(
          `${API_URL}/files`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setFiles(filesResponse.data);
      } catch (error) {
        console.error("Error:", error);
        setError(
          error.response?.data?.message || "Failed to fetch files and folders"
        );
        toast.error("Failed to fetch files and folders");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchFoldersAndFiles();
    } else {
      navigate("/login");
    }
  }, [token, navigate]);

  // Save config when it changes
  useEffect(() => {
    localStorage.setItem("questionConfigPrefs", JSON.stringify(questionConfig));
  }, [questionConfig]);

  const openFile = async (fileId) => {
    try {
      const response = await axios.get(
        `${API_URL}/files/${fileId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      navigate("/pdf-viewer", {
        state: {
          pdfData: `data:application/pdf;base64,${response.data.content}`,
          title: response.data.title,
          // Pass question configuration settings
          questionConfig: questionConfig,
        },
      });
    } catch (error) {
      console.error("Error opening file:", error);
      toast.error("Failed to open file");
    }
  };

  const deleteFile = async (id) => {
    // ... existing deleteFile code ...
    if (window.confirm("Are you sure you want to delete this file?")) {
      try {
        await axios.delete(`${API_URL}/files/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFiles(files.filter((file) => file._id !== id));
        toast.success("File deleted successfully");
      } catch (error) {
        console.error("Delete error:", error);
        toast.error("Failed to delete file");
      }
    }
  };

  const deleteFolder = async (id) => {
    if (
      window.confirm(
        "Are you sure you want to delete this folder and all its contents?"
      )
    ) {
      try {
        await axios.delete(`${API_URL}/folders/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFolders(folders.filter((folder) => folder._id !== id));
        toast.success("Folder deleted successfully");
      } catch (error) {
        console.error("Delete folder error:", error);
        toast.error("Failed to delete folder");
      }
    }
  };

  const handleOpenFolder = (folderId) => {
    // Find the folder
    const folder = folders.find((f) => f._id === folderId);
    if (folder) {
      setCurrentFolder(folderId);
      // Update the path
      setFolderPath((prev) => [
        ...prev,
        {
          id: folderId,
          name: folder.name,
        },
      ]);
    }
  };

  const handleBackToRoot = () => {
    setCurrentFolder(null);
  };

  const navigateToPathPoint = (index) => {
    if (index === -1) {
      // Back to root
      handleBackToRoot();
    } else {
      // To specific folder in path
      const pathPoint = folderPath[index];
      setCurrentFolder(pathPoint.id);
      setFolderPath(folderPath.slice(0, index + 1));
    }
  };

  const handleOpenRenameDialog = (item, type) => {
    setItemToRename({ ...item, type });
    setNewName(item.title || item.name);
    setRenameDialogOpen(true);
  };

  const handleRename = async () => {
    try {
      if (itemToRename.type === "file") {
        await axios.put(
          `${API_URL}/files/${itemToRename._id}/rename`,
          { newName: newName },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setFiles(
          files.map((file) =>
            file._id === itemToRename._id ? { ...file, title: newName } : file
          )
        );
      } else {
        await axios.put(
          `${API_URL}/folders/${itemToRename._id}/rename`,
          { newName: newName },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setFolders(
          folders.map((folder) =>
            folder._id === itemToRename._id
              ? { ...folder, name: newName }
              : folder
          )
        );
      }

      toast.success("Renamed successfully");
      setRenameDialogOpen(false);
    } catch (error) {
      console.error("Rename error:", error);
      toast.error("Failed to rename");
    }
  };

  const handleCreateFolder = async () => {
    try {
      // Use the current folder as the parent ID
      const response = await axios.post(
        `${API_URL}/folders`,
        {
          name: newFolderName,
          parentId: currentFolder,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Refresh all folders to ensure we have the latest data
      const foldersResponse = await axios.get(
        `${API_URL}/folders`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setFolders(foldersResponse.data);

      setNewFolderDialogOpen(false);
      setNewFolderName("");

      // If this was created during the upload flow, select it and continue
      if (folderDialogOpen && uploadedFile) {
        setSelectedFolder(response.data._id);
        handleMoveFileToFolder(uploadedFile._id, response.data._id);
      }

      toast.success("Folder created successfully");
    } catch (error) {
      console.error("Create folder error:", error);
      toast.error("Failed to create folder");
    }
  };
  const handleMoveFileToFolder = async (fileId, folderId) => {
    try {
      await axios.put(
        `${API_URL}/files/${fileId}/move`,
        { folderId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Close dialogs if open
      setFolderDialogOpen(false);
      setMoveFileDialogOpen(false);
      setUploadedFile(null);
      setFileToMove(null);

      // Instead of just updating the state, fetch all files again
      // This ensures we have fresh data from the server
      const filesResponse = await axios.get(`${API_URL}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFiles(filesResponse.data);

      toast.success("File moved successfully");
    } catch (error) {
      console.error("Move file error:", error);
      toast.error("Failed to move file");
    }
  };

  const handleOpenMoveDialog = (file) => {
    setFileToMove(file);
    setSelectedFolder(file.folderId || null);
    setMoveFileDialogOpen(true);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleSaveConfig = () => {
    // Save to localStorage
    localStorage.setItem("questionConfigPrefs", JSON.stringify(questionConfig));

    // Save to backend for user preferences (optional)
    const saveToBackend = async () => {
      try {
        await axios.post(
          `${API_URL}/user/preferences`,
          { questionConfig },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Question generation settings saved!");
      } catch (error) {
        console.error("Failed to save preferences:", error);
      }
    };

    saveToBackend();
    setConfigDialogOpen(false);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check file size (50MB limit)
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

      if (file.size > MAX_FILE_SIZE) {
        toast.error("File size exceeds 50MB limit");
        return;
      }

      let loadingToast;
      try {
        // Show loading toast
        loadingToast = toast.loading("Uploading file...");

        const response = await uploadFile(file);

        // Dismiss loading toast and show success
        toast.dismiss(loadingToast);
        toast.success("File uploaded successfully");

        // Store the uploaded file and open folder selection dialog
        setUploadedFile(response);
        setSelectedFolder(null); // Explicitly set to null (root) initially
        setFolderDialogOpen(true);
      } catch (error) {
        toast.dismiss(loadingToast);
        toast.error(
          "Failed to upload file: " + (error.message || "Unknown error")
        );
      }
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 flex justify-center items-center">
        <div className="text-xl font-semibold text-gray-600">
          Loading files...
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Render loading user data state
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 flex justify-center items-center">
        <div className="text-xl font-semibold text-gray-600">
          Loading user data...
        </div>
      </div>
    );
  }

  // Get current folder name for breadcrumb
  const currentFolderName = currentFolder
    ? folders.find((folder) => folder._id === currentFolder)?.name ||
      "Unknown Folder"
    : null;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      {/* Joyride component focusing only on settings button */}
      <Joyride
        steps={settingsStep}
        run={runSettingsTour}
        continuous={true}
        showProgress={true}
        showSkipButton={true}
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: '#3b82f6',
            zIndex: 10000,
          }
        }}
      />
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf"
      />

      <ToastContainer position="top-right" autoClose={3000} />

      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="px-3 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 flex items-center gap-1 transition"
            >
              <span>←</span> Back
            </button>
            <h1 className="text-2xl font-bold">My Documents</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setNewFolderDialogOpen(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <CreateNewFolderIcon fontSize="small" /> New Folder
            </button>
            <button
              onClick={handleUpload}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Upload New
            </button>
            <button
              onClick={() => setConfigDialogOpen(true)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 flex items-center gap-2 transition question-settings-button"
            >
              <SettingsIcon fontSize="small" />
              Question Settings
            </button>
          </div>
        </div>

        {/* Breadcrumb navigation */}
        {currentFolder && (
          <div className="mb-4">
            <Breadcrumbs aria-label="breadcrumb">
              <Link
                component="button"
                underline="hover"
                color="inherit"
                onClick={() => navigateToPathPoint(-1)}
              >
                All Documents
              </Link>

              {folderPath.map((path, index) =>
                index === folderPath.length - 1 ? (
                  <Typography key={path.id} color="text.primary">
                    {path.name}
                  </Typography>
                ) : (
                  <Link
                    key={path.id}
                    component="button"
                    underline="hover"
                    color="inherit"
                    onClick={() => navigateToPathPoint(index)}
                  >
                    {path.name}
                  </Link>
                )
              )}
            </Breadcrumbs>
          </div>
        )}

        {/* Folder navigation button if in a folder */}
        {currentFolder && (
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleBackToRoot}
            sx={{ mb: 2 }}
          >
            Back to All Documents
          </Button>
        )}

        {!currentFolder && folders.length === 0 && files.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-10 text-center">
            <div className="text-5xl text-gray-300 mb-4 flex justify-center">
              <FileIcon style={{ fontSize: "5rem" }} />
            </div>
            <h2 className="text-xl font-semibold text-gray-600 mb-2">
              No files or folders yet
            </h2>
            <p className="text-gray-500 mb-6">
              Upload a PDF document or create folders to organize your content
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setNewFolderDialogOpen(true)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Create Folder
              </button>
              <button
                onClick={handleUpload}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Upload Document
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Folders section */}
            {folders.filter((folder) => folder.parentId === currentFolder)
              .length > 0 && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-3">Folders</h2>
                <Grid container spacing={3}>
                  {folders
                    .filter((folder) => folder.parentId === currentFolder)
                    .map((folder) => (
                      <Grid item xs={12} sm={6} md={4} key={folder._id}>
                        <Paper
                          elevation={2}
                          className="hover:shadow-md transition-shadow"
                          sx={{ borderRadius: 2, overflow: "hidden" }}
                        >
                          <div
                            className="h-40 bg-gray-50 flex items-center justify-center cursor-pointer"
                            onClick={() => handleOpenFolder(folder._id)}
                          >
                            <FolderIcon
                              sx={{ fontSize: 60, color: "#f6ad55" }}
                            />
                          </div>

                          <Box p={2}>
                            <div className="flex justify-between items-start">
                              <Typography
                                variant="h6"
                                sx={{ fontWeight: 600, mb: 1, maxWidth: "80%" }}
                                className="truncate"
                                onClick={() => handleOpenFolder(folder._id)}
                                style={{ cursor: "pointer" }}
                              >
                                {folder.name || "Untitled Folder"}
                              </Typography>
                              <div className="flex">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenRenameDialog(folder, "folder");
                                  }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteFolder(folder._id);
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </div>
                            </div>

                            <div className="text-xs text-gray-500 flex items-center mt-2">
                              <DateIcon
                                fontSize="small"
                                sx={{ mr: 0.5, fontSize: 16 }}
                              />
                              Created {formatDate(folder.createdAt)}
                            </div>

                            <div className="mt-4 flex justify-end">
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => handleOpenFolder(folder._id)}
                                sx={{
                                  borderRadius: "8px",
                                  fontSize: "0.75rem",
                                  textTransform: "none",
                                }}
                              >
                                Open Folder
                              </Button>
                            </div>
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                </Grid>
              </div>
            )}

            {/* Files section */}
            {files.filter((file) => file.folderId === currentFolder).length >
              0 && (
              <div>
                <h2 className="text-xl font-semibold mb-3">Files</h2>
                <Grid container spacing={3}>
                  {files
                    .filter((file) =>
                      // If in a folder, show only files in this folder
                      // If at root, show only files without a folder
                      currentFolder
                        ? file.folderId === currentFolder
                        : !file.folderId
                    )
                    .map((file) => (
                      <Grid item xs={12} sm={6} md={4} key={file._id}>
                        <Paper
                          elevation={2}
                          className="hover:shadow-md transition-shadow"
                          sx={{ borderRadius: 2, overflow: "hidden" }}
                        >
                          <div
                            className="h-40 bg-gray-100 flex items-center justify-center cursor-pointer"
                            onClick={() => openFile(file._id)}
                          >
                            <PictureAsPdfIcon
                              sx={{ fontSize: 60, color: "#e53e3e" }}
                            />
                          </div>

                          <Box p={2}>
                            <div className="flex justify-between items-start">
                              <Typography
                                variant="h6"
                                sx={{ fontWeight: 600, mb: 1, maxWidth: "80%" }}
                                className="truncate"
                              >
                                {file.title || "Untitled Document"}
                              </Typography>
                              <div className="flex">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenRenameDialog(file, "file");
                                  }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenMoveDialog(file);
                                  }}
                                >
                                  <DriveFileMoveIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteFile(file._id);
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </div>
                            </div>

                            <div className="text-xs text-gray-500 flex items-center mt-2">
                              <DateIcon
                                fontSize="small"
                                sx={{ mr: 0.5, fontSize: 16 }}
                              />
                              Uploaded {formatDate(file.createdAt)}
                            </div>

                            <div className="mt-4 flex justify-end">
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => openFile(file._id)}
                                sx={{
                                  borderRadius: "8px",
                                  fontSize: "0.75rem",
                                  textTransform: "none",
                                }}
                              >
                                Open Document
                              </Button>
                            </div>
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                </Grid>
              </div>
            )}
          </>
        )}
      </div>

      {/* Question Configuration Dialog */}
      <Dialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            Question Generation Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure default settings for all question generation
          </Typography>
        </DialogTitle>

        {userLoading ? (
          <DialogContent dividers>
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress />
            </Box>
          </DialogContent>
        ) : (
          <DialogContent dividers>
            {/* Number of Questions */}
            <FormControl fullWidth margin="normal">
              <InputLabel>Number of Questions</InputLabel>
              <Select
                value={questionConfig.numQuestions}
                onChange={(e) =>
                  setQuestionConfig({
                    ...questionConfig,
                    numQuestions: e.target.value,
                  })
                }
                // disabled={currentUser.membership === "free"} // Disable selection for free users
              >
                <MenuItem value={3}>3 questions</MenuItem>
                <MenuItem value={5}>5 questions</MenuItem>
                <MenuItem value={8}>8 questions</MenuItem>
                <MenuItem value={10}>10 questions</MenuItem>
              </Select>
            </FormControl>

            {/* Difficulty Selection */}
            {/* <FormControl fullWidth margin="normal">
              <InputLabel>Difficulty</InputLabel>
              <Select
                value={
                  currentUser.membership === "free"
                    ? "medium"
                    : questionConfig.difficulty
                }
                onChange={(e) =>
                  setQuestionConfig({
                    ...questionConfig,
                    difficulty: e.target.value,
                  })
                }
                // disabled={currentUser.membership === "free"} // Restrict free users
              >
                <MenuItem value="easy">Easy</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="hard">Hard</MenuItem>
                <MenuItem value="mixed">Mixed</MenuItem>
              </Select>
            </FormControl> */}

            {/* Time Limit */}
            <FormControl fullWidth margin="normal">
              <InputLabel>Time Limit</InputLabel>
              <Select
                value={questionConfig.timeLimit}
                onChange={(e) =>
                  setQuestionConfig({
                    ...questionConfig,
                    timeLimit: e.target.value,
                  })
                }
              >
                <MenuItem value={0}>No time limit</MenuItem>
                <MenuItem value={1}>1 minute</MenuItem>
                <MenuItem value={5}>5 minutes</MenuItem>
                <MenuItem value={10}>10 minutes</MenuItem>
                <MenuItem value={15}>15 minutes</MenuItem>
                <MenuItem value={30}>30 minutes</MenuItem>
              </Select>
            </FormControl>

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
  Question Type
</Typography>

<Box sx={{ pl: 1 }}>
  <Typography variant="body1">
    Open Ended
  </Typography>
  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
    Additional question types (multiple choice, true/false, etc.) will be available in future updates.
  </Typography>
</Box>
          </DialogContent>
        )}

        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleSaveConfig}
            variant="contained"
            color="primary"
          >
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>

      {/* Folder Selection Dialog */}
      <Dialog
        open={folderDialogOpen}
        onClose={() => {
          // If user closes without selecting a folder, file will remain at root
          setFolderDialogOpen(false);
          setUploadedFile(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            Choose Folder for {uploadedFile?.title || "Uploaded File"}
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Select a folder to store your document or create a new one:
          </Typography>

          <List>
            <ListItem
              button
              selected={selectedFolder === null}
              onClick={() => setSelectedFolder(null)}
              sx={{
                bgcolor:
                  selectedFolder === null
                    ? "rgba(25, 118, 210, 0.08)"
                    : "transparent",
                "&:hover": {
                  bgcolor:
                    selectedFolder === null
                      ? "rgba(25, 118, 210, 0.12)"
                      : "rgba(0, 0, 0, 0.04)",
                },
              }}
            >
              <ListItemIcon>
                <FolderIcon />
              </ListItemIcon>
              <ListItemText primary="Root (No Folder)" />
            </ListItem>

            {folders.map((folder) => (
              <ListItem
                button
                key={folder._id}
                selected={selectedFolder === folder._id}
                onClick={() => setSelectedFolder(folder._id)}
                sx={{
                  bgcolor:
                    selectedFolder === folder._id
                      ? "rgba(25, 118, 210, 0.08)"
                      : "transparent",
                  "&:hover": {
                    bgcolor:
                      selectedFolder === folder._id
                        ? "rgba(25, 118, 210, 0.12)"
                        : "rgba(0, 0, 0, 0.04)",
                  },
                }}
              >
                <ListItemIcon>
                  <FolderIcon />
                </ListItemIcon>
                <ListItemText primary={folder.name} />
              </ListItem>
            ))}
          </List>

          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              setFolderDialogOpen(false);
              setNewFolderName("");
              setNewFolderDialogOpen(true);
            }}
            startIcon={<CreateNewFolderIcon />}
            fullWidth
            sx={{ mt: 2 }}
          >
            Create New Folder
          </Button>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => {
              setFolderDialogOpen(false);
              setUploadedFile(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              if (uploadedFile) {
                handleMoveFileToFolder(uploadedFile._id, selectedFolder);
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog
        open={newFolderDialogOpen}
        onClose={() => {
          setNewFolderDialogOpen(false);
          setNewFolderName("");
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            Create New Folder
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          <TextField
            autoFocus
            margin="dense"
            id="folderName"
            label="Folder Name"
            type="text"
            fullWidth
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
          />
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => {
              setNewFolderDialogOpen(false);
              setNewFolderName("");
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateFolder}
            disabled={!newFolderName.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog
        open={renameDialogOpen}
        onClose={() => setRenameDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            Rename {itemToRename?.type === "folder" ? "Folder" : "File"}
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          <TextField
            autoFocus
            margin="dense"
            id="newName"
            label="New Name"
            type="text"
            fullWidth
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleRename}
            disabled={!newName.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move File Dialog */}
      <Dialog
        open={moveFileDialogOpen}
        onClose={() => {
          setMoveFileDialogOpen(false);
          setFileToMove(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            Move {fileToMove?.title || "File"} to Folder
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Select a destination folder:
          </Typography>

          <List>
            <ListItem
              button
              selected={selectedFolder === null}
              onClick={() => setSelectedFolder(null)}
              sx={{
                bgcolor:
                  selectedFolder === null
                    ? "rgba(25, 118, 210, 0.08)"
                    : "transparent",
                "&:hover": {
                  bgcolor:
                    selectedFolder === null
                      ? "rgba(25, 118, 210, 0.12)"
                      : "rgba(0, 0, 0, 0.04)",
                },
              }}
            >
              <ListItemIcon>
                <FolderIcon />
              </ListItemIcon>
              <ListItemText primary="Root (No Folder)" />
            </ListItem>

            {folders.map((folder) => (
              <ListItem
                button
                key={folder._id}
                selected={selectedFolder === folder._id}
                onClick={() => setSelectedFolder(folder._id)}
                sx={{
                  bgcolor:
                    selectedFolder === folder._id
                      ? "rgba(25, 118, 210, 0.08)"
                      : "transparent",
                  "&:hover": {
                    bgcolor:
                      selectedFolder === folder._id
                        ? "rgba(25, 118, 210, 0.12)"
                        : "rgba(0, 0, 0, 0.04)",
                  },
                }}
              >
                <ListItemIcon>
                  <FolderIcon />
                </ListItemIcon>
                <ListItemText primary={folder.name} />
              </ListItem>
            ))}
          </List>

          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              setMoveFileDialogOpen(false);
              setNewFolderName("");
              setNewFolderDialogOpen(true);
            }}
            startIcon={<CreateNewFolderIcon />}
            fullWidth
            sx={{ mt: 2 }}
          >
            Create New Folder
          </Button>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => {
              setMoveFileDialogOpen(false);
              setFileToMove(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              if (fileToMove) {
                handleMoveFileToFolder(fileToMove._id, selectedFolder);
                setMoveFileDialogOpen(false);
                setFileToMove(null);
              }
            }}
          >
            Move
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default FilesList;
