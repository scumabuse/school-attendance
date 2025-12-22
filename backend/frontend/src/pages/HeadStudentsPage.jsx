import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config";
import { authHeaders, getUser } from "../api/auth";
import { getStudentAttendancePercent } from "../api/attendance";

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
  const [sortOrder, setSortOrder] = useState("none");

  const [page, setPage] = useState(1);
  const [user, setUser] = useState(null);

  const getStatusText = (percent) => {
    if (percent === null || percent === undefined) return "—";
    if (percent >= 80) return "Хорошо";
    if (percent >= 60) return "На грани";
    return "Требуется вмешательство";
  };

  const getStatusClass = (percent) => {
    if (percent === null || percent === undefined) return "";
    if (percent >= 80) return "status-good";
    if (percent >= 60) return "status-warning";
    return "status-danger";
  };

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
          throw new Error("Не удалось загрузить список студентов");
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
          throw new Error("Сервер вернул неверный формат данных");
        }
        setStudents(data);

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
        setError(err.message || "Ошибка загрузки студентов");
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

    if (sortOrder !== "none") {
      list = [...list].sort((a, b) => {
        const aPercent = percents[a.id] ?? -1;
        const bPercent = percents[b.id] ?? -1;
        if (sortOrder === "asc") {
          return aPercent - bPercent;
        } else {
          return bPercent - aPercent;
        }
      });
    }

    return list;
  }, [students, searchTerm, selectedGroup, selectedCourse, sortOrder, percents]);

  // Пагинация
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));

  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, page]);

  // Сброс страницы при изменении фильтров/поиска
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedGroup, selectedCourse, sortOrder]);

  if (!user || user.role !== "HEAD") {
    return <div className="loading">Доступ только для заведующей</div>;
  }

  if (loading) {
    return <div className="loading">Загрузка списка студентов...</div>;
  }

  return (
    <div className="head-students-page">
      <button className="back-btn" onClick={() => navigate("/dashboard")}>
        ← Назад к дашборду
      </button>

      <h1>Все студенты</h1>
      <p className="subtitle">
        Всего: {students.length} · Отфильтровано: {filteredStudents.length}
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Поиск по ФИО или группе"
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
              {c === "Все" ? "Все курсы" : `${c} курс`}
            </option>
          ))}
        </select>

        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        >
          <option value="none">Нет сортировки</option>
          <option value="asc">По возрастанию %</option>
          <option value="desc">По убыванию %</option>
        </select>
      </div>

      <div className="students-table">
        <div className="students-header">
          <span>#</span>
          <span>ФИО</span>
          <span>Группа</span>
          <span>Курс</span>
          <span>Специальность</span>
          <span>% за всё время</span>
          <span>Статус</span>
        </div>
        {paginatedStudents.length === 0 ? (
          <div className="no-data">Студенты не найдены</div>
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
              <span className={getStatusClass(percents[s.id])}>{getStatusText(percents[s.id])}</span>
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
          width: 90%;
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
        }

        .students-header,
        .students-row {
          display: grid;
          grid-template-columns: 60px 4fr 2fr 80px 3fr 80px 120px;
          gap: 8px;
          padding: 10px 14px;
          align-items: center;
          font-size: 14px;
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

        .status-good {
          color: green;
          font-weight: bold;
        }

        .status-warning {
          color: #ff9800;
          font-weight: bold;
        }

        .status-danger {
          color: red;
          font-weight: bold;
        }

        @media (max-width: 800px) {
          .filters {
            flex-direction: column;
            align-items: stretch;
          }

          .search-box {
            width: 100%;
          }

          .students-header,
          .students-row {
            grid-template-columns: 40px 3fr 2fr 60px 0 70px 0;
          }

          .students-header span:nth-child(6),
          .students-row span:nth-child(6) {
            display: inline-block;
          }
        }
      `}</style>
    </div>
  );
};

export default HeadStudentsPage;


