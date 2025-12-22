import React, { useState, useEffect } from "react";
import "./Dashboard.css";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config";
import { authHeaders, getUser, logout } from "../api/auth";
import { getGroupAttendancePercent } from "../api/attendance";
import HeadTabs from "../components/HeadTabs";
import QrButton from "../components/QR/QRbutton";
import ConfirmModal from "../components/ConfirmModal";
import { useLocation } from "react-router-dom";
import { useRef } from "react";

const TeacherDashboard = () => {
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('Все');
  const [selectedCourse, setSelectedCourse] = useState('Все');
  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const pendingScrollGroupRef = useRef(null);
  const pendingScrollPosRef = useRef(null);




  // Загрузка данных
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setTeacher(getUser());
        const [resStudents, resLogs] = await Promise.all([
          fetch(`${API_URL}/students`, {
            headers: {
              ...authHeaders(),
              "Content-Type": "application/json",
              "Cache-Control": "no-cache"
            }
          }),
          fetch(
            `${API_URL}/attendance/log?date=${new Date()
              .toISOString()
              .slice(0, 10)}`,
            {
              headers: {
                ...authHeaders(),
                "Cache-Control": "no-cache"
              }
            }
          )
        ]);

        if (!resStudents.ok) {
          console.error("Ошибка загрузки студентов");
          setGroups([]);
          setSpecialties(["Все"]);
          return;
        }

        const dataStudents = await resStudents.json();
        const logs = resLogs.ok ? await resLogs.json() : [];

        const grouped = {};

        dataStudents.forEach((student) => {
          const group = student.group || {};
          if (!group.id) return;
          const gid = String(group.id);
          if (!grouped[gid]) {
            grouped[gid] = {
              id: group.id,
              name: group.name,
              course: group.course,
              specialty: group.specialty || {},
              students: [],
              stats: null
            };
          }
          grouped[gid].students.push(student);
        });

        // Добавляем статистику по сегодняшним логам
        logs.forEach((log) => {
          const gid = String(log.groupId);
          const g = grouped[gid];
          if (!g) return;
          if (!g.stats) {
            g.stats = { present: 0, absent: 0, sick: 0, valid: 0, wsk: 0, dual: 0, late: 0, marked: 0, unmarked: 0 };
          }
          g.stats.marked += 1;
          if (log.status === "PRESENT") g.stats.present += 1;
          if (log.status === "ABSENT") g.stats.absent += 1;
          if (log.status === "SICK") g.stats.sick += 1;
          if (log.status === "VALID_ABSENT") g.stats.valid += 1;
          if (log.status === "ITHUB") g.stats.wsk += 1;
          if (log.status === "DUAL") g.stats.dual += 1;
          if (log.status === "LATE") g.stats.late += 1;
        });

        Object.values(grouped).forEach((g) => {
          if (!g.stats) {
            g.stats = { present: 0, absent: 0, sick: 0, valid: 0, wsk: 0, dual: 0, late: 0, marked: 0, unmarked: g.students.length };
          } else {
            g.stats.unmarked = Math.max(g.students.length - g.stats.marked, 0);
          }
        });

        const groupsList = Object.values(grouped);

        // Для заведующей считаем ПРОЦЕНТ ЗА СЕГОДНЯ исходя из статистики по статусам:
        // присутствующие = PRESENT, VALID_ABSENT, ITHUB, DUAL, LATE;
        // в знаменатель входят все выше + ABSENT; SICK не учитывается.
        const currentUser = getUser();
        if (currentUser && currentUser.role === 'HEAD') {
          groupsList.forEach((g) => {
            const s = g.stats;
            if (!s) {
              g.attendancePercent = null;
              return;
            }
            const presentCount =
              (s.present || 0) +
              (s.valid || 0) +
              (s.wsk || 0) +
              (s.dual || 0) +
              (s.late || 0);
            const totalCount = presentCount + (s.absent || 0);
            // Если никто не отмечен, процент должен быть 0, а не 100
            if (s.marked === 0 || totalCount === 0) {
              g.attendancePercent = 0;
            } else {
              g.attendancePercent = Math.round((presentCount / totalCount) * 100);
            }
          });
        }
        const specsList = Array.from(
          new Set(groupsList.map((g) => g.specialty?.name).filter(Boolean))
        );

        setGroups(groupsList);
        setSpecialties(["Все", ...specsList]);
      } catch (err) {
        console.error("Ошибка запроса:", err);
        setGroups([]);
        setSpecialties(["Все"]);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();

    // Обновляем данные при фокусе окна (когда пользователь возвращается на вкладку)
    const handleFocus = () => {
      fetchGroups();
    };
    window.addEventListener('focus', handleFocus);

    // Также обновляем при возврате на страницу через visibility API
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchGroups();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Фильтрация
  useEffect(() => {
    let filtered = groups;

    if (searchTerm) {
      filtered = filtered.filter(g =>
        g.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedSpecialty !== 'Все') {
      filtered = filtered.filter(g => g.specialty.name === selectedSpecialty);
    }

    if (selectedCourse !== 'Все') {
      filtered = filtered.filter(g => g.course === parseInt(selectedCourse));
    }

    setFilteredGroups(filtered);
  }, [searchTerm, selectedSpecialty, selectedCourse, groups]);

  // Извлечение уникальных курсов
  const courses = ['Все', ...new Set(groups.map(g => g.course).filter(Boolean))].sort((a, b) => a - b);

  // Восстанавливаем позицию/группу после возврата со страницы группы
  useEffect(() => {
    const stateGroupId = location.state?.scrollToGroupId;
    const storedGroupId = sessionStorage.getItem('lastGroupId');
    const storedScroll = sessionStorage.getItem('dashboardScroll');

    if (stateGroupId) {
      pendingScrollGroupRef.current = stateGroupId;
    } else if (storedGroupId) {
      pendingScrollGroupRef.current = storedGroupId;
      if (storedScroll) {
        pendingScrollPosRef.current = Number(storedScroll);
      }
    }

    if (stateGroupId) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    if (!pendingScrollGroupRef.current && pendingScrollPosRef.current === null) return;

    const targetId = pendingScrollGroupRef.current;
    if (targetId) {
      const el = document.getElementById(`group-${targetId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        pendingScrollGroupRef.current = null;
        pendingScrollPosRef.current = null;
        sessionStorage.removeItem('lastGroupId');
        sessionStorage.removeItem('dashboardScroll');
        return;
      }
    }

    if (pendingScrollPosRef.current !== null) {
      window.scrollTo({ top: pendingScrollPosRef.current, behavior: "smooth" });
      pendingScrollGroupRef.current = null;
      pendingScrollPosRef.current = null;
      sessionStorage.removeItem('lastGroupId');
      sessionStorage.removeItem('dashboardScroll');
    }
  }, [filteredGroups]);

  const handleGroupOpen = (groupId) => {
    sessionStorage.setItem('lastGroupId', groupId);
    sessionStorage.setItem('dashboardScroll', String(window.scrollY));
    navigate(`/teacher/group/${groupId}`);
  };

  // Кнопка "Наверх" с плавной анимацией
  useEffect(() => {
    const handleScroll = () => {
      const button = document.querySelector('.back-to-top');
      if (window.scrollY > 400) {
        button?.classList.add('visible');
      } else {
        button?.classList.remove('visible');
      }
    };

    window.addEventListener('scroll', handleScroll);
    // Инициализация при загрузке (на случай, если страница уже прокручена)
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  const dashboardContent = (
    <div className="teacher-dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Посещаемость студентов</h1>
          <p className="subtitle">{teacher?.role === 'HEAD' ? 'Заведующая' : 'Преподаватель'} — {teacher?.fullName || "Неизвестно"}</p>
        </div>
        <button className="logout-btn" onClick={handleLogoutClick}>
          Выйти
        </button>
      </div>

      {/* Фильтры */}
      <div className="filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Поиск по названию группы"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="search-icon"></span>
        </div>

        <select
          value={selectedSpecialty}
          onChange={(e) => setSelectedSpecialty(e.target.value)}
        >
          {specialties.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
        >
          {courses.map(course => (
            <option key={course} value={course}>
              {course === 'Все' ? 'Все курсы' : `${course} курс`}
            </option>
          ))}
        </select>
      </div>

      {/* Горизонтальный список групп */}
      <div className="groups-scroll">
        <div className="groups-container">
          {filteredGroups.length === 0 ? (
            <p className="no-groups">Группы не найдены</p>
          ) : (
            filteredGroups.map(group => (
              <div
                key={group.id}
                id={`group-${group.id}`}
                className="group-card"
                onClick={() => handleGroupOpen(group.id)}
                style={{ cursor: "pointer" }}
              >

                <div className="group-header">
                  <h3>Группа {group.name}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span className="student-count">
                      {group.students.length} студентов
                    </span>
                    {teacher?.role === 'HEAD' && group.attendancePercent !== undefined && (
                      <span style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: group.attendancePercent >= 80 ? '#4caf50' : group.attendancePercent >= 60 ? '#ff9800' : '#f44336'
                      }}>
                        {group.attendancePercent !== null ? `${group.attendancePercent}%` : '—'}
                      </span>
                    )}
                  </div>
                </div>


                <div className="stats-grid">
                  <div className="stat">
                    <span className="label">Присутствующие</span>
                    <span className="value present">{group.stats?.present || 0}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Отсутствующие</span>
                    <span className="value absent">{group.stats?.absent || 0}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Уважительная</span>
                    <span className="value valid">{group.stats?.valid || 0}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Больничный</span>
                    <span className="value sick">{group.stats?.sick || 0}</span>
                  </div>
                  <div className="stat">
                    <span className="label">IT HUB</span>
                    <span className="value wsk">{group.stats?.wsk || 0}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Дуальное</span>
                    <span className="value dual">{group.stats?.dual || 0}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Отмечено</span>
                    <span className="value marked">{group.stats?.marked || 0}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Плавающая кнопка QR для преподавателя/заведующей */}
      {teacher && (teacher.role === 'HEAD' || teacher.role === 'TEACHER') && (
        <QrButton user={teacher} />
      )}
    </div>
  );

  // Если пользователь - HEAD, оборачиваем в таббар
  if (teacher?.role === 'HEAD') {
    return (
      <>
        <HeadTabs>{dashboardContent}</HeadTabs>
        <button onClick={scrollToTop} className="back-to-top" aria-label="Наверх">
          ↑
        </button>
        <ConfirmModal
          isOpen={showLogoutModal}
          message="Вы точно хотите выйти?"
          onConfirm={handleLogoutConfirm}
          onCancel={handleLogoutCancel}
        />
      </>
    );
  }

  return (
    <>
      {dashboardContent}
      <button onClick={scrollToTop} className="back-to-top" aria-label="Наверх">
        ↑
      </button>
      <ConfirmModal
        isOpen={showLogoutModal}
        message="Вы точно хотите выйти?"
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
      />
    </>
  );
};

export default TeacherDashboard;