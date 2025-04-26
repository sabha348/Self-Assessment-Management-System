import React, { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Bell, DollarSign, Settings } from 'lucide-react';
import './AdminLayout.css';

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="admin-layout">
      {/* Top Navigation Bar */}
      <header className="admin-header">
        <div className="admin-header-left">
          <h1>Self-Assessment System</h1>
          <nav className="admin-top-nav">
            <Link to="/dashboard" className="nav-link">Dashboard</Link>
          </nav>
        </div>
        
        <div className="admin-header-right">
          <div className="admin-profile" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <div className="admin-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <span className="admin-name">{user?.name || 'Admin'}</span>
            
            {dropdownOpen && (
              <div className="admin-dropdown">
                {/* <Link to="/profile" className="dropdown-item">My Profile</Link> */}
                <div className="dropdown-divider"></div>
                <button onClick={handleLogout} className="dropdown-item logout-btn">
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="admin-sidebar">
        <nav>
          <ul>
            <li>
              <Link to="/admin/users">
                <Users size={18} className="nav-icon" />
                <span>Users</span>
              </Link>
            </li>
            <li>
              <Link to="/admin/notifications">
                <Bell size={18} className="nav-icon" />
                <span>Notifications & Help</span>
              </Link>
            </li>
            <li>
              <Link to="/admin/balance">
                <DollarSign size={18} className="nav-icon" />
                <span>Revenue</span>
              </Link>
            </li>
            <li>
              <Link to="/admin/settings">
                <Settings size={18} className="nav-icon" />
                <span>Settings</span>
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
      
      {/* Main Content */}
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;