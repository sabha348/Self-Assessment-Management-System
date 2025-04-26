import React, { useRef, useState, useEffect, useContext  } from 'react';
import { Book, Brain, Calculator, Layers, PenTool, Folder, Plus, Home, CreditCard, FolderArchive, FolderCheck, Clock, Calendar, CalendarCheck,LucideUserRoundCog } from 'lucide-react';
import { uploadFile } from '../services/fileService';
import { toast } from 'react-toastify';
import { useLocation,useNavigate } from 'react-router-dom';
import Logout from '../components/auth/Logout'; //imported the logout 
import {useAuth} from '../contexts/AuthContext'; //imported the update user function from auth context
import ProfileMenu from './ProfileMenu';
import axios from 'axios';
import { jwtDecode } from "jwt-decode";

const Dashboard = () => {
  const { updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [pdfData, setPdfData] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [timetable, setTimetable] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const handlePlusClick = () => {
    fileInputRef.current.click();
  };

  // Authentication check
  const [token, setToken] = useState(localStorage.getItem('token'));
  useEffect(() => {
    if (!token) {
      navigate('/login'); // Redirect to login if token is not found
    }
  }, [token, navigate]);


  // it will retrive current user details 
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
        const response = await axios.get(`http://localhost:8000/user/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });


        if (!response) {
          throw new Error("Failed to fetch user data");
        }

        const userData = await response.data;
        console.log(userData);
        setCurrentUser(userData); // Update state with fresh data

        // Update the AuthContext with the fetched user data
        updateUser(userData); // Assuming you have updateUser function in your AuthContext
      } catch (error) {
        console.error("Fetching user error:", error);
      }
    };

    fetchUser();
  }, [location.pathname]);

  // Fetch timetable data from API
  useEffect(() => {
    const fetchTimetable = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate('/login');
          return;
        }

        const response = await axios.get("http://localhost:8000/api/timetable", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Group the timetable entries by day
        const groupedTimetable = response.data.reduce((acc, entry) => {
          if (!acc[entry.day]) {
            acc[entry.day] = [];
          }
          acc[entry.day].push({
            id: entry._id,
            subjectName: entry.subjectName,
            startTime: entry.startTime,
            endTime: entry.endTime,
            isFinished: entry.isFinished
          });
          return acc;
        }, {});

        setTimetable(groupedTimetable);
      } catch (error) {
        console.error("Error fetching timetable:", error);
        setError("Failed to load timetable");
      } finally {
        setLoading(false);
      }
    };

    fetchTimetable();
  }, [navigate]);

  const sortByTime = (entries) => {
    return entries.sort((a, b) => {
      const timeA = a.startTime.replace(':', '');
      const timeB = b.startTime.replace(':', '');
      return timeA - timeB;
    });
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check file size (50MB limit)
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
      
      if (file.size > MAX_FILE_SIZE) {
        toast.error('File size exceeds 50MB limit');
        return;
      }

      let loadingToast;
      try {
        // Show loading toast
        loadingToast = toast.loading('Uploading file...');
        
        const response = await uploadFile(file);
        
        // Dismiss loading toast and show success
        toast.dismiss(loadingToast);
        toast.success('File uploaded successfully');
        
        // Navigate to PDF viewer with the data
        navigate('/pdf-viewer', {
          state: {
            pdfData: `data:application/pdf;base64,${response.content}`,
            title: file.name
          }
        });
      } catch (error) {
        toast.dismiss(loadingToast);
        toast.error('Failed to upload file: ' + (error.message || 'Unknown error'));
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="flex flex-1">
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf"
        />

        {/* Sidebar */}
        <div className="sidebar bg-white shadow-sm flex flex-col items-center py-4 space-y-6 w-20">
          {/* Home Icon with Tooltip */}
          <div className="relative group">
            <div className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
              <Home className="w-6 h-6 text-gray-600" />
            </div>

            {/* Tooltip */}
            <div className="absolute left-full ml-2 hidden group-hover:flex items-center">
              <div className="bg-black text-white text-sm py-1 px-2 rounded whitespace-nowrap">
                Home
              </div>
              {/* Arrow */}
              <div className="absolute left-0 transform -translate-x-1 w-2 h-2 bg-black rotate-45"></div>
            </div>
          </div>
          
          {/* Admin Icon with Tooltip - Only visible for admins */}
          {currentUser?.role === "admin" && (
            <div className="relative group">
              <div 
                className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
                onClick={() => navigate('/admin')}
              >
                <LucideUserRoundCog className="w-6 h-6 text-gray-600" />
              </div>

              {/* Tooltip */}
              <div className="absolute left-full ml-2 hidden group-hover:flex items-center">
                <div className="bg-black text-white text-sm py-1 px-2 rounded whitespace-nowrap">
                  Admin Panel
                </div>
                {/* Arrow */}
                <div className="absolute left-0 transform -translate-x-1 w-2 h-2 bg-black rotate-45"></div>
              </div>
            </div>
          )}
          
          {/* Timetable Icon with Tooltip */}
          <div className="relative group">
            <div
              className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
              onClick={() =>
                currentUser?.membership === "premium" && currentUser !== null
                  ? navigate("/timetable")
                  : navigate("/upgradepro")
              }
            >
              <CalendarCheck className="w-6 h-6 text-gray-600" />
            </div>

            {/* Tooltip */}
            <div className="absolute left-full ml-2 hidden group-hover:flex items-center">
              <div className="bg-black text-white text-sm py-1 px-2 rounded whitespace-nowrap">
                My Timetable
              </div>
              <div className="absolute left-0 transform -translate-x-1 w-2 h-2 bg-black rotate-45"></div>
            </div>
          </div>
          
          {/* Pro Badge */}
          {currentUser?.membership !== "premium" && (
            <div
              className="mt-auto p-2 bg-black text-white rounded-lg cursor-pointer"
              onClick={() => navigate("/upgradepro")}
            >
              Pro
            </div>
          )}
          
          <ProfileMenu />
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 max-w-7xl mx-auto">
          {/* Studying Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Studying</h2>
            <div className="grid grid-cols-3 gap-4">
              {/* Study Card */}
              <div className="p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                onClick={() => navigate('/files')}
              >
                <Book className="w-6 h-6 mb-3 text-gray-600" />
                <h3 className="font-medium">Study</h3>
                <p className="text-sm text-gray-500">Learn swiftly</p>
              </div>
              
              {/* Practice Quiz Card */}
              <div className="p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                onClick={() => navigate('/practice')}
              >
                <Brain className="w-6 h-6 mb-3 text-gray-600" />
                <h3 className="font-medium">Practice quiz</h3>
                <p className="text-sm text-gray-500">Test your knowledge</p>
              </div>
              
              {/* Skill Analysis Card - NEW */}
              <div
                className="p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                onClick={() =>
                  currentUser.membership === "premium"
                    ? navigate("/skills")
                    : navigate("/upgradepro")
                }
              >
                <Calculator className="w-6 h-6 mb-3 text-gray-600" />
                <h3 className="font-medium">Skill Analysis</h3>
                <p className="text-sm text-gray-500">Track your progress</p>
              </div>

            </div>
          </div>

          {/* Timetable Section */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Timetable</h2>
{/* <button 
                className="p-2 hover:bg-gray-100 rounded-full"
                onClick={() => navigate('/entry')}
              >
                <Plus className="w-5 h-5 text-gray-600" />
              </button> */}
{/* <button 
                className="p-2 hover:bg-gray-100 rounded-full"
                onClick={() => navigate('/entry')}
              >
                <Plus className="w-5 h-5 text-gray-600" />
              </button> */}
            </div>
            
            {/* Keeping the existing timetable with API data */}
            {loading ? (
              <div className="text-center py-4">Loading timetable...</div>
            ) : error ? (
              <div className="text-center py-4 text-red-500">{error}</div>
            ) : (
              <div className="grid grid-cols-7 gap-4">
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                  <div key={day} className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-gray-700">{day}</span>
                      <Clock className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="space-y-2">
                      {timetable[day] && sortByTime(timetable[day]).map((entry) => (
                        <div
                          key={entry.id}
                          className={`p-2 rounded text-sm ${
                            entry.isFinished 
                              ? "bg-gray-100 text-gray-500" 
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          <div className="font-medium">{entry.subjectName}</div>
                          <div className="text-xs">
                            {entry.startTime} - {entry.endTime}
                          </div>
                        </div>
                      ))}
                      {(!timetable[day] || timetable[day].length === 0) && (
                        <div className="text-sm text-gray-400 text-center">
                          No classes scheduled
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Weekly Overview */}
            {/* <div className="mt-6 p-4 bg-white rounded-lg shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-700">Weekly Overview</h3>
                <Calendar className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 h-2 rounded-full bg-blue-100">
                  <div className="w-3/4 h-full rounded-full bg-blue-500"></div>
                </div>
                <span className="text-sm text-gray-600">75% Complete</span>
              </div>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;