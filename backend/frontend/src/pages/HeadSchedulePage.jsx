import React, { useEffect, useState } from "react";
import HeadTabs from "../components/HeadTabs";
import { API_URL } from "../config";
import { authHeaders, getUser } from "../api/auth";
import QrButton from "../components/QR/QRbutton";

const dayNames = {
  1: "Понедельник",
  2: "Вторник",
  3: "Среда",
  4: "Четверг",
  5: "Пятница",
};

const defaultSchedules = [
  // Понедельник
  { dayOfWeek: 1, pairNumber: 0, startTime: "08:00", endTime: "08:25" },
  { dayOfWeek: 1, pairNumber: 1, startTime: "08:30", endTime: "09:15" },
  { dayOfWeek: 1, pairNumber: 2, startTime: "09:20", endTime: "10:05" },
  { dayOfWeek: 1, pairNumber: 3, startTime: "10:20", endTime: "11:05" },
  { dayOfWeek: 1, pairNumber: 4, startTime: "11:15", endTime: "12:00" },
  { dayOfWeek: 1, pairNumber: 5, startTime: "12:15", endTime: "13:00" },
  { dayOfWeek: 1, pairNumber: 6, startTime: "13:10", endTime: "13:55" },
  { dayOfWeek: 1, pairNumber: 7, startTime: "14:00", endTime: "14:45" },
  { dayOfWeek: 1, pairNumber: 8, startTime: "14:50", endTime: "15:35" },
  // Вторник–пятница (будет скопировано на 2..5)
  { dayOfWeek: 2, pairNumber: 1, startTime: "08:00", endTime: "08:45" },
  { dayOfWeek: 2, pairNumber: 2, startTime: "08:50", endTime: "09:35" },
  { dayOfWeek: 2, pairNumber: 3, startTime: "09:50", endTime: "10:35" },
  { dayOfWeek: 2, pairNumber: 4, startTime: "10:45", endTime: "11:30" },
  { dayOfWeek: 2, pairNumber: 5, startTime: "11:45", endTime: "12:30" },
  { dayOfWeek: 2, pairNumber: 6, startTime: "12:40", endTime: "13:25" },
  { dayOfWeek: 2, pairNumber: 7, startTime: "13:30", endTime: "14:15" },
  { dayOfWeek: 2, pairNumber: 8, startTime: "14:20", endTime: "15:05" },
  { dayOfWeek: 2, pairNumber: 9, startTime: "15:10", endTime: "15:55" },
];

// Копируем вторник на среду-четверг-пятницу
const ensureDefaults = () => {
  const restDays = [3, 4, 5];
  const base = defaultSchedules.filter((s) => s.dayOfWeek === 2);
  const clones = restDays.flatMap((d) =>
    base.map((b) => ({ ...b, dayOfWeek: d }))
  );
  return [...defaultSchedules, ...clones];
};

const HeadSchedulePage = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");

  useEffect(() => {
    setUser(getUser());
    // Загружаем сохраненные шаблоны из localStorage
    const saved = localStorage.getItem('scheduleTemplates');
    if (saved) {
      try {
        const templates = JSON.parse(saved);
        setSavedTemplates(templates);
      } catch (e) {
        console.error('Ошибка загрузки шаблонов:', e);
      }
    }
  }, []);

  const grouped = () => {
    const map = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    schedules.forEach((s) => {
      if (map[s.dayOfWeek]) map[s.dayOfWeek].push(s);
    });
    Object.keys(map).forEach((k) =>
      map[k].sort((a, b) => a.pairNumber - b.pairNumber)
    );
    return map;
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/schedule`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) throw new Error("Не удалось загрузить расписание");
      const data = await res.json();
      setSchedules(data);
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (dayOfWeek, pairNumber, field, value) => {
    setSchedules((prev) => {
      const next = [...prev];
      const idx = next.findIndex(
        (s) => s.dayOfWeek === dayOfWeek && s.pairNumber === pairNumber
      );
      if (idx >= 0) {
        next[idx] = { ...next[idx], [field]: value };
      } else {
        next.push({ dayOfWeek, pairNumber, startTime: "", endTime: "", [field]: value });
      }
      return next;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch(`${API_URL}/schedule`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ items: schedules }),
      });
      if (!res.ok) throw new Error("Не удалось сохранить расписание");
      setMessage("Сохранено");
      fetchSchedules();
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const handleSeed = async () => {
    const items = ensureDefaults();
    try {
      setSaving(true);
      const res = await fetch(`${API_URL}/schedule`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error("Не удалось применить расписание по умолчанию");
      setMessage("Заполнено по умолчанию");
      fetchSchedules();
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      setMessage("Введите название шаблона");
      return;
    }
    const newTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      schedules: [...schedules],
      createdAt: new Date().toISOString()
    };
    const updated = [...savedTemplates, newTemplate];
    setSavedTemplates(updated);
    localStorage.setItem('scheduleTemplates', JSON.stringify(updated));
    setTemplateName("");
    setShowSaveTemplateModal(false);
    setMessage(`Шаблон "${newTemplate.name}" сохранен`);
    setTimeout(() => setMessage(""), 2000);
  };

  const handleLoadTemplate = (template) => {
    setSchedules(template.schedules);
    setSelectedTemplate(template.id);
    setMessage(`Загружен шаблон "${template.name}"`);
    setTimeout(() => setMessage(""), 2000);
  };

  const handleDeleteTemplate = (templateId) => {
    const updated = savedTemplates.filter(t => t.id !== templateId);
    setSavedTemplates(updated);
    localStorage.setItem('scheduleTemplates', JSON.stringify(updated));
    if (selectedTemplate === templateId) {
      setSelectedTemplate(null);
    }
    setMessage("Шаблон удален");
    setTimeout(() => setMessage(""), 2000);
  };

  const handleApplyTemplate = async (template) => {
    try {
      setSaving(true);
      const res = await fetch(`${API_URL}/schedule`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ items: template.schedules }),
      });
      if (!res.ok) throw new Error("Не удалось применить шаблон");
      setMessage(`Шаблон "${template.name}" применен`);
      fetchSchedules();
    } catch (err) {
      console.error(err);
      setMessage(err.message || "Ошибка применения шаблона");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 2000);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  if (loading) return <div className="loading">Загрузка расписания...</div>;

  const groups = grouped();

  const renderDay = (dayOfWeek) => {
    const rows = groups[dayOfWeek] || [];
    // Если пусто — показываем строки 0..7 для ввода
    const pairNumbers = rows.length > 0 ? rows.map((r) => r.pairNumber) : [];
    const baseList =
      rows.length > 0
        ? rows
        : Array.from({ length: 8 }, (_, i) => ({
            dayOfWeek,
            pairNumber: i === 0 ? 0 : i,
            startTime: "",
            endTime: "",
          })).filter((r) => r.pairNumber !== 0 || dayOfWeek === 1);

    return (
      <div className="day-card" key={dayOfWeek}>
        <h3>{dayNames[dayOfWeek]}</h3>
        <table className="schedule-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Начало</th>
              <th>Конец</th>
            </tr>
          </thead>
          <tbody>
            {baseList.map((row) => (
              <tr key={row.pairNumber}>
                <td>{row.pairNumber === 0 ? "Классный час" : `${row.pairNumber} урок`}</td>
                <td>
                  <input
                    type="time"
                    value={row.startTime || ""}
                    onChange={(e) =>
                      handleChange(dayOfWeek, row.pairNumber, "startTime", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    type="time"
                    value={row.endTime || ""}
                    onChange={(e) =>
                      handleChange(dayOfWeek, row.pairNumber, "endTime", e.target.value)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <HeadTabs>
      <div className="head-schedule">
        <div className="head-schedule__header">
          <div>
            <h1>Расписание уроков</h1>
            <p className="subtitle">Управление временем уроков (сокращёнки, замены)</p>
          </div>
          <div className="actions">
            <button className="secondary" onClick={handleSeed} disabled={saving}>
              По умолчанию
            </button>
            <button className="secondary" onClick={() => setShowSaveTemplateModal(true)} disabled={saving}>
              Сохранить шаблон
            </button>
            <button className="primary" onClick={handleSave} disabled={saving}>
              {saving ? "Сохранение..." : "Применить"}
            </button>
          </div>
        </div>
        
        {/* Сохраненные шаблоны */}
        {savedTemplates.length > 0 && (
          <div className="templates-section">
            <h3>Сохраненные шаблоны</h3>
            <div className="templates-grid">
              {savedTemplates.map((template) => (
                <div key={template.id} className="template-card">
                  <div className="template-header">
                    <span className="template-name">{template.name}</span>
                    <div className="template-actions">
                      <button 
                        className="template-btn load" 
                        onClick={() => handleLoadTemplate(template)}
                        title="Загрузить в редактор"
                      >
                        📝
                      </button>
                      <button 
                        className="template-btn apply" 
                        onClick={() => handleApplyTemplate(template)}
                        disabled={saving}
                        title="Применить к расписанию"
                      >
                        ✓
                      </button>
                      <button 
                        className="template-btn delete" 
                        onClick={() => handleDeleteTemplate(template.id)}
                        title="Удалить"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div className="template-date">
                    {new Date(template.createdAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Модальное окно сохранения шаблона */}
        {showSaveTemplateModal && (
          <div className="modal-overlay" onClick={() => setShowSaveTemplateModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Сохранить шаблон</h3>
              <input
                type="text"
                placeholder="Название шаблона (например: Сокращенный день)"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSaveTemplate()}
                autoFocus
              />
              <div className="modal-actions">
                <button className="secondary" onClick={() => {
                  setShowSaveTemplateModal(false);
                  setTemplateName("");
                }}>
                  Отмена
                </button>
                <button className="primary" onClick={handleSaveTemplate}>
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}
        {message && <div className="info-banner">{message}</div>}
        <div className="days-grid">
          {[1, 2, 3, 4, 5].map(renderDay)}
        </div>
      </div>
      <style jsx>{`
        .head-schedule {
          padding: 20px;
        }
        .head-schedule__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          gap: 12px;
        }
        .actions {
          display: flex;
          gap: 10px;
        }
        .primary,
        .secondary {
          padding: 10px 16px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-weight: 600;
        }
        .primary {
          background: #1976d2;
          color: #fff;
        }
        .secondary {
          background: #f5f5f5;
          color: #333;
          border: 1px solid #ddd;
        }
        .days-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }
        .day-card {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          padding: 12px;
        }
        .schedule-table {
          width: 100%;
          border-collapse: collapse;
        }
        .schedule-table th,
        .schedule-table td {
          border: 1px solid #e5e5e5;
          padding: 6px;
          text-align: center;
        }
        .schedule-table input {
          width: 100%;
          padding: 6px 8px;
          border: 1px solid #ddd;
          border-radius: 6px;
        }
        .info-banner {
          margin-bottom: 12px;
          padding: 10px 12px;
          background: #e3f2fd;
          border: 1px solid #90caf9;
          border-radius: 8px;
          color: #0d47a1;
        }
        .templates-section {
          margin-bottom: 24px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 12px;
        }
        .templates-section h3 {
          margin: 0 0 12px 0;
          color: #333;
          font-size: 18px;
        }
        .templates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 12px;
        }
        .template-card {
          background: white;
          border-radius: 8px;
          padding: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .template-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .template-name {
          font-weight: 600;
          color: #333;
        }
        .template-actions {
          display: flex;
          gap: 4px;
        }
        .template-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background 0.2s;
        }
        .template-btn:hover {
          background: #f0f0f0;
        }
        .template-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .template-date {
          font-size: 12px;
          color: #666;
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          background: white;
          padding: 24px;
          border-radius: 12px;
          min-width: 400px;
          max-width: 90%;
        }
        .modal-content h3 {
          margin: 0 0 16px 0;
          color: #333;
        }
        .modal-content input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 16px;
          box-sizing: border-box;
        }
        .modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
      `}</style>
      {/* Плавающая кнопка QR для заведующей */}
      {user && user.role === 'HEAD' && (
        <QrButton user={user} />
      )}
    </HeadTabs>
  );
};

export default HeadSchedulePage;

