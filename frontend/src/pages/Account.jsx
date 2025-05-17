import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { User, Mail, Lock, HelpCircle, Trash2, ArrowLeft, CreditCard } from 'lucide-react';

const Account = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [activeSection, setActiveSection] = useState('profile');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [helpMessage, setHelpMessage] = useState('');
  const [showCancelSubscriptionConfirm, setShowCancelSubscriptionConfirm] = useState(false);
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        // Decode token to get user ID
        const decoded = jwtDecode(token);
        const userId = decoded.userId;

        // Fetch user data
        const response = await axios.get(`${API_URL}/user/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setUser(response.data);
        setFormData(prevState => ({
          ...prevState,
          email: response.data.email
        }));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast.error('Failed to load account information');
        navigate('/dashboard');
      }
    };

    fetchUserData();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/user/${user._id}`, 
        { email: formData.email },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Email updated successfully');
      // Update the user state with the new email
      setUser({...user, email: formData.email});
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update email');
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/user/change-password`, 
        { 
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword 
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Password updated successfully');
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update password');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Send deletion request with notification to admin
      await axios.delete(`${API_URL}/user/${user._id}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { 
          notifyAdmin: true, 
          userName: user.name,
          userEmail: user.email
        }
      });
      
      localStorage.removeItem('token');
      toast.success('Account deleted successfully');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete account');
    }
  };

  const handleSendHelpRequest = async (e) => {
    e.preventDefault();
    if (!helpMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/help-request`, { 
        message: helpMessage,
        userName: user.name,
        userEmail: user.email,
        userId: user._id,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Help request sent successfully');
      setHelpMessage('');
    } catch (error) {
      toast.error('Failed to send help request. Please try again later.');
    }
  };

  const handleCancelSubscription = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API_URL}/payment/subscription/cancel`, 
        { userId: user._id },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Subscription cancelled successfully. You will have access until your current billing period ends.');
      
      // Update user's subscription status but keep them as premium until expiry
      setUser({
        ...user,
        subscriptionStatus: 'cancelled' // Add this field to track cancellation state
      });
      
      // Close the confirmation dialog
      setShowCancelSubscriptionConfirm(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel subscription');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm">
        {/* Header */}
        <div className="border-b p-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-semibold">Account Settings</h1>
          </div>
          {user?.membership === "premium" && (
            <span className="bg-black text-white px-3 py-1 rounded-full text-sm">
              Premium
            </span>
          )}
        </div>
        
        {/* Navigation */}
        <div className="grid grid-cols-4 md:grid-cols-5">
          <div className="col-span-1 p-5 border-r min-h-[70vh]">
            <nav>
              <button 
                onClick={() => setActiveSection('profile')}
                className={`w-full text-left p-2 mb-2 rounded ${activeSection === 'profile' ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center">
                  <User size={18} className="mr-2" /> Profile
                </div>
              </button>
              <button 
                onClick={() => setActiveSection('email')}
                className={`w-full text-left p-2 mb-2 rounded ${activeSection === 'email' ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center">
                  <Mail size={18} className="mr-2" /> Email
                </div>
              </button>
              <button 
                onClick={() => setActiveSection('password')}
                className={`w-full text-left p-2 mb-2 rounded ${activeSection === 'password' ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center">
                  <Lock size={18} className="mr-2" /> Password
                </div>
              </button>
              <button 
                onClick={() => setActiveSection('help')}
                className={`w-full text-left p-2 mb-2 rounded ${activeSection === 'help' ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center">
                  <HelpCircle size={18} className="mr-2" /> Help
                </div>
              </button>
              <button 
                onClick={() => setActiveSection('subscription')}
                className={`w-full text-left p-2 mb-2 rounded ${activeSection === 'subscription' ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center">
                  <CreditCard size={18} className="mr-2" /> Subscription
                </div>
              </button>
              <button 
                onClick={() => setActiveSection('delete')}
                className={`w-full text-left p-2 text-red-500 rounded ${activeSection === 'delete' ? 'bg-red-50 font-medium' : 'hover:bg-red-50'}`}
              >
                <div className="flex items-center">
                  <Trash2 size={18} className="mr-2" /> Delete Account
                </div>
              </button>
            </nav>
          </div>
          
          {/* Content Area */}
          <div className="col-span-3 md:col-span-4 p-5">
            {/* Profile Section */}
            {activeSection === 'profile' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
                <div className="p-4 border rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Name</label>
                      <div className="p-2 border rounded bg-gray-50">{user?.name}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                      <div className="p-2 border rounded bg-gray-50">{user?.email}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Mobile</label>
                      <div className="p-2 border rounded bg-gray-50">{user?.mobileno || 'Not provided'}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Membership</label>
                      <div className="p-2 border rounded bg-gray-50">{user?.membership || 'Free'}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Email Section */}
            {activeSection === 'email' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Update Email</h2>
                <form onSubmit={handleUpdateEmail} className="p-4 border rounded-lg">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-600 mb-1">New Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full p-2 border rounded"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
                  >
                    Update Email
                  </button>
                </form>
              </div>
            )}
            
            {/* Password Section */}
            {activeSection === 'password' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Change Password</h2>
                <form onSubmit={handleUpdatePassword} className="p-4 border rounded-lg">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Current Password</label>
                    <input
                      type="password"
                      name="currentPassword"
                      value={formData.currentPassword}
                      onChange={handleChange}
                      className="w-full p-2 border rounded"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-600 mb-1">New Password</label>
                    <input
                      type="password"
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleChange}
                      className="w-full p-2 border rounded"
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-600 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="w-full p-2 border rounded"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
                  >
                    Update Password
                  </button>
                </form>
              </div>
            )}
            
            {/* Help Section */}
            {activeSection === 'help' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Get Help</h2>
                <form onSubmit={handleSendHelpRequest} className="p-4 border rounded-lg">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-600 mb-1">What can we help you with?</label>
                    <textarea
                      name="helpMessage"
                      value={helpMessage}
                      onChange={(e) => setHelpMessage(e.target.value)}
                      className="w-full p-2 border rounded h-32"
                      placeholder="Describe your issue..."
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
                  >
                    Submit Request
                  </button>
                </form>
              </div>
            )}
            
            {/* Subscription Section */}
            {activeSection === 'subscription' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Subscription Management</h2>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-medium">Current Plan</h3>
                      <div className="text-lg mt-1">
                        {user?.membership === "premium" ? (
                          <div>
                            <span className="text-green-600 font-semibold">Premium</span>
                            {user?.subscriptionStatus === 'cancelled' && (
                              <span className="ml-2 text-sm text-orange-500">(Cancelled - Access until expiry)</span>
                            )}
                          </div>
                        ) : (
                          <span>Free</span>
                        )}
                      </div>
                    </div>
                    
                    {user?.membershipExpiry && (
                      <div className="text-right">
                        <h3 className="font-medium">Expires</h3>
                        <div className="text-gray-600">
                          {new Date(user.membershipExpiry).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {user?.membership === "premium" ? (
                    <div>
                      <div className="mb-6">
                        <h3 className="font-medium mb-2">Premium Benefits</h3>
                        <ul className="list-disc pl-5 text-gray-600">
                          <li>Unlimited study-quiz generation</li>
                          <li>Unlimited practice questions</li>
                          <li>Access to timetable feature</li>
                          <li>Skill analysis tracking</li>
                        </ul>
                      </div>
                      
                      {/* Only show cancel button if not already cancelled */}
                      {!user?.subscriptionStatus === 'cancelled' && (
                        !showCancelSubscriptionConfirm ? (
                          <button
                            onClick={() => setShowCancelSubscriptionConfirm(true)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            Cancel Subscription
                          </button>
                        ) : (
                          <div className="border-t pt-4 mt-4">
                            <p className="font-medium text-gray-700 mb-3">
                              Are you sure you want to cancel your premium subscription?
                            </p>
                            <p className="text-gray-600 mb-4">
                              You'll lose access to premium features at the end of your current billing period.
                            </p>
                            <div className="flex space-x-3">
                              <button
                                onClick={handleCancelSubscription}
                                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                              >
                                Yes, Cancel Subscription
                              </button>
                              <button
                                onClick={() => setShowCancelSubscriptionConfirm(false)}
                                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                              >
                                Keep Subscription
                              </button>
                            </div>
                          </div>
                        )
                      )}
                      
                      {/* Show message if already cancelled */}
                      {user?.subscriptionStatus === 'cancelled' && (
                        <div className="p-3 bg-gray-50 border rounded mt-4">
                          <p>Your subscription has been cancelled. You'll have access to premium features until your expiry date.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="mb-4">Upgrade to our premium plan to unlock all features.</p>
                      <button
                        onClick={() => navigate('/upgradepro')}
                        className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
                      >
                        Upgrade to Premium
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Delete Account Section */}
            {activeSection === 'delete' && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Delete Account</h2>
                <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                  <p className="mb-4">Deleting your account will remove all of your information from our database. This action cannot be undone.</p>
                  
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Delete Account
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <p className="font-bold text-red-600">Are you absolutely sure you want to delete your account?</p>
                      <div className="flex space-x-3">
                        <button
                          onClick={handleDeleteAccount}
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Yes, Delete My Account
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;