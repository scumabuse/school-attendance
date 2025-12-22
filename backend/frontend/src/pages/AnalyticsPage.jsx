import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { authHeaders } from '../api/auth';
import HeadTabs from '../components/HeadTabs';
import './AnalyticsPage.css';

const AnalyticsPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('academic_year');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [period]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/attendance/stats/summary?type=${period}`, {
        headers: { ...authHeaders() }
      });

      if (!res.ok) {
        console.error('Ошибка загрузки статистики');
        return;
      }

      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Ошибка загрузки аналитики:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Загрузка аналитики...</div>;
  if (!stats) return <div className="error">Данные недоступны</div>;

  const handleExport = async () => {
    try {
      setExporting(true);
      const allowed = ['academic_year', 'month', 'week', 'today'];
      const exportType = allowed.includes(period) ? period : 'academic_year';
      const res = await fetch(`${API_URL}/export/attendance?dateRangeType=${exportType}`, {
        headers: { ...authHeaders() }
      });

      if (!res.ok) {
        throw new Error('export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance_${exportType}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      alert('Не удалось выгрузить Excel. Попробуйте еще раз.');
    } finally {
      setExporting(false);
    }
  };

  const maxPercent = Math.max(...stats.groups.map(g => g.percent), 100);
  
  // Топ 3 лучших групп (лидеры)
  const leaders = stats.groups.slice(0, 3);
  // Топ 3 худших групп (аутсайдеры) - берем последние 3 и разворачиваем для отображения худшей первой
  const outsiders = stats.groups.slice(-3).reverse();

  return (
    <HeadTabs>
      <div className="analytics-modern">
        <div className="analytics-header">
          <h1>Аналитика посещаемости</h1>
          <div className="analytics-actions">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="period-select"
            >
              <option value="academic_year">Учебный год</option>
              <option value="semester1">1 семестр</option>
              <option value="semester2">2 семестр</option>
              <option value="month">Текущий месяц</option>
              <option value="week">Текущая неделя</option>
              <option value="today">Текущий день</option>
            </select>
            <button
              className="export-btn"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? 'Готовим файл...' : 'Экспорт в Excel'}
            </button>
          </div>
        </div>

        {/* Сводные карточки */}
        <div className="summary-grid">
          <div className="summary-item">
            <div className="summary-label">Средняя посещаемость</div>
            <div className={`summary-value ${stats.averagePercent >= 80 ? 'good' : stats.averagePercent >= 60 ? 'medium' : 'bad'}`}>
              {stats.averagePercent}%
            </div>
          </div>
          <div className="summary-item leaders-item">
            <div className="summary-label-lider">Лидеры</div>
            <div className="leaders-list">
              {leaders.length > 0 ? (
                leaders.map((group, index) => (
                  <div key={group.groupId} className="leader-item">
                    <span className="leader-rank">#{index + 1}</span>
                    <span className="leader-name">{group.groupName}</span>
                    <span className="leader-percent good">{group.percent}%</span>
                  </div>
                ))
              ) : (
                <div className="no-data">—</div>
              )}
            </div>
          </div>
          <div className="summary-item outsiders-item">
            <div className="summary-labe-loser">Аутсайдеры</div>
            <div className="outsiders-list">
              {outsiders.length > 0 ? (
                outsiders.map((group, index) => (
                  <div key={group.groupId} className="outsider-item">
                    <span className="outsider-rank">#{stats.groups.length - index}</span>
                    <span className="outsider-name">{group.groupName}</span>
                    <span className="outsider-percent bad">{group.percent}%</span>
                  </div>
                ))
              ) : (
                <div className="no-data">—</div>
              )}
            </div>
          </div>
        </div>

        {/* НОВАЯ ДВУХКОЛОНОЧНАЯ СЕКЦИЯ */}
        <div className="bottom-grid">
          {/* Левая колонка — бар-чарт */}
          <section className="chart-section">
            <h2>Посещаемость по группам</h2>
            <div className="bars-scroll-container">
              <div className="bars-list">
                {stats.groups.map((group) => {
                  const width = (group.percent / maxPercent) * 100;
                  const isGood = group.percent >= 80;
                  const isMedium = group.percent >= 60 && group.percent < 80;

                  return (
                    <div key={group.groupId} className="bar-item">
                      <div className="bar-header">
                        <span className="group-name">{group.groupName}</span>
                        <span className={`group-percent ${isGood ? 'good' : isMedium ? 'medium' : 'bad'}`}>
                          {group.percent}%
                        </span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${width}%`,
                            backgroundColor: isGood ? '#10b981' : isMedium ? '#f59e0b' : '#ef4444'
                          }}
                        />
                      </div>
                      <div className="bar-footer">
                        {group.studentsCount} студентов
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Правая колонка — таблица */}
          <section className="table-section">
            <h2>Детальная статистика</h2>
            <div className="table-scroll-container">
              <div className="table-wrapper">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Группа</th>
                      <th>Студентов</th>
                      <th>Посещаемость</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.groups.map((group) => {
                      const isGood = group.percent >= 80;
                      const isMedium = group.percent >= 60 && group.percent < 80;
                      return (
                        <tr key={group.groupId}>
                          <td className="group-name-cell">{group.groupName}</td>
                          <td>{group.studentsCount}</td>
                          <td>
                            <span className={`percent-text ${isGood ? 'good' : isMedium ? 'medium' : 'bad'}`}>
                              {group.percent}%
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${isGood ? 'good' : isMedium ? 'medium' : 'bad'}`}>
                              {isGood ? 'Отлично' : isMedium ? 'Хорошо' : 'Требует внимания'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </HeadTabs>
  );
};

export default AnalyticsPage;