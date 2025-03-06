import { useState, useRef, useEffect } from "react";
import { FaCog, FaSignOutAlt } from "react-icons/fa";
import { User } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ProfileMenu = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative">
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-gray-200 cursor-pointer"
      >
        <User size={25} className="text-gray-800" />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute left-8 mt-2 w-48 bg-white text-gray-800 rounded-lg shadow-lg py-2 border border-gray-300"
        >
          <button
            className="flex items-center px-4 py-2 hover:bg-gray-200 w-full"
            onClick={() => navigate('/account')}
          >
            <FaCog className="mr-2" /> Account
          </button>
          <hr className="border-gray-300" />
          <button
            className="flex items-center px-4 py-2 text-red-500 hover:bg-gray-200 w-full"
            onClick={() => navigate('/logout')}
          >
            <FaSignOutAlt className="mr-2" /> Log out
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileMenu;
