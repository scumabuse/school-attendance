import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_URL } from "../config";
import { authHeaders, getUser } from "../api/auth";

const GroupStudentsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [students, setStudents] = useState([]);
  const [statuses, setStatuses] = useState({});
  // Храним количество секунд таймера опоздания для каждого студента
  const [lateMinutes, setLateMinutes] = useState({});
  const [lateTimers, setLateTimers] = useState({}); // Для хранения id таймеров по студентам
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isWeekendOrHoliday, setIsWeekendOrHoliday] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [exportPeriod, setExportPeriod] = useState("week");
  const [exporting, setExporting] = useState(false);
  const [user, setUser] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [currentPair, setCurrentPair] = useState(null);
  const prevPairRef = useRef(null);
  const [openOrderDropdown, setOpenOrderDropdown] = useState({});
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [isPractice, setIsPractice] = useState(false);
  const [practiceReason, setPracticeReason] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const fetchSchedule = async () => {
    try {
      const res = await fetch(`${API_URL}/schedule`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) throw new Error("Не удалось загрузить расписание");
      const data = await res.json();
      setSchedule(data);
    } catch (err) {
      console.error("Ошибка загрузки расписания:", err);
    }
  };

  // Проверка выходных и праздников
  const checkWeekendOrHoliday = async (date) => {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();

    // Проверка выходных (суббота = 6, воскресенье = 0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      setIsWeekendOrHoliday(true);
      setBlockReason("Выходной день");
      return true;
    }

    // Проверка праздников
    try {
      const holidaysRes = await fetch(`${API_URL}/holidays`, {
        headers: { ...authHeaders() }
      });
      if (holidaysRes.ok) {
        const holidays = await holidaysRes.json();
        const isHoliday = holidays.some(h => {
          const holidayDate = new Date(h.date).toISOString().slice(0, 10);
          return holidayDate === date;
        });
        if (isHoliday) {
          setIsWeekendOrHoliday(true);
          setBlockReason("Праздничный день");
          return true;
        }
      }
    } catch (err) {
      console.error("Ошибка проверки праздников:", err);
    }

    setIsWeekendOrHoliday(false);
    setBlockReason("");
    return false;
  };

  const checkPracticeDay = async (groupId, date) => {
    try {
      const res = await fetch(`${API_URL}/practice-days/check?groupId=${groupId}&date=${date}`, {
        headers: { ...authHeaders() }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.isPractice) {
          setIsPractice(true);
          setPracticeReason(data.name || "производственная практика");
        } else {
          setIsPractice(false);
          setPracticeReason("");
        }
      }
    } catch (err) {
      console.error("Ошибка проверки практики:", err);
    }
  };

  const fetchData = async () => {
    try {
      // Проверяем, не выходной ли сегодня
      await checkWeekendOrHoliday(today);
      await checkPracticeDay(id, today);

      const res = await fetch(`${API_URL}/students?groupId=${id}`, {
        headers: { ...authHeaders() },
      });

      if (!res.ok) throw new Error("Не удалось загрузить студентов");
      const data = await res.json();

      const list = data.filter((s) => String(s.groupId) === String(id));
      const groupInfo = list[0]?.group || null;

      setGroup(groupInfo);
      setStudents(list);

      // Загрузка текущей посещаемости
      const logRes = await fetch(
        `${API_URL}/attendance?groupId=${id}&date=${today}`,
        { headers: { ...authHeaders() } }
      );

      let initial = {};
      let initialLateMinutes = {};
      if (logRes.ok) {
        const logs = await logRes.json();
        logs.forEach((item) => {
          initial[item.studentId] = item.status || "none";
          if (item.status === "LATE" && item.lateMinutes !== null && item.lateMinutes !== undefined) {
            // В БД лежат минуты опоздания, для таймера переводим в секунды
            initialLateMinutes[item.studentId] = item.lateMinutes * 60;
          }
        });
      }

      list.forEach((s) => {
        if (!initial[s.id]) initial[s.id] = "none";
      });
      setStatuses(initial);
      setLateMinutes(initialLateMinutes);
    } catch (err) {
      console.error(err);
      setMessage("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setCustomEnd(today);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setCustomStart(weekAgo);
  }, []);

  useEffect(() => {
    setUser(getUser());
    if (id) fetchData();
    fetchSchedule();
    // При размонтировании страницы — очищаем все таймеры
    return () => {
      Object.values(lateTimers).forEach((timerId) => {
        clearInterval(timerId);
      });
    };
  }, [id]);

  const timeToMinutes = (str) => {
    if (!str || !str.includes(":")) return null;
    const [h, m] = str.split(":").map((v) => parseInt(v, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const detectCurrentPair = () => {
    if (!schedule || schedule.length === 0) return null;
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const dayOfWeek = day === 0 ? 7 : day; // Пн=1 ... Вс=7
    const minutes = now.getHours() * 60 + now.getMinutes();
    const todaySchedule = schedule.filter(
      (s) => s.dayOfWeek === dayOfWeek && s.pairNumber !== 0
    );
    for (const s of todaySchedule) {
      const start = timeToMinutes(s.startTime);
      const end = timeToMinutes(s.endTime);
      if (start !== null && end !== null && minutes >= start && minutes < end) {
        return s.pairNumber;
      }
    }
    return null;
  };

  // Сбрасываем отметки при смене пары
  useEffect(() => {
    if (students.length === 0 || schedule.length === 0) return;

    const checkPair = () => {
      const newPair = detectCurrentPair();
      if (newPair !== prevPairRef.current) {
        console.log('Смена пары:', prevPairRef.current, '→', newPair);
        prevPairRef.current = newPair;
        setCurrentPair(newPair);

        // СБРАСЫВАЕМ ВСЕ ОТМЕТКИ
        setStatuses(prev => {
          const reset = {};
          students.forEach(s => {
            reset[s.id] = "none";
          });
          return reset;
        });

        // Очищаем таймеры опозданий (если были)
        Object.values(lateTimers).forEach(clearInterval);
        setLateTimers({});
        setLateMinutes({});
      }
    };

    checkPair(); // проверка сразу
    const interval = setInterval(checkPair, 30000); // каждые 30 секунд

    return () => clearInterval(interval);
  }, [students, schedule]); // ← только эти зависимости!

  const toggleStatus = async (studentId, status) => {
    // Проверка на выходной/праздник
    if (isWeekendOrHoliday) {
      setMessage(`Нельзя отметить посещаемость: ${blockReason}`);
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    const currentStatus = statuses[studentId] || "none";

    // Для всех статусов, включая LATE: обычное переключение (без таймера)
    const newStatus = currentStatus === status ? "none" : status;

    // Если до этого был статус LATE — останавливаем таймер и сбрасываем минуты
    if (currentStatus === "LATE" && lateTimers[studentId]) {
      clearInterval(lateTimers[studentId]);
      setLateTimers((prev) => {
        const copy = { ...prev };
        delete copy[studentId];
        return copy;
      });
      setLateMinutes((prev) => {
        const copy = { ...prev };
        delete copy[studentId];
        return copy;
      });
    }

    setStatuses((prev) => ({
      ...prev,
      [studentId]: newStatus,
    }));
  };

  const counts = students.reduce(
    (acc, s) => {
      const st = statuses[s.id] || "none";
      if (st === "PRESENT") acc.present++;
      else if (st === "ABSENT") acc.absent++;
      else if (st === "SICK") acc.sick++;
      else if (st === "VALID_ABSENT") acc.valid++;
      else if (st === "ITHUB") acc.wsk++;
      else if (st === "DUAL") acc.dual++;
      else if (st === "LATE") acc.late++;
      else if (st === "REMOTE") acc.remote++;
      else acc.none++;
      return acc;
    },
    { present: 0, absent: 0, sick: 0, valid: 0, wsk: 0, dual: 0, late: 0, remote: 0, none: 0 }
  );

  const handleSave = async () => {
    setMessage("");

    // Проверка на выходной/праздник/практику
    if (isWeekendOrHoliday || isPractice) {
      setMessage(`Нельзя сохранить посещаемость: ${blockReason || practiceReason}`);
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    if (!currentPair) {
      setMessage("Нет текущей пары — отметка недоступна");
      return;
    }

    const records = Object.entries(statuses)
      .filter(([, v]) => v && v !== "none")
      .map(([sid, status]) => {
        const record = {
          studentId: sid,
          groupId: id,
          date: today,
          status,
          lessonId: currentPair  // ←←← ДОБАВЬ ЭТУ СТРОКУ
        };

        // Для LATE, если нужно (но у тебя таймер выключен)
        return record;
      });

    if (records.length === 0) {
      setMessage("Никто не отмечен");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`${API_URL}/attendance/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ records }),
      });

      if (response.ok) {
        const result = await response.json();
        setMessage("Посещаемость сохранена!");
        fetchData(); // обновляем
        window.dispatchEvent(new Event("attendanceSaved"));
        navigate("/dashboard", { state: { scrollToGroupId: id } });
      } else {
        const err = await response.json();
        setMessage(err.error || "Ошибка сохранения");
      }
    } catch (err) {
      setMessage("Нет соединения с сервером");
    } finally {
      setSaving(false);
    }
  };

  const handleExportGroup = async () => {
    try {
      setExporting(true);

      const params = new URLSearchParams();
      params.append('groupIds', id); // экспорт только этой группы

      if (exportPeriod === 'custom') {
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
          semester1: 'semester1',
          semester2: 'semester2',
          academic_year: 'academic_year'
        };
        params.append('dateRangeType', mapping[exportPeriod] || 'week');
      }

      const res = await fetch(`${API_URL}/export/attendance?${params.toString()}`, {
        headers: { ...authHeaders() }
      });

      if (!res.ok) {
        throw new Error('Ошибка экспорта');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      let filename = `посещаемость_${group?.name || 'группа'}`;
      if (exportPeriod === 'custom') {
        filename += `_${customStart.replace(/-/g, '.')}_по_${customEnd.replace(/-/g, '.')}`;
      } else {
        const names = {
          today: 'сегодня',
          week: 'неделя',
          month: 'месяц',
          semester1: '1_семестр',
          semester2: '2_семестр',
          academic_year: 'учебный_год'
        };
        filename += `_${names[exportPeriod] || exportPeriod}`;
      }
      filename += '.xlsx';

      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка экспорта группы:', error);
      alert('Не удалось экспортировать группу.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="loading">Загрузка группы...</div>;
  if (!group) return <div>Группа не найдена</div>;

  return (
    <>
      <div className="group-attendance">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Назад
        </button>

        <h1>Группа {group.name}</h1>
        <p className="total">
          Всего студентов: {students.length} · Сегодня: {today}
          {currentPair !== null && <strong> · Текущая пара: {currentPair}</strong>}
          {currentPair === null && <em> · Пара не определена (вне расписания)</em>}
        </p>
        {user?.role === 'HEAD' && (
          <div className="export-group-container">
            <div className="period-selector">
              <select
                className="export-period-select"
                value={exportPeriod}
                onChange={(e) => {
                  setExportPeriod(e.target.value);
                  setShowCustomDates(e.target.value === 'custom');
                }}
              >
                <option value="today">Сегодня</option>
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
                <option value="semester1">1 семестр</option>
                <option value="semester2">2 семестр</option>
                <option value="academic_year">Учебный год</option>
                <option value="custom">Кастомный период ←</option>
              </select>

              {showCustomDates && (
                <div className="custom-dates">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    max={customEnd || today}
                  />
                  <span style={{ margin: '0 8px' }}>—</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    min={customStart}
                    max={today}
                  />
                </div>
              )}
            </div>
            <button
              className="export-group-btn"
              onClick={handleExportGroup}
              disabled={exporting || (showCustomDates && (!customStart || !customEnd))}
            >
              {exporting ? 'Экспорт...' : '📊 Экспорт в Excel'}
            </button>
          </div>
        )}

        {isWeekendOrHoliday && (
          <div className="warning-banner">
            ⚠️ {blockReason} — отметка посещаемости недоступна
          </div>
        )}
        {isPractice && (
          <div className="warning-banner practice-banner">
            У группы {practiceReason} — отметка посещаемости недоступна
          </div>
        )}

        <div className="students-list">
          {students.map((student) => {
            const currentStatus = statuses[student.id] || "none";

            return (
              <div key={student.id} className="student-row">
                <div className="student-name">{student.fullName}</div>
                <div className="status-buttons">
                  <button
                    className={`status-btn present ${currentStatus === "PRESENT" ? "active" : ""}`}
                    onClick={() => toggleStatus(student.id, "PRESENT")}
                    disabled={isPractice || isWeekendOrHoliday}
                  >
                    Присутствует
                  </button>
                  <button
                    className={`status-btn sick ${currentStatus === "SICK" ? "active" : ""}`}
                    onClick={() => toggleStatus(student.id, "SICK")}
                    disabled={isPractice || isWeekendOrHoliday}
                  >
                    Больничный
                  </button>
                  <button
                    className={`status-btn dual ${currentStatus === "DUAL" ? "active" : ""}`}
                    onClick={() => toggleStatus(student.id, "DUAL")}
                    disabled={isPractice || isWeekendOrHoliday}
                  >
                    Дуальное обучение
                  </button>
                  <button
                    className={`status-btn wsk ${currentStatus === "ITHUB" ? "active" : ""}`}
                    onClick={() => toggleStatus(student.id, "ITHUB")}
                    disabled={isPractice || isWeekendOrHoliday}
                  >
                    IT HUB
                  </button>
                  <button
                    className={`status-btn remote ${currentStatus === "REMOTE" ? "active" : ""}`}
                    onClick={() => toggleStatus(student.id, "REMOTE")}
                    disabled={isPractice || isWeekendOrHoliday}
                  >
                    Дистант
                  </button>
                  <div className="status-dropdown-container">
                    <button
                      className={`status-btn dropdown-btn ${currentStatus === "VALID_ABSENT" || currentStatus === "LATE" ? "active" : ""}`}
                      onClick={() => setOpenOrderDropdown(prev => ({
                        ...prev,
                        [student.id]: !prev[student.id]
                      }))}
                      disabled={isPractice || isWeekendOrHoliday}
                    >
                      {currentStatus === "VALID_ABSENT" ? "По приказу" : currentStatus === "LATE" ? "По заявлению" : "Ув. Причина"}
                      <span className="dropdown-arrow-btn">▼</span>
                    </button>
                    {openOrderDropdown[student.id] && (
                      <div className="status-dropdown-menu">
                        <button
                          className={`status-dropdown-item ${currentStatus === "VALID_ABSENT" ? "active" : ""}`}
                          onClick={() => {
                            toggleStatus(student.id, "VALID_ABSENT");
                            setOpenOrderDropdown(prev => ({ ...prev, [student.id]: false }));
                          }}
                          disabled={isPractice || isWeekendOrHoliday}
                        >
                          По приказу
                        </button>
                        <button
                          className={`status-dropdown-item ${currentStatus === "LATE" ? "active" : ""}`}
                          onClick={() => {
                            toggleStatus(student.id, "LATE");
                            setOpenOrderDropdown(prev => ({ ...prev, [student.id]: false }));
                          }}
                          disabled={isPractice || isWeekendOrHoliday}
                        >
                          По заявлению
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    className={`status-btn absent ${currentStatus === "ABSENT" ? "active" : ""}`}
                    onClick={() => toggleStatus(student.id, "ABSENT")}
                    disabled={isPractice || isWeekendOrHoliday}
                  >
                    Без причины
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Фиксированная нижняя панель */}
        <div className="bottom-bar">
          <div className="stats-summary">
            <span className="stat-item present">Присутствует {counts.present}</span>
            <span className="stat-item sick">Больничный {counts.sick}</span>
            <span className="stat-item dual">Дуальное обучение {counts.dual}</span>
            <span className="stat-item wsk">IT HUB {counts.wsk}</span>
            <span className="stat-item valid">По приказу {counts.valid}</span>
            <span className="stat-item late">По заявлению {counts.late}</span>
            <span className="stat-item absent">Без причины {counts.absent}</span>
            <span className="stat-item remote">Дистант {counts.remote}</span>
            <span className="stat-item unmarked">Не отмечено {counts.none}</span>
          </div>

          <button
            className="save-btn"
            onClick={handleSave}
            disabled={saving || counts.none === students.length || isWeekendOrHoliday || isPractice}
          >
            {saving ? "Сохраняется..." : "Сохранить посещаемость"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .group-attendance {
          padding: 20px;
          max-width: 1000px;
          margin: 0 auto;
          font-family: 'Segoe UI', sans-serif;
          padding-bottom: 240px;
        }

        .back-btn {
          background: none;
          border: none;
          font-size: 18px;
          color: #1976d2;
          cursor: pointer;
          margin-bottom: 16px;
          padding: 0;
        }

        h1 {
          margin: 0;
          margin-bottom: 8px;
          color: #333;
          font-size: 26px;
        }

        .total {
          color: #666;
          margin-bottom: 24px;
          font-size: 15px;
        }

        .export-group-container {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 8px;
          align-items: center;
        }

        .export-period-select {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          background: white;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .export-period-select:hover {
          border-color: #1976d2;
        }

        .export-period-select:focus {
          outline: none;
          border-color: #1976d2;
          box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.1);
        }

        .export-group-btn {
          padding: 10px 20px;
          background: #4caf50;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .export-group-btn:hover:not(:disabled) {
          background: #45a049;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
        }

        .export-group-btn:disabled {
          background: #aaa;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .students-list {
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }

        .student-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #f0f0f0;
          flex-wrap: wrap;
          gap: 12px;
        }

        .student-row:last-child {
          border-bottom: none;
        }

        .student-name {
          font-weight: 500;
          font-size: 16px;
          min-width: 200px;
          max-width: 100%;
          color: #333;
          word-break: break-word;
        }

        .status-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .status-btn {
          padding: 7px 14px;
          border: 1.5px solid #ddd;
          border-radius: 30px;
          background: #f8f9fa;
          font-size: 13.5px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .status-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .status-btn.active {
          font-weight: 600;
          border-color: transparent !important;
        }

        .status-btn.present.active { background: #c8e6c9; color: #2e7d32; }
        .status-btn.absent.active { background: #ffcdd2; color: #c62828; }
        .status-btn.sick.active    { background: #fff3e0; color: #ef6c00; }
        .status-btn.valid.active   { background: #bbdefb; color: #1565c0; }
        .status-btn.wsk.active     { background: #e1bee7; color: #7b1fa2; }
        .status-btn.dual.active    { background: #b3e5fc; color: #0277bd; }
        .status-btn.late.active    { background: #ffe0b2; color: #e65100; }
        .status-btn.remote.active  { background: #d1c4e9; color: #512da8; }

        .status-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .warning-banner {
          background: #fff3cd;
          border: 1px solid #ffc107;
          color: #856404;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-weight: 500;
        }
          

        .status-dropdown-container {
          position: relative;
          display: inline-block;
        }

        .dropdown-btn {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .dropdown-arrow-btn {
          font-size: 10px;
          transition: transform 0.2s ease;
        }

        .status-dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 1000;
          min-width: 150px;
          overflow: hidden;
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .status-dropdown-item {
          display: block;
          width: 100%;
          padding: 10px 14px;
          border: none;
          background: white;
          text-align: left;
          font-size: 13.5px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
          border-radius: 0;
        }

        .status-dropdown-item:hover {
          background: #f5f5f5;
        }

        .status-dropdown-item.active {
          background: #ffe0b2;
          color: #e65100;
        }

        .status-dropdown-item:first-child {
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
        }

        .status-dropdown-item:last-child {
          border-bottom-left-radius: 8px;
          border-bottom-right-radius: 8px;
        }

        .warning-banner {
          background: #fff3cd;
          border: 1px solid #ffc107;
          color: #856404;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-weight: 500;
        }

        .bottom-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: white;
          padding: 16px 20px;
          box-shadow: 0 -6px 20px rgba(0,0,0,0.12);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          z-index: 1000;
          box-sizing: border-box;
        }

        .stats-summary {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 14.5px;
        }

        .stat-item {
          padding: 8px 14px;
          border-radius: 30px;
          font-weight: 600;
          white-space: nowrap;
        }

        .stat-item.present { background: #c8e6c9; color: #2e7d32; }
        .stat-item.absent { background: #ffcdd2; color: #c62828; }
        .stat-item.valid  { background: #bbdefb; color: #1565c0; }
        .stat-item.sick   { background: #fff3e0; color: #ef6c00; }
        .stat-item.wsk    { background: #e1bee7; color: #7b1fa2; }
        .stat-item.dual   { background: #b3e5fc; color: #0277bd; }
        .stat-item.late   { background: #ffe0b2; color: #e65100; }
        .stat-item.remote { background: #d1c4e9; color: #512da8; }
        .stat-item.unmarked { background: #e0e0e0; color: #424242; }

        .save-btn {
          background: #1976d2;
          color: white;
          border: none;
          padding: 14px 36px;
          border-radius: 30px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: background 0.2s;
        }

        .practice-banner {
          background: #e3f2fd;
          border: 1px solid #2196f3;
          color: #1565c0;
        }

        .save-btn:hover:not(:disabled) {
          background: #1565c0;
        }

        .save-btn:disabled {
          background: #aaa;
          cursor: not-allowed;
        }

        .loading {
          text-align: center;
          padding: 80px 20px;
          font-size: 18px;
          color: #777;
        }

        @media (max-width: 640px) {
          .group-attendance {
            padding: 16px;
            padding-bottom: 200px;
          }

          .student-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          .status-buttons {
            width: 100%;
            justify-content: flex-start;
            flex-wrap: wrap;
          }
          .bottom-bar {
            padding: 16px;
            flex-direction: column;
            align-items: stretch;
          }
          .stats-summary {
            justify-content: center;
            flex-wrap: wrap;
            gap: 8px;
          }
          .save-btn {
            width: 100%;
          }
        }

        @media (max-width: 430px) {
          .group-attendance {
            padding: 12px;
            padding-bottom: 180px;
          }

          h1 {
            font-size: 20px;
            margin-bottom: 6px;
          }

          .total {
            font-size: 13px;
            margin-bottom: 16px;
          }

          .back-btn {
            font-size: 16px;
            margin-bottom: 12px;
          }

          .export-group-container {
            flex-direction: column;
            gap: 8px;
            padding: 10px;
          }

          .export-period-select {
            padding: 8px 10px;
            font-size: 14px;
          }

          .export-group-btn {
            padding: 8px 16px;
            font-size: 13px;
          }

          .custom-dates {
            flex-direction: column;
            gap: 8px;
            width: 100%;
          }

          .custom-dates input {
            width: 100%;
            padding: 8px;
            font-size: 14px;
          }

          .custom-dates span {
            display: none;
          }

          .warning-banner {
            padding: 10px 12px;
            font-size: 13px;
            margin-bottom: 16px;
          }

          .student-row {
            padding: 12px 16px;
            gap: 10px;
          }

          .student-name {
            font-size: 14px;
            min-width: unset;
            max-width: 100%;
          }

          .status-buttons {
            gap: 6px;
          }

          .status-btn {
            padding: 6px 12px;
            font-size: 12px;
            border-radius: 20px;
          }

          .dropdown-btn {
            font-size: 12px;
          }

          .status-dropdown-menu {
            min-width: 140px;
          }

          .status-dropdown-item {
            padding: 8px 12px;
            font-size: 12px;
          }

          .bottom-bar {
            padding: 12px;
            gap: 12px;
          }

          .stats-summary {
            font-size: 12px;
            gap: 6px;
          }

          .stat-item {
            padding: 6px 10px;
            font-size: 12px;
          }

          .save-btn {
            padding: 12px 24px;
            font-size: 14px;
          }

          .loading {
            padding: 60px 20px;
            font-size: 16px;
          }
        }
      `}</style>
    </>
  );
};

export default GroupStudentsPage;