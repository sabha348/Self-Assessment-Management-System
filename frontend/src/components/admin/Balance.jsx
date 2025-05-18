import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Balance.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';


const Balance = () => {
  const [balanceData, setBalanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchBalanceData();
  }, []);

  const fetchBalanceData = async () => {
    try {
      setLoading(true);
      
      // Build query params for date filtering
      let queryParams = '';
      if (dateRange.startDate) {
        queryParams += `startDate=${dateRange.startDate}`;
      }
      if (dateRange.endDate) {
        queryParams += queryParams ? `&endDate=${dateRange.endDate}` : `endDate=${dateRange.endDate}`;
      }

      const url = `${API_URL}/admin/balance${queryParams ? '?' + queryParams : ''}`;

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      setBalanceData(response.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load balance data');
      setLoading(false);
    }
  };

  const handleDateChange = (e) => {
    setDateRange({
      ...dateRange,
      [e.target.name]: e.target.value
    });
  };

  const applyDateFilter = (e) => {
    e.preventDefault();
    fetchBalanceData();
  };

  if (loading) return <div className="loading">Loading balance data...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="balance-page">
      <h1>Revenue Dashboard</h1>
      
      <div className="balance-filters">
        <form onSubmit={applyDateFilter}>
          <div className="date-range">
            <div className="form-group">
              <label>Start Date</label>
              <input 
                type="date" 
                name="startDate"
                value={dateRange.startDate}
                onChange={handleDateChange}
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input 
                type="date" 
                name="endDate"
                value={dateRange.endDate}
                onChange={handleDateChange}
              />
            </div>
            <button type="submit" className="btn btn-primary">Apply Filter</button>
          </div>
        </form>
      </div>
      
      <div className="revenue-summary">
        <div className="total-revenue">
          <h2>Total Revenue</h2>
          <div className="amount">₹{balanceData?.totalRevenue || 0}</div>
        </div>
        
        <div className="metrics-cards">
          <div className="metric-card">
            <h3>Active Subscriptions</h3>
            <div className="metric-value">{balanceData?.metrics?.activeSubscriptions || 0}</div>
          </div>
          <div className="metric-card">
            <h3>Total Payments</h3>
            <div className="metric-value">{balanceData?.metrics?.totalPayments || 0}</div>
          </div>
        </div>
      </div>
      
      <div className="recent-transactions">
        <h2>Recent Transactions</h2>
        {balanceData?.transactions?.length ? (
          <table className="transactions-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {balanceData.transactions.map(transaction => (
                <tr key={transaction.id}>
                  <td>{transaction.userName}</td>
                  <td>{transaction.userEmail}</td>
                  <td>₹{transaction.amount}</td>
                  <td>{new Date(transaction.date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no-data">No transactions found</p>
        )}
      </div>
    </div>
  );
};

export default Balance;