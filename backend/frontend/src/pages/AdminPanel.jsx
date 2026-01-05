import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { getUser } from '../api/auth';
import HeadTabs from '../components/HeadTabs';

const AdminPanel = () => {
    const [activeTab, setActiveTab] = useState('users');
    const user = getUser();

    if (!user || user.role !== 'ADMIN') {
        return (
            <HeadTabs>
                <div style={{ padding: '80px 20px', textAlign: 'center', color: '#c62828', fontSize: '20px' }}>
                    <h2>Доступ запрещён</h2>
                    <p>Админ-панель доступна только администратору системы.</p>
                    <Link to="/dashboard" style={{ color: '#1976d2' }}>← Вернуться на главную</Link>
                </div>
            </HeadTabs>
        );
    }

    const tabs = [
        { id: 'users', label: 'Пользователи' },
        { id: 'groups', label: 'Группы' },
        { id: 'specialties', label: 'Специальности' },
        { id: 'holidays', label: 'Праздники' },
        { id: 'practice', label: 'Дни практики' },
    ];

    const renderTab = () => {
        switch (activeTab) {
            case 'users':
                return <div><h3>Пользователи</h3><p>Список всех пользователей, создание, редактирование ролей, удаление.</p></div>;
            case 'groups':
                return <div><h3>Группы</h3><p>Управление группами, привязка кураторов (заведующих).</p></div>;
            case 'specialties':
                return <div><h3>Специальности</h3><p>Добавление, редактирование специальностей и квалификаций.</p></div>;
            case 'holidays':
                return <div><h3>Праздники</h3><p>Добавление и удаление праздничных дней (система блокирует отметку).</p></div>;
            case 'practice':
                return <div><h3>Дни практики</h3><p>Добавление практики по группе и диапазону дат (блокировка отметки).</p></div>;
            default:
                return null;
        }
    };

    return (
        <HeadTabs>
            <div className="admin-panel">
                <h1>Админ-панель</h1>
                <p style={{ color: '#666', marginBottom: '30px' }}>
                    Добро пожаловать, {user.fullName || user.login}!
                </p>

                <div className="admin-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="tab-content">
                    {renderTab()}
                </div>
            </div>

            <style jsx>{`
        .admin-panel {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        h1 {
          font-size: 32px;
          margin-bottom: 8px;
        }

        .admin-tabs {
          display: flex;
          gap: 12px;
          margin-bottom: 30px;
          flex-wrap: wrap;
        }

        .tab-btn {
          padding: 12px 24px;
          background: #f5f5f5;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s;
        }

        .tab-btn:hover {
          background: #e0e0e0;
        }

        .tab-btn.active {
          background: #1976d2;
          color: white;
        }

        .tab-content {
          background: white;
          padding: 30px;
          border-radius: 16px;
          box-shadow: 0 8px 25px rgba(0,0,0,0.1);
          min-height: 60vh;
        }

        h3 {
          margin-top: 0;
          color: #333;
        }
      `}</style>
        </HeadTabs>
    );
};

export default AdminPanel;