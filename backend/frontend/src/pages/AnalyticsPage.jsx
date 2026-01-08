import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { authHeaders } from '../api/auth';
import HeadTabs from '../components/HeadTabs';
import './AnalyticsPage.css';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const AnalyticsPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [exporting, setExporting] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [error, setError] = useState('');
  const [heads, setHeads] = useState([]);
  const [headsStats, setHeadsStats] = useState([]);
  const [chartSortOrder, setChartSortOrder] = useState('desc'); // сортировка баров
  const [tableSortOrder, setTableSortOrder] = useState('desc'); // сортировка таблицы

  // Установка дефолтных дат (неделя назад → сегодня)
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setCustomEnd(today);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setCustomStart(weekAgo);
  }, []);

  // Загрузка заведующих один раз
  useEffect(() => {
    const fetchHeads = async () => {
      try {
        const res = await fetch(`${API_URL}/users?role=HEAD`, {
          headers: { ...authHeaders() }
        });
        if (res.ok) {
          const data = await res.json();
          setHeads(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchHeads();
  }, []);

  // Расчёт статистики по заведующим
  useEffect(() => {
    if (stats && stats.groups && heads.length > 0) {
      const headsMap = {};
      stats.groups.forEach(g => {
        if (g.curatorId) {
          if (!headsMap[g.curatorId]) {
            headsMap[g.curatorId] = { percentSum: 0, count: 0 };
          }
          headsMap[g.curatorId].percentSum += g.percent;
          headsMap[g.curatorId].count += 1;
        }
      });

      const headsData = heads.map(h => {
        const headStats = headsMap[h.id] || { percentSum: 0, count: 0 };
        return {
          fullName: h.fullName || h.login,
          percent: headStats.count > 0 ? Math.round(headStats.percentSum / headStats.count) : 0,
          groupsCount: headStats.count
        };
      }).filter(h => h.groupsCount > 0);

      setHeadsStats(headsData.sort((a, b) => b.percent - a.percent));
    } else {
      setHeadsStats([]);
    }
  }, [stats, heads]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      params.append('type', period);

      if (period === 'custom') {
        if (!customStart || !customEnd) {
          setError('Выберите даты для кастомного периода');
          setLoading(false);
          return;
        }
        params.append('start', customStart);
        params.append('end', customEnd);
      }

      const res = await fetch(`${API_URL}/attendance/stats/summary?${params.toString()}`, {
        headers: { ...authHeaders() }
      });

      if (!res.ok) throw new Error(`Ошибка ${res.status}`);

      let data = await res.json();

      // Фильтрация групп на практике (только для today/week/month)
      if (['today', 'week', 'month'].includes(period)) {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);

        let startDate, endDate;
        if (period === 'today') {
          startDate = endDate = todayStr;
        } else if (period === 'week') {
          const start = new Date(now);
          start.setDate(now.getDate() - 6);
          startDate = start.toISOString().slice(0, 10);
          endDate = todayStr;
        } else if (period === 'month') {
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate = start.toISOString().slice(0, 10);
          endDate = todayStr;
        }

        const practiceRes = await fetch(
          `${API_URL}/practice-days/range?start=${startDate}&end=${endDate}`,
          { headers: { ...authHeaders() } }
        );

        if (practiceRes.ok) {
          const practiceGroups = await practiceRes.json();
          const practiceSet = new Set(practiceGroups.map(g => g.groupId));

          data.groups = data.groups.filter(g => !practiceSet.has(g.groupId));

          // Пересчёт средней и лучших/худших
          if (data.groups.length > 0) {
            data.averagePercent = Math.round(
              data.groups.reduce((sum, g) => sum + g.percent, 0) / data.groups.length
            );
          } else {
            data.averagePercent = 0;
          }

          const sorted = [...data.groups].sort((a, b) => b.percent - a.percent);
          data.bestGroup = sorted[0] || null;
          data.worstGroup = sorted[sorted.length - 1] || null;
        }
      }

      setStats(data);
    } catch (err) {
      console.error('Ошибка загрузки аналитики:', err);
      setError(err.message || 'Не удалось загрузить аналитику');
    } finally {
      setLoading(false);
    }
  };

  // Первичная загрузка
  useEffect(() => {
    fetchStats();
  }, []);

  // Перезагрузка при смене периода или кастомных дат
  useEffect(() => {
    fetchStats();
  }, [period, customStart, customEnd]);

  if (loading) return <div className="loading">Загрузка аналитики...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!stats || !stats.groups || stats.groups.length === 0) {
    return <div className="error">Нет данных для отображения</div>;
  }

  const handleExport = async () => {
    try {
      setExporting(true);

      const params = new URLSearchParams();

      if (period === 'custom') {
        if (!customStart || !customEnd) {
          alert('Выберите даты начала и конца');
          return;
        }
        params.append('startDate', customStart);
        params.append('endDate', customEnd);
        params.append('dateRangeType', 'custom');
      } else {
        const mapping = {
          today: 'today',
          week: 'week',
          month: 'month',
          academic_year: 'academic_year',
          semester1: 'semester1',
          semester2: 'semester2'
        };
        params.append('dateRangeType', mapping[period] || 'academic_year');
      }

      const url = `${API_URL}/export/attendance?${params.toString()}`;
      const res = await fetch(url, { headers: { ...authHeaders() } });

      if (!res.ok) throw new Error('Ошибка сервера при экспорте');

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      let filename = 'посещаемость';
      if (period === 'custom') {
        filename += `_${customStart}_по_${customEnd}`;
      } else {
        filename += `_${period}`;
      }
      link.download = `${filename}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      alert('Не удалось экспортировать. Проверьте период и попробуйте снова.');
    } finally {
      setExporting(false);
    }
  };

  // Сортировки
  const sortedGroupsForChart = [...stats.groups].sort((a, b) =>
    chartSortOrder === 'desc' ? b.percent - a.percent : a.percent - b.percent
  );

  const sortedGroupsForTable = [...stats.groups].sort((a, b) =>
    tableSortOrder === 'desc' ? b.percent - a.percent : a.percent - b.percent
  );

  const leaders = [...stats.groups].sort((a, b) => b.percent - a.percent).slice(0, 3);
  const outsiders = [...stats.groups].sort((a, b) => a.percent - b.percent).slice(0, 3).reverse();

  const maxPercent = Math.max(...stats.groups.map(g => g.percent), 100);

  // Расчет процента болеющих
  const groupsWithSickPercent = stats.groups.map(g => ({
    ...g,
    sickPercent: g.studentsCount > 0 ? Math.round((g.sickCount || 0) / g.studentsCount * 100) : 0
  }));

  // Общий процент болеющих
  const totalStudents = stats.groups.reduce((sum, g) => sum + (g.studentsCount || 0), 0);
  const totalSick = stats.groups.reduce((sum, g) => sum + (g.sickCount || 0), 0);
  const overallSickPercent = totalStudents > 0 ? Math.round((totalSick / totalStudents) * 100) : 0;

  // Топ 10 групп с наибольшим процентом болеющих
  const topSickGroups = [...groupsWithSickPercent]
    .sort((a, b) => b.sickPercent - a.sickPercent)
    .slice(0, 10);

  return (
    <HeadTabs>
      <div className="analytics-modern">
        <div className="analytics-header">
          <h1>Аналитика посещаемости</h1>
          <p className="period-subtitle">
            Период:{' '}
            <strong>
              {period === 'custom'
                ? `${customStart.replace(/-/g, '.')} → ${customEnd.replace(/-/g, '.')}`
                : {
                  academic_year: 'Учебный год',
                  semester1: '1 четверть',
                  semester2: '2 четверть',
                  month: 'Текущий месяц',
                  week: 'Текущая неделя',
                  today: 'Текущий день'
                }[period]}
            </strong>
          </p>
          <div className="analytics-actions">
            <div className="period-selector">
              <select
                value={period}
                onChange={(e) => {
                  const newPeriod = e.target.value;
                  setPeriod(newPeriod);
                  setShowCustomDates(newPeriod === 'custom');
                  if (newPeriod !== 'custom') {
                    setCustomStart('');
                    setCustomEnd('');
                  } else {
                    const today = new Date().toISOString().slice(0, 10);
                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                    setCustomStart(weekAgo);
                    setCustomEnd(today);
                  }
                }}
                className="period-select"
              >
                <option value="today">Текущий день</option>
                <option value="week">Текущая неделя</option>
                <option value="month">Текущий месяц</option>
                <option value="semester1">1 четверть</option>
                <option value="semester2">2 четверть</option>
                <option value="academic_year">Учебный год</option>
                <option value="custom">Кастомный период ←</option>
              </select>

              {showCustomDates && (
                <div className="custom-dates">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    max={customEnd}
                  />
                  <span style={{ margin: '0 8px' }}>—</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    min={customStart}
                  />
                </div>
              )}
            </div>

            <button
              className="export-btn"
              onClick={handleExport}
              disabled={exporting || (showCustomDates && (!customStart || !customEnd))}
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
              {leaders.map((group, index) => (
                <div key={group.groupId} className="leader-item">
                  <span className="leader-rank">#{index + 1}</span>
                  <span className="leader-name">{group.groupName}</span>
                  <span className="leader-percent good">{group.percent}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="summary-item outsiders-item">
            <div className="summary-labe-loser">Аутсайдеры</div>
            <div className="outsiders-list">
              {outsiders.map((group, index) => (
                <div key={group.groupId} className="outsider-item">
                  <span className="outsider-rank">#{stats.groups.length - index}</span>
                  <span className="outsider-name">{group.groupName}</span>
                  <span className="outsider-percent bad">{group.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Статистика по болеющим */}
        <div className="sick-stats-section">
          <div className="sick-overall">
            <div className="sick-overall-label">Общий процент болеющих</div>
            <div className="sick-overall-value">{overallSickPercent}%</div>
          </div>
          
          <div className="sick-top-groups">
            <h3>Топ 10 классов с наибольшим процентом болеющих</h3>
            <div className="sick-groups-list">
              {topSickGroups.map((group, index) => (
                <div key={group.groupId} className="sick-group-item">
                  <span className="sick-group-rank">#{index + 1}</span>
                  <span className="sick-group-name">{group.groupName}</span>
                  <span className="sick-group-percent">{group.sickPercent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Нижняя часть */}
        <div className="bottom-grid">
          {/* Бар-чарт */}
          <section className="chart-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2>Посещаемость по классам</h2>
              <select
                value={chartSortOrder}
                onChange={(e) => setChartSortOrder(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', backgroundColor: 'white' }}
              >
                <option value="desc">По убыванию</option>
                <option value="asc">По возрастанию</option>
              </select>
            </div>
            <div className="bars-scroll-container">
              <div className="bars-list">
                {sortedGroupsForChart.map((group) => {
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
                        {group.studentsCount} учеников
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Таблица */}
          <section className="table-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2>Детальная статистика</h2>
              <select
                value={tableSortOrder}
                onChange={(e) => setTableSortOrder(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', backgroundColor: 'white' }}
              >
                <option value="desc">По убыванию</option>
                <option value="asc">По возрастанию</option>
              </select>
            </div>
            <div className="table-scroll-container">
              <div className="table-wrapper">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Класс</th>
                      <th>Учеников</th>
                      <th>Посещаемость</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedGroupsForTable.map((group) => {
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

          {/* Диаграмма по заведующим */}
          <section className="heads-histogram">
            <h2>Посещаемость по заведующим</h2>
            {headsStats.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#777', padding: '40px' }}>
                Нет данных по заведующим
              </p>
            ) : (
              <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <Pie
                  data={{
                    labels: headsStats.map(h => h.fullName),
                    datasets: [
                      {
                        data: headsStats.map(h => h.percent),
                        backgroundColor: [
                          '#10b981', // зелёный
                          '#f59e0b', // жёлтый
                          '#ef4444', // красный
                          '#3b82f6', // синий
                          '#8b5cf6', // фиолетовый
                          '#ec4899', // розовый
                          '#14b8a6', // бирюзовый
                          '#f97316'  // оранжевый
                        ],
                        borderColor: '#fff',
                        borderWidth: 2,
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          padding: 20,
                          font: { size: 14 }
                        }
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            const head = headsStats[context.dataIndex];
                            return `${head.fullName}: ${head.percent}% (${head.groupsCount} групп)`;
                          }
                        }
                      }
                    }
                  }}
                />
                <div style={{ textAlign: 'center', marginTop: '20px', color: '#666' }}>
                  Всего заведующих: {headsStats.length}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </HeadTabs>
  );
};

export default AnalyticsPage;