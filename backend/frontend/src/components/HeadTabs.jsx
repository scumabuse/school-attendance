import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './HeadTabs.css';

const HeadTabs = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const isAnalytics = location.pathname === '/dashboard/analytics';
  const isStudents = location.pathname === '/head/students';
  const isGroups = !isAnalytics && !isStudents; // Если не аналитика и не студенты, то группы

  return (
    <div className="head-tabs-container">
      <div className="head-tabs">
        <button
          className={`tab-button ${isGroups ? 'active' : ''}`}
          onClick={() => navigate('/dashboard')}
        >
          Группы
        </button>
        <button
          className={`tab-button ${isAnalytics ? 'active' : ''}`}
          onClick={() => navigate('/dashboard/analytics')}
        >
          Аналитика
        </button>
        <button
          className={`tab-button ${isStudents ? 'active' : ''}`}
          onClick={() => navigate('/head/students')}
        >
          Студенты
        </button>
      </div>
      <div className="tab-content">
        {children}
      </div>
    </div>
  );
};

export default HeadTabs;

