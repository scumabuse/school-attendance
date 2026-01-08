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
  const [specialties, setSpecialties] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('Все');
  const [selectedCourse, setSelectedCourse] = useState('Все');
  const [selectedShift, setSelectedShift] = useState(1); // 1 = первая смена, 2 = вторая смена
  const [selectedPair, setSelectedPair] = useState(null); // null = первая пара по умолчанию, число = конкретная пара
  const [schedule, setSchedule] = useState([]); // Расписание на сегодня
  const [attendanceByPair, setAttendanceByPair] = useState({}); // { lessonId: { groupId: stats } }
  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [highlightedGroupId, setHighlightedGroupId] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const pendingScrollGroupRef = useRef(null);
  const pendingScrollPosRef = useRef(null);

  // Получаем день недели (1 = Пн, 7 = Вс)
  const getDayOfWeek = () => {
    const now = new Date();
    const day = now.getDay();
    return day === 0 ? 7 : day;
  };

  // Загрузка данных
  useEffect(() => {
    const fetchData = async () => {
      try {
        setTeacher(getUser());
        const today = new Date().toISOString().slice(0, 10);
        const dayOfWeek = getDayOfWeek();

        // Загружаем расписание на сегодня, студентов и посещаемость
        const [resSchedule, resStudents, resLogs] = await Promise.all([
          fetch(`${API_URL}/schedule/today`, {
            headers: {
              ...authHeaders(),
              "Cache-Control": "no-cache"
            }
          }),
          fetch(`${API_URL}/students`, {
            headers: {
              ...authHeaders(),
              "Content-Type": "application/json",
              "Cache-Control": "no-cache"
            }
          }),
          fetch(`${API_URL}/attendance/log?date=${today}`, {
            headers: {
              ...authHeaders(),
              "Cache-Control": "no-cache"
            }
          })
        ]);

        if (!resStudents.ok) {
          console.error("Ошибка загрузки студентов");
          setGroups([]);
          setSpecialties(["Все"]);
          return;
        }

        let scheduleData = [];
        const dataStudents = await resStudents.json();
        const logs = resLogs.ok ? await resLogs.json() : [];

        // Загружаем расписание в зависимости от выбранной смены
        if (selectedShift === 1) {
          // Первая смена - из БД
          scheduleData = resSchedule.ok ? await resSchedule.json() : [];
          // Фильтруем только первую смену (до 14:00)
          scheduleData = scheduleData.filter(lesson => {
            const startHour = parseInt(lesson.startTime?.split(':')[0] || '0', 10);
            return startHour < 14; // Первая смена до 14:00
          });
        } else if (selectedShift === 2) {
          // Вторая смена - из localStorage
          const saved = localStorage.getItem('schedule_shift_2');
          if (saved) {
            try {
              const allSchedules = JSON.parse(saved);
              const now = new Date();
              const day = now.getDay();
              const dayOfWeek = day === 0 ? 7 : day;
              // Фильтруем только расписание на сегодня
              scheduleData = allSchedules.filter(lesson => lesson.dayOfWeek === dayOfWeek);
            } catch (e) {
              console.error('Ошибка загрузки второй смены из localStorage:', e);
              scheduleData = [];
            }
          }
        }

        setSchedule(scheduleData);

        // Группируем студентов по группам
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
              students: []
            };
          }
          grouped[gid].students.push(student);
        });

        let groupsList = Object.values(grouped);
        
        // Фильтруем только классы (1А-11В), скрываем старые группы
        const classPattern = /^([1-9]|1[01])[А-В]$/;
        groupsList = groupsList.filter((g) => classPattern.test(g.name));

        // Группируем посещаемость по парам (lessonId)
        const attendanceByLesson = {};
        
        // Инициализируем структуру для всех пар из расписания
        scheduleData.forEach((lesson) => {
          if (!attendanceByLesson[lesson.id]) {
            attendanceByLesson[lesson.id] = {};
          }
          groupsList.forEach((group) => {
            if (!attendanceByLesson[lesson.id][group.id]) {
              attendanceByLesson[lesson.id][group.id] = {
                present: 0,
                absent: 0,
                sick: 0,
                remote: 0,
                marked: 0,
                unmarked: group.students.length
              };
            }
          });
        });

        // Обрабатываем логи посещаемости
        logs.forEach((log) => {
          const lessonId = log.lessonId;
          const groupId = String(log.groupId);
          
          // Если есть lessonId, группируем по паре
          if (lessonId !== null && lessonId !== undefined) {
            // Преобразуем lessonId в число для консистентности
            const lessonIdNum = Number(lessonId);
            if (!attendanceByLesson[lessonIdNum]) {
              attendanceByLesson[lessonIdNum] = {};
            }
            if (!attendanceByLesson[lessonIdNum][groupId]) {
              const group = groupsList.find(g => String(g.id) === groupId);
              attendanceByLesson[lessonIdNum][groupId] = {
                present: 0,
                absent: 0,
                sick: 0,
                remote: 0,
                marked: 0,
                unmarked: group ? group.students.length : 0
              };
            }
            
            const stats = attendanceByLesson[lessonIdNum][groupId];
            stats.marked += 1;
            if (log.status === "PRESENT") stats.present += 1;
            if (log.status === "ABSENT") stats.absent += 1;
            if (log.status === "SICK") stats.sick += 1;
            // ITHUB используется для хранения REMOTE в БД (так как REMOTE не поддерживается БД)
            if (log.status === "REMOTE" || log.status === "ITHUB") stats.remote += 1;
          }
        });

        // Пересчитываем unmarked для каждой пары и группы
        Object.keys(attendanceByLesson).forEach((lessonId) => {
          Object.keys(attendanceByLesson[lessonId]).forEach((groupId) => {
            const group = groupsList.find(g => String(g.id) === groupId);
            if (group) {
              const stats = attendanceByLesson[lessonId][groupId];
              stats.unmarked = Math.max(group.students.length - stats.marked, 0);
            }
          });
        });

        // Для заведующей считаем процент посещаемости для каждой пары
        const currentUser = getUser();
        if (currentUser && currentUser.role === 'HEAD') {
          Object.keys(attendanceByLesson).forEach((lessonId) => {
            Object.keys(attendanceByLesson[lessonId]).forEach((groupId) => {
              const stats = attendanceByLesson[lessonId][groupId];
              const presentCount = (stats.present || 0);
              const totalCount = presentCount + (stats.absent || 0);
              
              if (stats.marked === 0 || totalCount === 0) {
                stats.attendancePercent = 0;
              } else {
                const percent = (presentCount / totalCount) * 100;
                stats.attendancePercent = Math.min(Math.round(percent), 100);
              }
            });
          });
        }

        setGroups(groupsList);
        setAttendanceByPair(attendanceByLesson);
        
        const specsList = Array.from(
          new Set(groupsList.map((g) => g.specialty?.name).filter(Boolean))
        );
        setSpecialties(["Все", ...specsList]);
      } catch (err) {
        console.error("Ошибка запроса:", err);
        setGroups([]);
        setSpecialties(["Все"]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Обновляем данные при фокусе окна
    const handleFocus = () => {
      fetchData();
    };
    window.addEventListener('focus', handleFocus);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Обновляем данные при сохранении посещаемости
    const handleAttendanceSaved = () => {
      fetchData();
    };
    window.addEventListener('attendanceSaved', handleAttendanceSaved);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('attendanceSaved', handleAttendanceSaved);
    };
  }, [selectedShift]); // Перезагружаем данные при смене смены

  // Фильтрация групп
  const getFilteredGroups = () => {
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

    return filtered;
  };

  // Получаем пары для отображения (все уроки из расписания)
  const getPairsToDisplay = () => {
    // Получаем текущий день недели
    const now = new Date();
    const day = now.getDay();
    const dayOfWeek = day === 0 ? 7 : day; // Пн=1 ... Вс=7
    
    // Фильтруем уроки для текущего дня недели (исключаем классный час с pairNumber === 0)
    const pairs = schedule
      .filter(lesson => lesson.dayOfWeek === dayOfWeek && lesson.pairNumber >= 1)
      .sort((a, b) => a.pairNumber - b.pairNumber);
    
    const classHour = schedule.find(lesson => lesson.dayOfWeek === dayOfWeek && lesson.pairNumber === 0);
    
    return { pairs, classHour };
  };

  // Получаем статистику группы для конкретной пары
  const getGroupStatsForPair = (groupId, lessonId) => {
    if (!attendanceByPair[lessonId] || !attendanceByPair[lessonId][groupId]) {
      const group = groups.find(g => String(g.id) === groupId);
      return {
        present: 0,
        absent: 0,
        sick: 0,
        remote: 0,
        marked: 0,
        unmarked: group ? group.students.length : 0,
        attendancePercent: 0
      };
    }
    return attendanceByPair[lessonId][groupId];
  };

  // Извлечение уникальных курсов
  const courses = ['Все', ...new Set(groups.map(g => g.course).filter(Boolean))].sort((a, b) => a - b);

  // Восстанавливаем позицию/группу после возврата со страницы группы
  useEffect(() => {
    const stateGroupId = location.state?.scrollToGroupId;
    const stateSelectedPair = location.state?.selectedPair;
    const storedGroupId = sessionStorage.getItem('lastGroupId');
    const storedScroll = sessionStorage.getItem('dashboardScroll');

    // Устанавливаем выбранную пару из state, если она передана
    if (stateSelectedPair !== undefined && stateSelectedPair !== null) {
      setSelectedPair(stateSelectedPair);
    }

    if (stateGroupId) {
      pendingScrollGroupRef.current = stateGroupId;
      // Данные обновятся через событие attendanceSaved
    } else if (storedGroupId) {
      pendingScrollGroupRef.current = storedGroupId;
      if (storedScroll) {
        pendingScrollPosRef.current = Number(storedScroll);
      }
    }

    if (stateGroupId || stateSelectedPair !== undefined) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // Устанавливаем первую пару по умолчанию, если selectedPair не установлен и есть расписание
  useEffect(() => {
    if (selectedPair === null && schedule.length > 0) {
      const now = new Date();
      const day = now.getDay();
      const dayOfWeek = day === 0 ? 7 : day;
      const firstPair = schedule
        .filter(lesson => lesson.dayOfWeek === dayOfWeek && lesson.pairNumber >= 1)
        .sort((a, b) => a.pairNumber - b.pairNumber)[0];
      if (firstPair) {
        setSelectedPair(firstPair.pairNumber);
      }
    }
  }, [schedule]); // Убрал selectedPair из зависимостей, чтобы избежать бесконечного цикла

  useEffect(() => {
    if (!pendingScrollGroupRef.current && pendingScrollPosRef.current === null) return;

    const targetId = pendingScrollGroupRef.current;
    if (targetId) {
      const el = document.getElementById(`group-${targetId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedGroupId(targetId);
        setTimeout(() => {
          setHighlightedGroupId(null);
        }, 4000);
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
  }, [groups]);

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

  const filteredGroups = getFilteredGroups();
  const { pairs, classHour } = getPairsToDisplay();

  // Рендер карточек группы для конкретной пары
  const renderGroupCardsForPair = (lessonId, pairNumber) => {
    return (
      <div key={lessonId} className="pair-section">
        <h2 className="pair-title">
          {pairNumber === 0 ? 'Классный час' : `${pairNumber} урок`}
          {schedule.find(s => s.id === lessonId) && (
            <span className="pair-time">
              {schedule.find(s => s.id === lessonId).startTime} - {schedule.find(s => s.id === lessonId).endTime}
            </span>
          )}
        </h2>
        <div className="groups-scroll">
          <div className="groups-container">
            {filteredGroups.length === 0 ? (
              <p className="no-groups">Классы не найдены</p>
            ) : (
              filteredGroups.map(group => {
                const stats = getGroupStatsForPair(group.id, lessonId);
                return (
                  <div
                    key={`${lessonId}-${group.id}`}
                    id={`group-${group.id}`}
                    className={`group-card ${highlightedGroupId === group.id ? 'highlighted' : ''}`}
                    onClick={() => handleGroupOpen(group.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="group-header">
                      <h3>Класс {group.name}</h3>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                        {teacher?.role === 'HEAD' && (() => {
                          const sickPercent = group.students.length > 0 
                            ? Math.round((stats.sick || 0) / group.students.length * 100) 
                            : 0;
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                              <span style={{
                                fontSize: '11px',
                                color: '#666',
                                fontWeight: 'normal'
                              }}>
                                % Бол.
                              </span>
                              <span style={{
                                fontSize: '16px',
                                fontWeight: 'bold',
                                color: '#ff9800'
                              }}>
                                {sickPercent}%
                              </span>
                            </div>
                          );
                        })()}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <span className="student-count">
                            {group.students.length} Учеников
                          </span>
                          {teacher?.role === 'HEAD' && stats.attendancePercent !== undefined && (
                            <span style={{
                              fontSize: '16px',
                              fontWeight: 'bold',
                              color: stats.attendancePercent >= 80 ? '#4caf50' : stats.attendancePercent >= 60 ? '#ff9800' : '#f44336'
                            }}>
                              {stats.attendancePercent !== null ? `${stats.attendancePercent}%` : '—'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="stats-grid">
                      <div className="stat">
                        <span className="label">Присутствующие</span>
                        <span className="value present">{stats.present || 0}</span>
                      </div>
                      <div className="stat">
                        <span className="label">Отсутствующие</span>
                        <span className="value absent">{stats.absent || 0}</span>
                      </div>
                      <div className="stat">
                        <span className="label">Больничный</span>
                        <span className="value sick">{stats.sick || 0}</span>
                      </div>
                      <div className="stat">
                        <span className="label">Дистанционно</span>
                        <span className="value remote">{stats.remote || 0}</span>
                      </div>
                      <div className="stat">
                        <span className="label">Отмечено</span>
                        <span className="value marked">{stats.marked || 0}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const dashboardContent = (
    <div className="teacher-dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Посещаемость учеников</h1>
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
            placeholder="Поиск по классу"
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
              {course === 'Все' ? 'Все классы' : `${course} класс`}
            </option>
          ))}
        </select>

        {/* Фильтр смены */}
        <select
          value={selectedShift}
          onChange={(e) => {
            const newShift = parseInt(e.target.value, 10);
            setSelectedShift(newShift);
            setSelectedPair(null); // Сбрасываем выбранную пару при смене смены
          }}
        >
          <option value={1}>1 смена</option>
          <option value={2}>2 смена</option>
        </select>

        {/* Фильтр пар */}
        <select
          value={selectedPair || (pairs.length > 0 ? pairs[0].pairNumber : '')}
          onChange={(e) => {
            const value = e.target.value;
            setSelectedPair(value === '' ? null : parseInt(value, 10));
          }}
        >
          {pairs.map(lesson => (
            <option key={lesson.id} value={lesson.pairNumber}>
              {lesson.pairNumber} урок
            </option>
          ))}
        </select>
      </div>

      {/* Отображение пар */}
      {(() => {
        const pairToShow = selectedPair || (pairs.length > 0 ? pairs[0].pairNumber : null);
        if (!pairToShow) {
          return <p className="no-groups">Нет уроков на сегодня</p>;
        }
        return (
          <>
            {/* Показываем выбранную пару */}
            {pairs
              .filter(lesson => lesson.pairNumber === pairToShow)
              .map(lesson => renderGroupCardsForPair(lesson.id, lesson.pairNumber))}
          </>
        );
      })()}

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
