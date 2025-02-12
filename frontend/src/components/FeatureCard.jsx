import React from 'react';
import { FiActivity, FiUsers, FiPieChart } from 'react-icons/fi';

const iconMap = {
  "Analytics Overview": <FiPieChart className="w-6 h-6" />,
  "Team Members": <FiUsers className="w-6 h-6" />,
  "Recent Activity": <FiActivity className="w-6 h-6" />
};

const FeatureCard = ({ title, description }) => {
  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
      <div className="flex items-center mb-4">
        <div className="p-2 bg-gray-50 rounded-lg">
          {iconMap[title]}
        </div>
        <h3 className="text-lg font-semibold text-gray-800 ml-3">{title}</h3>
      </div>
      <p className="text-gray-600">{description}</p>
    </div>
  );
};

export default FeatureCard;