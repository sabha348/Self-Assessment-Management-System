import React from 'react';
import '../pages/PdfViewer.css';

// Expected MarkerIcon component structure
const MarkerIcon = ({ marker, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="cursor-pointer w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg"
    >
      <span className="text-white">!</span>
    </div>
  );
};


export default MarkerIcon; 