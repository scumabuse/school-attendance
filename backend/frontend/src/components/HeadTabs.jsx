import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './HeadTabs.css';
import { getUser } from '../api/auth'; // ←←← ДОБАВЬ ЭТУ СТРОКУ

const HeadTabs = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  
  const isAnalytics = location.pathname === '/dashboard/analytics';
  const isStudents = location.pathname === '/head/students';
  const isSchedule = location.pathname === '/head/schedule';
  const isGroups = !isAnalytics && !isStudents && !isSchedule; // Если не аналитика, не студенты и не расписание, то группы

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
          Ученики
        </button>
        {user?.role === 'HEAD' && (
          <button
            className={`tab-button ${isSchedule ? 'active' : ''}`}
            onClick={() => navigate('/head/schedule')}
          >
            Расписание
          </button>
        )}

        {user?.role === 'ADMIN' && (
        <button
          className={`tab-button ${location.pathname === '/admin' ? 'active' : ''}`}
          onClick={() => navigate('/admin')}
        >
          Админ-панель
        </button>
      )}
      </div>
      <div className="tab-content">
        {children}
      </div>
    </div>
  );
};

export default HeadTabs;

