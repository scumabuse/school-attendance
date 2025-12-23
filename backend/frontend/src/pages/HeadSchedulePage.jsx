import React, { useEffect, useState } from "react";
import HeadTabs from "../components/HeadTabs";
import { API_URL } from "../config";
import { authHeaders } from "../api/auth";

const dayNames = {
  1: "Понедельник",
  2: "Вторник",
  3: "Среда",
  4: "Четверг",
  5: "Пятница",
};

const defaultSchedules = [
  // Понедельник
  { dayOfWeek: 1, pairNumber: 0, startTime: "07:45", endTime: "08:05" },
  { dayOfWeek: 1, pairNumber: 1, startTime: "08:10", endTime: "09:40" },
  { dayOfWeek: 1, pairNumber: 2, startTime: "09:50", endTime: "11:20" },
  { dayOfWeek: 1, pairNumber: 3, startTime: "11:40", endTime: "13:10" },
  { dayOfWeek: 1, pairNumber: 4, startTime: "13:15", endTime: "14:45" },
  { dayOfWeek: 1, pairNumber: 5, startTime: "15:05", endTime: "16:35" },
  { dayOfWeek: 1, pairNumber: 6, startTime: "16:40", endTime: "18:10" },
  { dayOfWeek: 1, pairNumber: 7, startTime: "18:15", endTime: "19:45" },
  // Вторник–пятница (будет скопировано на 2..5)
  { dayOfWeek: 2, pairNumber: 1, startTime: "07:45", endTime: "09:15" },
  { dayOfWeek: 2, pairNumber: 2, startTime: "09:25", endTime: "10:55" },
  { dayOfWeek: 2, pairNumber: 3, startTime: "11:15", endTime: "12:45" },
  { dayOfWeek: 2, pairNumber: 4, startTime: "12:50", endTime: "14:20" },
  { dayOfWeek: 2, pairNumber: 5, startTime: "14:40", endTime: "16:10" },
  { dayOfWeek: 2, pairNumber: 6, startTime: "16:15", endTime: "17:45" },
  { dayOfWeek: 2, pairNumber: 7, startTime: "17:50", endTime: "19:20" },
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
                <td>{row.pairNumber === 0 ? "Классный час" : row.pairNumber}</td>
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
            <h1>Расписание пар</h1>
            <p className="subtitle">Управление временем пар (сокращёнки, замены)</p>
          </div>
          <div className="actions">
            <button className="secondary" onClick={handleSeed} disabled={saving}>
              Заполнить по умолчанию
            </button>
            <button className="primary" onClick={handleSave} disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </div>
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
      `}</style>
    </HeadTabs>
  );
};

export default HeadSchedulePage;

