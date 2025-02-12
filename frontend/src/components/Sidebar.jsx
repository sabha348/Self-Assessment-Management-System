import React from 'react';
import { HomeIcon, UserGroupIcon, ChartBarIcon, CogIcon } from '@heroicons/react/24/outline';

const Sidebar = () => {
  return (
    <aside className="w-20 bg-white shadow-lg fixed h-full">
      <div className="flex flex-col items-center py-6 space-y-8">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 bg-indigo-600 rounded-lg"></div>
        </div>
        
        <nav className="flex flex-col space-y-8">
          <a href="#" className="p-3 text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-all">
            <HomeIcon className="h-6 w-6" />
          </a>
          <a href="#" className="p-3 text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-all">
            <UserGroupIcon className="h-6 w-6" />
          </a>
          <a href="#" className="p-3 text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-all">
            <ChartBarIcon className="h-6 w-6" />
          </a>
          <a href="#" className="p-3 text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-all">
            <CogIcon className="h-6 w-6" />
          </a>
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;