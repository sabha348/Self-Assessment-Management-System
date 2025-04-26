import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Settings.css';

const Settings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('application');
  const [faviconPreview, setFaviconPreview] = useState(null);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const fileInputRef = useRef(null);
  
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get('http://localhost:8000/api/admin/settings', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        setSettings(response.data);
        
        // Apply settings to the application
        
        
        
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load settings');
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, []);
  
  const handleFaviconChange = (e) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0];
    
    // Check file size (max 1MB)
    if (file.size > 1024 * 1024) {
      setError('Favicon must be less than 1MB in size');
      return;
    }
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setFaviconPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };
  
  const uploadFavicon = async () => {
    if (!fileInputRef.current?.files || !fileInputRef.current.files[0]) {
      return;
    }
    
    setUploadingFavicon(true);
    const formData = new FormData();
    formData.append('favicon', fileInputRef.current.files[0]);
    
    try {
      const response = await axios.post(
        'http://localhost:8000/api/admin/settings/favicon',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      // Update settings with new favicon path
      setSettings({
        ...settings,
        faviconPath: response.data.faviconPath
      });
      
      // Apply the new favicon to the application
      
      setSuccess('Favicon updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to upload favicon');
    } finally {
      setUploadingFavicon(false);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put('http://localhost:8000/api/admin/settings', settings, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      // Apply new settings to the application
      
      setSuccess('Settings updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to update settings');
    }
  };
  
  if (loading) return <div className="loading">Loading settings...</div>;
  if (error) return <div className="error">{error}</div>;
  
  return (
    <div className="settings-page">
      <h1>System Settings</h1>
      
      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="settings-section">
          
          <div className="form-group">
            <label>Application Name</label>
            <input 
              type="text" 
              value={settings.appName || ''} 
              onChange={(e) => setSettings({...settings, appName: e.target.value})}
            />
          </div>
          
          {/* <div className="form-group">
            <label>Website Favicon</label>
            <div className="file-upload-container">
              <input 
                type="file"
                ref={fileInputRef}
                accept=".ico,.png,.jpg,.jpeg,.svg"
                onChange={handleFaviconChange}
                className="file-input"
              />
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => fileInputRef.current.click()}
              >
                Select File
              </button>
              
              <button
                type="button"
                className="btn btn-primary upload-btn"
                onClick={uploadFavicon}
                disabled={!faviconPreview || uploadingFavicon}
              >
                {uploadingFavicon ? 'Uploading...' : 'Upload Favicon'}
              </button>
            </div>
            <small className="help-text">
              Select an image file (.ico, .png, .jpg, or .svg). Max size: 1MB. Square images work best.
            </small>
          </div>
          
          {faviconPreview && (
            <div className="favicon-preview">
              <label>Favicon Preview</label>
              <img 
                src={faviconPreview} 
                alt="Favicon Preview" 
                className="favicon-img"
              />
            </div>
          )}
           */}
          <div className="form-group">
            <label>Contact Email</label>
            <input 
              type="email" 
              value={settings.contactEmail || ''} 
              onChange={(e) => setSettings({...settings, contactEmail: e.target.value})}
            />
          </div>
          
          <div className="form-group">
            <label>Support Phone</label>
            <input 
              type="tel" 
              value={settings.supportPhone || ''} 
              onChange={(e) => setSettings({...settings, supportPhone: e.target.value})}
            />
          </div>
        </div>
        
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">Save Settings</button>
        </div>
      </form>
    </div>
  );
};

export default Settings;