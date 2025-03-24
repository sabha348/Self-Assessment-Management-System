import React from 'react';
import { Home, CalendarCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProfileMenu from '../pages/ProfileMenu';

const MainSidebar = () => {
  const navigate = useNavigate();
  
  return (
    <div className="sidebar bg-white shadow-sm flex flex-col items-center py-4 space-y-6 w-20 h-screen">
      {/* Home Icon with Tooltip */}
      <div className="relative group">
        <div 
          className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
          onClick={() => navigate('/dashboard')}
        >
          <Home className="w-6 h-6 text-gray-600" />
        </div>

        {/* Tooltip */}
        <div className="absolute left-full ml-2 hidden group-hover:flex items-center z-50">
          <div className="bg-black text-white text-sm py-1 px-2 rounded whitespace-nowrap">
            Home
          </div>
          {/* Arrow */}
          <div className="absolute left-0 transform -translate-x-1 w-2 h-2 bg-black rotate-45"></div>
        </div>
      </div>
      
      {/* Timetable Icon with Tooltip */}
      <div className="relative group">
        <div 
          className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
          onClick={() => navigate('/timetable')}
        >
          <CalendarCheck className="w-6 h-6 text-gray-600" />
        </div>

        {/* Tooltip */}
        <div className="absolute left-full ml-2 hidden group-hover:flex items-center z-50">
          <div className="bg-black text-white text-sm py-1 px-2 rounded whitespace-nowrap">
            My Timetable
          </div>
          {/* Arrow */}
          <div className="absolute left-0 transform -translate-x-1 w-2 h-2 bg-black rotate-45"></div>
        </div>
      </div>
      
      {/* Profile Menu */}
      <div className="mt-auto">
        <ProfileMenu />
      </div>
    </div>
  );
};

export default MainSidebar;