import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './redux/store/store';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/index.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './services/axiosSetup';
import { CircularProgress, Box } from '@mui/material';

import Logout from './components/auth/Logout';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import PdfViewer from './pages/PdfViewer';
import FilesList from './pages/FilesList';
import Timetable from './pages/Timetable';
import ProfileMenu from './pages/ProfileMenu';
import AddEntry from './components/AddEntry';
import Practice from './pages/Practice';
import Assessment from './pages/Assessment';
import SkillAnalysis from './pages/SkillAnalysis';
import { Elements } from '@stripe/react-stripe-js';
import PaymentSuccess from './pages/PaymentSuccess';
import ProUpgradeModal from './pages/ProUpgradeModal';

import AdminRoute from './components/AdminRoute';
import AdminLayout from './components/admin/AdminLayout';
import UserManagement from './components/admin/UserManagement';
import Settings from './components/admin/Settings';
import UserDetail from './components/admin/UserDetail';
import EditUser from './components/admin/EditUser';
import Balance from './components/admin/Balance';
import Account from './pages/Account';
import NotificationsPanel from './components/admin/NotificationsPanel';
import ErrorBoundary from './components/ErrorBoundary';

// MUI Theme Configuration
const theme = createTheme({
  palette: {
    primary: {
      main: '#3B82F6',
    },
    secondary: {
      main: '#10B981',
    },
  },
});

// AuthGuard component
const AuthGuard = ({ children }) => {
  const { user, loading } = useAuth(); // Your auth hook
  
  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={60} />
        <Box sx={{ mt: 2, color: 'text.secondary' }}>Loading...</Box>
      </Box>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

function App() {
  return (
    // <ErrorBoundary componentName="AppRoot">
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <ThemeProvider theme={theme}>
            <AuthProvider>
              <BrowserRouter>
                <div className="app">
                  <main className="main-content">
                    <Routes>

                      {/* Admin Routes */}
                      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                        <Route index element={<Navigate to="/admin/users" replace />} />
                        <Route path="users" element={<UserManagement />} />
                        <Route path="users/:id" element={<UserDetail />} />
                        <Route path="users/:id/edit" element={<EditUser />} />
                        <Route path="notifications" element={<NotificationsPanel />} />
                        <Route path="settings" element={<Settings />} />
                        <Route path="balance" element={<Balance />} />
                      </Route>

                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/logout" element={<Logout />} />
                      
                      {/* Dashboard */}
                      <Route 
                        path="/dashboard" 
                        element={
                            <Dashboard />
                        } 
                      />

                      <Route path="/upgradepro" element={<ProUpgradeModal />} />
                      <Route path="/account" element={<Account />} />

                      
                      
                      
                      {/* Files and Resource Routes */}
                      <Route 
                        path="/files" 
                        element={
                          <AuthGuard>
                            <Suspense fallback={
                              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                                <CircularProgress />
                              </Box>
                            }>
                              <FilesList />
                            </Suspense>
                          </AuthGuard>
                        } 
                      />
                      <Route path="/pdf-viewer" element={<PdfViewer />} />
                      
                      {/* Learning Routes */}
                      <Route path="/practice" element={<Practice />} />
                      <Route path="/skills" element={<SkillAnalysis />} />
                      <Route path="/assessment" element={<Assessment />} />

                      {/* Timetable Routes */}
                      <Route path="/timetable" element={<Timetable />} />
                      <Route path="/entry" element={<AddEntry />} />

                        {/* Stripe  */}
                        <Route path="/payment-success" element={<PaymentSuccess />} />
                      
                      {/* Default Route */}
                      <Route path="*" element={<Login/>} />
                    </Routes>
                  </main>
                </div>
                <ToastContainer 
                  position="top-right"
                  autoClose={3000}
                  hideProgressBar={false}
                  newestOnTop={false}
                  closeOnClick
                  rtl={false}
                  pauseOnFocusLoss
                  draggable
                  pauseOnHover
                />
              </BrowserRouter>
            </AuthProvider>
          </ThemeProvider>
        </PersistGate>
      </Provider>
    // </ErrorBoundary>
  );
}

export default App;