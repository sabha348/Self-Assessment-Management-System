import React from 'react';
import { Outlet } from 'react-router-dom';
import MainSidebar from './MainSidebar';

const Layout = () => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <MainSidebar />
      <div className="flex-1 p-8 max-w-7xl mx-auto">
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;