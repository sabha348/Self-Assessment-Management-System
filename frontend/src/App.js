// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './redux/store/store';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/index.css';
import { ErrorBoundary } from 'react-error-boundary';

// Import Route Components
import Logout from './components/auth/Logout';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './pages/Dashboard';
import PrivateRoute from './components/common/PrivateRoute';
import QuestionGenerator from './components/questions/QuestionGenerator';
import UserProfile from './components/profile/UserProfile';
import NotFound from './pages/NotFound';
import PdfViewer from './pages/PdfViewer';
import FilesList from './pages/FilesList';
import Timetable from './pages/Timetable';
import ProfileMenu from './pages/ProfileMenu';
import AddEntry from './components/AddEntry';
// New imports
import Practice from './pages/Practice';
import Assessment from './pages/Assessment';
import SkillAnalysis from './pages/SkillAnalysis';

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

function ErrorFallback({ error }) {
  return (
    <div className="p-4">
      <h2>Something went wrong:</h2>
      <pre>{error.message}</pre>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <ThemeProvider theme={theme}>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/logout" element={<Logout />} />
                
                {/* Dashboard */}
                <Route 
                  path="/dashboard" 
                  element={
                    // <PrivateRoute>
                      <Dashboard />
                    //  </PrivateRoute>
                  } 
                />
                
                {/* Files and Resource Routes */}
                <Route path="/files" element={<FilesList />} />
                <Route path="/pdf-viewer" element={<PdfViewer />} />
                
                {/* Learning Routes */}
                <Route path="/practice" element={<Practice />} />
                <Route path="/skills" element={<SkillAnalysis />} />
                <Route path="/assessment" element={<Assessment />} />
                <Route path="/questions" element={<QuestionGenerator />} />

                {/* Timetable Routes */}
                <Route path="/timetable" element={<Timetable />} />
                <Route path="/entry" element={<AddEntry />} />
                
                {/* Profile Routes */}
                <Route path="/profile/menu" element={<ProfileMenu />} />
                <Route 
                  path="/profile" 
                  element={
                    <PrivateRoute>
                      <UserProfile />
                    </PrivateRoute>
                  } 
                />
                
                {/* Default Route */}
                <Route path="*" element={<Login/>} />
              </Routes>
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
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
}

export default App;