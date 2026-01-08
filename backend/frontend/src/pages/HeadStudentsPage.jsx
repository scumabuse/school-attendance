import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config";
import { authHeaders, getUser } from "../api/auth";
import { getStudentAttendancePercent } from "../api/attendance";
import QrButton from "../components/QR/QRbutton";

const PAGE_SIZE = 100;

const HeadStudentsPage = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [percents, setPercents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("Все");
  const [selectedCourse, setSelectedCourse] = useState("Все");

  const [page, setPage] = useState(1);
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_URL}/students`, {
          headers: {
            ...authHeaders(),
            "Cache-Control": "no-cache",
          },
        });

        if (!res.ok) {
          throw new Error("Не удалось загрузить список учеников");
        }

        const data = await res.json();
        // Фильтруем только учеников из классов (1А-11В), скрываем остальных
        const classPattern = /^([1-9]|1[01])[А-В]$/;
        const filteredData = data.filter((s) => {
          if (!s.group?.name) return false;
          return classPattern.test(s.group.name);
        });
        setStudents(filteredData);

        // Загружаем проценты посещаемости КАЖДОГО студента за всё время (учебный год)
        const percentPromises = data.map(async (s) => {
          try {
            // без второго параметра используется тип academic_year (учебный год)
            const stats = await getStudentAttendancePercent(s.id);
            return { id: s.id, percent: stats.percent ?? null };
          } catch {
            return { id: s.id, percent: null };
          }
        });

        const percentResults = await Promise.all(percentPromises);
        const map = {};
        percentResults.forEach(({ id, percent }) => {
          map[id] = percent;
        });
        setPercents(map);
      } catch (err) {
        console.error(err);
        setError(err.message || "Ошибка загрузки учеников");
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  // Списки групп и курсов для фильтров
  const groupOptions = useMemo(() => {
    const names = new Set();
    students.forEach((s) => {
      if (s.group?.name) {
        names.add(s.group.name);
      }
    });
    return ["Все", ...Array.from(names).sort((a, b) => a.localeCompare(b, "ru-RU"))];
  }, [students]);

  const courseOptions = useMemo(() => {
    const courses = new Set();
    students.forEach((s) => {
      if (s.group?.course) {
        courses.add(s.group.course);
      }
    });
    const sorted = Array.from(courses).sort((a, b) => a - b);
    return ["Все", ...sorted];
  }, [students]);

  // Фильтрация
  const filteredStudents = useMemo(() => {
    let list = students;

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter((s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.group?.name?.toLowerCase().includes(q)
      );
    }

    if (selectedGroup !== "Все") {
      list = list.filter((s) => s.group?.name === selectedGroup);
    }

    if (selectedCourse !== "Все") {
      const courseNum = parseInt(selectedCourse, 10);
      list = list.filter((s) => s.group?.course === courseNum);
    }

    return list;
  }, [students, searchTerm, selectedGroup, selectedCourse]);

  // Пагинация
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));

  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, page]);

  // Сброс страницы при изменении фильтров/поиска
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedGroup, selectedCourse]);

  if (!user || user.role !== "HEAD") {
    return <div className="loading">Доступ только для заведующей</div>;
  }

  if (loading) {
    return <div className="loading">Загрузка списка учеников...</div>;
  }

  return (
    <div className="head-students-page">
      <button className="back-btn" onClick={() => navigate("/dashboard")}>
        ← Назад к дашборду
      </button>

      <h1>Все ученики</h1>
      <p className="subtitle">
        Всего: {students.length} · Отфильтровано: {filteredStudents.length}
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Поиск по ФИО или классу"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="search-icon" />
        </div>

        <select
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
        >
          {groupOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
        >
          {courseOptions.map((c) => (
            <option key={c} value={c}>
              {c === "Все" ? "Все классы" : `${c} класс`}
            </option>
          ))}
        </select>
      </div>

      <div className="students-table">
        <div className="students-header">
          <span>#</span>
          <span>ФИО</span>
          <span>Класс</span>
          <span>Класс (номер)</span>
          <span>Буква</span>
          <span>% за всё время</span>
        </div>
        {paginatedStudents.length === 0 ? (
          <div className="no-data">Ученики не найдены</div>
        ) : (
          paginatedStudents.map((s, index) => (
            <div key={s.id} className="students-row">
              <span>{(page - 1) * PAGE_SIZE + index + 1}</span>
              <span>{s.fullName}</span>
              <span>{s.group?.name || "—"}</span>
              <span>{s.group?.course || "—"}</span>
              <span>{s.group?.specialty?.name || "—"}</span>
              <span>
                {percents[s.id] === null || percents[s.id] === undefined
                  ? "—"
                  : `${percents[s.id]}%`}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="pagination">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ← Предыдущая
        </button>
        <span>
          Страница {page} из {totalPages}
        </span>
        <button
          disabled={page === totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Следующая →
        </button>
      </div>

      <style jsx>{`
        .head-students-page {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
          font-family: "Segoe UI", sans-serif;
          padding-bottom: 40px;
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

        .subtitle {
          color: #666;
          margin-bottom: 20px;
          font-size: 15px;
        }

        .error-banner {
          background: #ffebee;
          border: 1px solid #ef5350;
          color: #c62828;
          padding: 10px 14px;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .filters {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 20px;
        }

        .search-box {
          position: relative;
          flex: 1 1 260px;
          min-width: 220px;
          max-width: 420px;
        }

        .search-box input {
          width: 100%;
          padding: 10px 12px;
          padding-left: 34px;
          border-radius: 8px;
          border: 1px solid #ddd;
          font-size: 14px;
        }

        .search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid #888;
          box-sizing: border-box;
        }

        .search-icon::after {
          content: "";
          position: absolute;
          width: 8px;
          height: 2px;
          background: #888;
          transform: rotate(45deg);
          right: -6px;
          bottom: -1px;
        }

        select {
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid #ddd;
          font-size: 14px;
          min-width: 160px;
          flex: 0 0 auto;
        }

        .students-table {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
          overflow: hidden;
          width: 100%;
          position: relative;
        }

        .students-header,
        .students-row {
          display: grid;
          grid-template-columns: 60px 4fr 2fr 80px 3fr 80px;
          gap: 8px;
          padding: 10px 14px;
          align-items: center;
          font-size: 14px;
          box-sizing: border-box;
        }

        .students-header span,
        .students-row span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .students-row span:nth-child(2) {
          white-space: normal;
          word-break: break-word;
          overflow-wrap: break-word;
        }

        .students-header {
          background: #f5f5f5;
          font-weight: 600;
          color: #555;
        }

        .students-row:nth-child(odd) {
          background: #fcfcfc;
        }

        .students-row:nth-child(even) {
          background: #ffffff;
        }

        .no-data {
          padding: 20px;
          text-align: center;
          color: #777;
        }

        .pagination {
          margin-top: 16px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          font-size: 14px;
        }

        .pagination button {
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid #ddd;
          background: #f7f7f7;
          cursor: pointer;
        }

        .pagination button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loading {
          text-align: center;
          padding: 80px 20px;
          font-size: 18px;
          color: #777;
        }

        @media (max-width: 800px) {
          .head-students-page {
            padding: 16px 12px;
          }

          .filters {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }

          .search-box {
            width: 100%;
            min-width: 100%;
            max-width: 100%;
          }

          select {
            width: 100%;
            min-width: 100%;
          }

          .students-table {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .students-header,
          .students-row {
            grid-template-columns: 35px minmax(120px, 2fr) minmax(60px, 1fr) minmax(50px, 0.8fr) minmax(40px, 0.6fr) minmax(65px, 0.9fr);
            gap: 6px;
            padding: 10px 8px;
            font-size: 13px;
            min-width: 600px;
          }

          .students-header span:last-child,
          .students-row span:last-child {
            display: inline-block;
            min-width: 65px;
            text-align: right;
            white-space: nowrap;
            padding-left: 4px;
            box-sizing: border-box;
          }

          .students-header span:nth-child(5),
          .students-row span:nth-child(5) {
            min-width: 40px;
            text-align: center;
            white-space: nowrap;
            padding: 0 2px;
            box-sizing: border-box;
          }

          .students-header span,
          .students-row span {
            overflow: visible;
          }
        }

        @media (max-width: 640px) {
          .head-students-page {
            padding: 12px 8px;
          }

          h1 {
            font-size: 22px;
            margin-bottom: 6px;
          }

          .subtitle {
            font-size: 13px;
            margin-bottom: 16px;
          }

          .back-btn {
            font-size: 16px;
            margin-bottom: 12px;
          }

          .filters {
            gap: 8px;
          }

          .search-box input,
          select {
            padding: 8px 10px;
            font-size: 13px;
          }

          .students-table {
            border-radius: 8px;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .students-header,
          .students-row {
            grid-template-columns: 30px minmax(140px, 2.5fr) minmax(55px, 1fr) minmax(45px, 0.7fr) minmax(35px, 0.5fr) minmax(60px, 0.8fr);
            gap: 5px;
            padding: 8px 6px;
            font-size: 12px;
            min-width: 600px;
          }

          .students-header span,
          .students-row span {
            word-break: break-word;
            overflow-wrap: break-word;
          }

          .students-header span:last-child,
          .students-row span:last-child {
            min-width: 60px;
            font-weight: 600;
            font-size: 12px;
          }

          .students-header span:nth-child(5),
          .students-row span:nth-child(5) {
            min-width: 35px;
            font-weight: 500;
          }

          .pagination {
            flex-wrap: wrap;
            gap: 8px;
            font-size: 12px;
          }

          .pagination button {
            padding: 6px 10px;
            font-size: 12px;
          }
        }

        @media (max-width: 480px) {
          .head-students-page {
            padding: 10px 6px;
          }

          h1 {
            font-size: 20px;
          }

          .subtitle {
            font-size: 12px;
          }

          .students-header,
          .students-row {
            grid-template-columns: 28px minmax(150px, 3fr) minmax(50px, 0.9fr) minmax(40px, 0.6fr) minmax(32px, 0.4fr) minmax(55px, 0.7fr);
            gap: 4px;
            padding: 7px 5px;
            font-size: 11px;
            min-width: 550px;
          }

          .students-header span:last-child,
          .students-row span:last-child {
            min-width: 55px;
            font-size: 11px;
            padding-left: 2px;
          }

          .students-header span:nth-child(5),
          .students-row span:nth-child(5) {
            min-width: 32px;
            font-size: 11px;
          }

          .students-header span:nth-child(2),
          .students-row span:nth-child(2) {
            min-width: 150px;
          }
        }

        @media (max-width: 360px) {
          .head-students-page {
            padding: 8px 4px;
          }

          h1 {
            font-size: 18px;
          }

          .students-header,
          .students-row {
            grid-template-columns: 25px minmax(130px, 3fr) minmax(45px, 0.8fr) minmax(35px, 0.5fr) minmax(30px, 0.35fr) minmax(50px, 0.65fr);
            gap: 3px;
            padding: 6px 4px;
            font-size: 10px;
            min-width: 500px;
          }

          .students-header span:last-child,
          .students-row span:last-child {
            min-width: 50px;
            font-size: 10px;
            padding-left: 3px;
          }

          .students-header span:nth-child(5),
          .students-row span:nth-child(5) {
            min-width: 30px;
            font-size: 10px;
            padding: 0 1px;
          }

          .pagination {
            font-size: 11px;
          }

          .pagination button {
            padding: 5px 8px;
            font-size: 11px;
          }
        }

        /* Дополнительные улучшения для очень маленьких экранов */
        @media (max-width: 320px) {
          .head-students-page {
            padding: 6px 3px;
          }

          .students-header,
          .students-row {
            min-width: 480px;
            gap: 2px;
            padding: 5px 3px;
          }

          .students-header span:last-child,
          .students-row span:last-child {
            min-width: 48px;
            font-size: 9px;
          }

          .students-header span:nth-child(5),
          .students-row span:nth-child(5) {
            min-width: 28px;
            font-size: 9px;
          }
        }
      `}</style>
      {/* Плавающая кнопка QR для заведующей */}
      {user && user.role === 'HEAD' && (
        <QrButton user={user} />
      )}
    </div>
  );
};

export default HeadStudentsPage;


