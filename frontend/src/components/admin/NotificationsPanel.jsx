import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Bell, Mail, Trash, User, CheckCircle, X, AlertTriangle } from 'lucide-react';
import './NotificationsPanel.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const NotificationsPanel = () => {
  const [notifications, setNotifications] = useState([]);
  const [helpRequests, setHelpRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notifications');
  const [responseText, setResponseText] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showResponseModal, setShowResponseModal] = useState(false);

  useEffect(() => {
    fetchNotificationsAndRequests();
  }, []);

  const fetchNotificationsAndRequests = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const [notificationsRes, helpRequestsRes] = await Promise.all([
        axios.get(`${API_URL}/admin/notifications`  , {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/help-requests`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setNotifications(notificationsRes.data.notifications);
      setHelpRequests(helpRequestsRes.data.helpRequests);
    } catch (error) {
      toast.error('Failed to load notifications or help requests');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const markNotificationAsRead = async (id) => {
    try {
      const token = localStorage.getItem('token');
      
      await axios.patch(`${API_URL}/admin/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => 
          notification._id === id ? { ...notification, isRead: true } : notification
        )
      );
    } catch (error) {
      toast.error('Failed to mark notification as read');
    }
  };

  const openResponseModal = (request) => {
    setSelectedRequest(request);
    setResponseText('');
    setShowResponseModal(true);
  };

  const handleSendResponse = async () => {
    if (!responseText.trim()) {
      toast.error('Response cannot be empty');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      
      await axios.post(`${API_URL}/help-request/${selectedRequest._id}/respond`, {
        response: responseText
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update the help request in state
      setHelpRequests(prevRequests => 
        prevRequests.map(request => 
          request._id === selectedRequest._id 
            ? { ...request, status: 'resolved', adminResponse: responseText } 
            : request
        )
      );
      
      setShowResponseModal(false);
      toast.success('Response sent successfully');
    } catch (error) {
      toast.error('Failed to send response');
    }
  };

  const clearReadNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      
      await axios.delete(`${API_URL}/admin/notifications/clear-read`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Remove read notifications from the state
      setNotifications(prevNotifications => 
        prevNotifications.filter(notification => !notification.isRead)
      );
      
      toast.success('Cleared read notifications');
    } catch (error) {
      toast.error('Failed to clear notifications');
      console.error(error);
    }
  };

  const clearResolvedRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      
      await axios.delete(`${API_URL}/help-requests/clear-resolved`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Remove resolved help requests from the state
      setHelpRequests(prevRequests => 
        prevRequests.filter(request => request.status !== 'resolved')
      );
      
      toast.success('Cleared resolved help requests');
    } catch (error) {
      toast.error('Failed to clear help requests');
      console.error(error);
    }
  };

  return (
    <div className="notifications-panel">
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          <Bell size={18} />
          Notifications
          {notifications.filter(n => !n.isRead).length > 0 && (
            <span className="badge">{notifications.filter(n => !n.isRead).length}</span>
          )}
        </button>
        <button 
          className={`tab ${activeTab === 'helpRequests' ? 'active' : ''}`}
          onClick={() => setActiveTab('helpRequests')}
        >
          <Mail size={18} />
          Help Requests
          {helpRequests.filter(r => r.status === 'pending').length > 0 && (
            <span className="badge">{helpRequests.filter(r => r.status === 'pending').length}</span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : activeTab === 'notifications' ? (
        <div className="notification-list">
          <div className="list-header">
            <h3>System Notifications</h3>
            {notifications.some(n => n.isRead) && (
              <button 
                className="clear-button"
                onClick={clearReadNotifications}
              >
                <Trash size={14} /> Clear Read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="empty-state">No notifications</div>
          ) : (
            notifications.map(notification => (
              <div 
                key={notification._id} 
                className={`notification-item ${!notification.isRead ? 'unread' : ''} ${notification.type === 'system_error' ? 'error' : ''}`}
                onClick={() => !notification.isRead && markNotificationAsRead(notification._id)}
              >
                <div className="notification-icon">
                  {notification.type === 'account_deletion' ? (
                    <Trash size={18} className="icon-delete" />
                  ) : notification.type === 'system_error' ? (
                    <AlertTriangle size={18} className="icon-error" />
                  ) : (
                    <Mail size={18} className="icon-help" />
                  )}
                </div>
                <div className="notification-content">
                  <div className="notification-header">
                    <span className="notification-title">
                      {notification.type === 'account_deletion' 
                        ? 'Account Deleted' 
                        : notification.type === 'system_error'
                        ? 'System Error'
                        : 'Help Request'}
                    </span>
                    <span className="notification-time">
                      {new Date(notification.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="notification-message">{notification.message}</div>
                  <div className="notification-user">
                    <User size={14} /> {notification.userName} ({notification.userEmail})
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="help-request-list">
          <div className="list-header">
            <h3>User Help Requests</h3>
            {helpRequests.some(r => r.status === 'resolved') && (
              <button 
                className="clear-button"
                onClick={clearResolvedRequests}
              >
                <Trash size={14} /> Clear Resolved
              </button>
            )}
          </div>
          {helpRequests.length === 0 ? (
            <div className="empty-state">No help requests</div>
          ) : (
            helpRequests.map(request => (
              <div key={request._id} className={`help-request-item status-${request.status}`}>
                <div className="help-request-header">
                  <div>
                    <span className="help-request-from">From: {request.userName}</span>
                    <span className="help-request-email">{request.userEmail}</span>
                  </div>
                  <div className="help-request-time">
                    {new Date(request.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="help-request-message">{request.message}</div>
                
                <div className="help-request-status">
                  <span className={`status-badge ${request.status}`}>
                    {request.status === 'pending' ? 'Pending' : 
                     request.status === 'in_progress' ? 'In Progress' : 'Resolved'}
                  </span>
                  
                  {request.status === 'pending' && (
                    <button 
                      className="respond-button"
                      onClick={() => openResponseModal(request)}
                    >
                      Respond
                    </button>
                  )}
                  
                  {request.status === 'resolved' && (
                    <div className="response-details">
                      <div className="response-label">Your response:</div>
                      <div className="response-text">{request.adminResponse}</div>
                      <div className="response-time">
                        Sent on {new Date(request.respondedAt).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Response Modal */}
      {showResponseModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Respond to Help Request</h3>
              <button className="close-button" onClick={() => setShowResponseModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="request-details">
                <div className="label">From:</div>
                <div>{selectedRequest.userName} ({selectedRequest.userEmail})</div>
                
                <div className="label mt-2">Message:</div>
                <div className="request-message">{selectedRequest.message}</div>
              </div>
              
              <div className="response-form">
                <label htmlFor="response">Your Response:</label>
                <textarea
                  id="response"
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Type your response here..."
                  rows={5}
                  className="response-textarea"
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="cancel-button"
                onClick={() => setShowResponseModal(false)}
              >
                Cancel
              </button>
              <button 
                className="send-button"
                onClick={handleSendResponse}
              >
                <Mail size={16} />
                Send Response
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPanel;