import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Remove token from localStorage
    // localStorage.removeItem('token');

    // Redirect to login page
    navigate('/login');
  }, [navigate]);

  return <p>Logging out...</p>;
};

export default Logout;
