import React from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 ml-20 p-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;