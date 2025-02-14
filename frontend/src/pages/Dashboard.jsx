import React, { useRef, useState } from 'react';
import { Book, Brain, Calculator, Layers, PenTool, Folder, Plus, Home, CreditCard, FolderArchive, FolderCheck, Clock, Calendar, CalendarCheck } from 'lucide-react';
import { uploadFile } from '../services/fileService';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import Logout  from '../components/auth/Logout'; //imported the logout 

const Dashboard = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [pdfData, setPdfData] = useState(null);
  const [numPages, setNumPages] = useState(null);

  const handlePlusClick = () => {
    fileInputRef.current.click();
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
    <div className="flex min-h-screen bg-gray-50">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf"
      />

      {/* Sidebar */}
      {/* This sidebar uses flexbox (flex flex-col) to arrange items vertically and center them horizontally (items-center)
          It has white background (bg-white), subtle shadow (shadow-sm), 
          padding of 1rem (16px) on top and bottom (py-4 where 4 = 1rem),
          vertical spacing between children (space-y-6) and fixed width of 5rem (w-20) */}
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
        
        {/* Folder Icon with Tooltip */}
        <div className="relative group">
          <div className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
              onClick={() => navigate('/timetable')}
          >
            <CalendarCheck className="w-6 h-6 text-gray-600" />
          </div>

          {/* Tooltip */}
          <div className="absolute left-full ml-2 hidden group-hover:flex items-center">
            <div className="bg-black text-white text-sm py-1 px-2 rounded whitespace-nowrap">
              My Timetable
            </div>
            {/* Arrow */}
            <div className="absolute left-0 transform -translate-x-1 w-2 h-2 bg-black rotate-45"></div>
          </div>
        </div>
        
        {/* Plus Icon with Tooltip */}
        <div className="relative group">
          <div 
            className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
            onClick={handlePlusClick}
          >
            <Plus className="w-6 h-6 text-gray-600" />
          </div>
          
          {/* Tooltip */}
          <div className="absolute left-full ml-2 hidden group-hover:flex items-center">
            <div className="bg-black text-white text-sm py-1 px-2 rounded whitespace-nowrap">
              Upload pdf
            </div>
            {/* Arrow */}
            <div className="absolute left-0 transform -translate-x-1 w-2 h-2 bg-black rotate-45"></div>
          </div>
        </div>

        {/* Pro Badge - at the bottom */}
        <div className="mt-auto p-2 bg-black text-white rounded-lg">
          Pro
        </div>
        
        {/* Logout Button */}
        <div className="relative group mt-auto">
          <div
            className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
            onClick={() => navigate('/logout')}
          >
            <FolderCheck className="w-6 h-6 text-gray-600" />
          </div>

          {/* Tooltip */}
          <div className="absolute left-full ml-2 hidden group-hover:flex items-center">
            <div className="bg-black text-white text-sm py-1 px-2 rounded whitespace-nowrap">
              Logout
            </div>
            <div className="absolute left-0 transform -translate-x-1 w-2 h-2 bg-black rotate-45"></div>
          </div>
        </div>

      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 max-w-7xl mx-auto">

        {/* Studying Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Studying</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
              onClick={() => navigate('/files')}
            >
              <Book className="w-6 h-6 mb-3 text-gray-600" />
              <h3 className="font-medium">Study</h3>
              <p className="text-sm text-gray-500">Learn swiftly</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <Brain className="w-6 h-6 mb-3 text-gray-600" />
              <h3 className="font-medium">Practice quiz</h3>
              <p className="text-sm text-gray-500">Test your knowledge</p>
            </div>
          </div>
        </div>

        {/* Timetable Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Timetable</h2>
            <button className="p-2 hover:bg-gray-100 rounded-full">
              <Plus className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-4">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
              <div key={day} className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-700">{day}</span>
                  <Clock className="w-4 h-4 text-gray-500" />
                </div>
                <div className="space-y-2">
                  <div className="p-2 bg-blue-50 rounded text-sm text-blue-700">
                    9:00 AM - Study
                  </div>
                  <div className="p-2 bg-green-50 rounded text-sm text-green-700">
                    2:00 PM - Practice
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Weekly Overview */}
          <div className="mt-6 p-4 bg-white rounded-lg shadow-sm">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;