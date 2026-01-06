import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import HeadTabs from '../components/HeadTabs';
import ConfirmModal from '../components/ConfirmModal';
import { getUser, authHeaders } from '../api/auth';
import { API_URL } from '../config';
import './AdminPanel.css';

const AdminPanel = () => {
    const user = getUser();
    const [activeTab, setActiveTab] = useState('users');

    // Пользователи
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newUser, setNewUser] = useState({ login: '', password: '', role: 'TEACHER', fullName: '' });
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({ login: '', fullName: '', role: 'TEACHER', password: '' });
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, type: '', name: '' });

    // Группы
    const [groups, setGroups] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [curators, setCurators] = useState([]);
    const [editingGroupId, setEditingGroupId] = useState(null);
    const [editCuratorId, setEditCuratorId] = useState('');
    const [editingGroup, setEditingGroup] = useState(null);
    const [editGroupForm, setEditGroupForm] = useState({ name: '', specialtyCode: '', course: '', admissionYear: '', curatorId: '' });

    // Специальности
    const [specialties, setSpecialties] = useState([]);
    const [loadingSpecialties, setLoadingSpecialties] = useState(false);
    const [showSpecialtyForm, setShowSpecialtyForm] = useState(false);
    const [newSpecialty, setNewSpecialty] = useState({ code: '', name: '', durationYears: 4 });
    const [editingSpecialty, setEditingSpecialty] = useState(null);
    const [editSpecialtyForm, setEditSpecialtyForm] = useState({ code: '', name: '', durationYears: 4 });

    // Праздники
    const [holidays, setHolidays] = useState([]);
    const [loadingHolidays, setLoadingHolidays] = useState(false);
    const [showHolidayForm, setShowHolidayForm] = useState(false);
    const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });
    const [editingHoliday, setEditingHoliday] = useState(null);
    const [editHolidayForm, setEditHolidayForm] = useState({ date: '', name: '' });

    // Дни практики
    const [practiceDays, setPracticeDays] = useState([]);
    const [loadingPractice, setLoadingPractice] = useState(false);
    const [allGroups, setAllGroups] = useState([]);
    const [showPracticeForm, setShowPracticeForm] = useState(false);
    const [newPractice, setNewPractice] = useState({ groupId: '', startDate: '', endDate: '', name: '' });
    const [practiceRange, setPracticeRange] = useState({ start: '', end: '' });
    const [deletingPractice, setDeletingPractice] = useState(null);
    const [deletePracticeForm, setDeletePracticeForm] = useState({ groupId: '', startDate: '', endDate: '' });

    // Загрузка данных при смене вкладки
    useEffect(() => {
        switch (activeTab) {
            case 'users':
                loadUsers();
                break;
            case 'groups':
                loadGroups();
                loadCurators();
                break;
            case 'specialties':
                loadSpecialties();
                break;
            case 'holidays':
                loadHolidays();
                break;
            case 'practice':
                const loadPracticeData = async () => {
                    // Загружаем группы
                    const groupsRes = await fetch(`${API_URL}/admin/groups`, { headers: { ...authHeaders() } });
                    if (groupsRes.ok) {
                        const groupsData = await groupsRes.json();
                        setAllGroups(groupsData);
                        // Загружаем дни практики с использованием загруженных групп
                        loadPracticeDays(groupsData);
                    }
                };
                loadPracticeData();
                break;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // Проверка доступа
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

    // Полное редактирование группы
    const openEditGroup = (group) => {
        setEditingGroup(group);
        setEditGroupForm({
            name: group.name,
            specialtyCode: group.specialty?.code || '',
            course: group.course,
            admissionYear: group.admissionYear,
            curatorId: group.curatorId || ''
        });
    };

    const handleEditGroup = async () => {
        if (!editGroupForm.name || !editGroupForm.specialtyCode || !editGroupForm.course || !editGroupForm.admissionYear) {
            alert('Заполните все обязательные поля');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/admin/groups/${editingGroup.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders()
                },
                body: JSON.stringify({
                    name: editGroupForm.name,
                    specialtyCode: editGroupForm.specialtyCode,
                    course: Number(editGroupForm.course),
                    admissionYear: Number(editGroupForm.admissionYear),
                    curatorId: editGroupForm.curatorId || null
                })
            });

            if (res.ok) {
                const updated = await res.json();
                setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
                setEditingGroup(null);
                setEditGroupForm({ name: '', specialtyCode: '', course: '', admissionYear: '', curatorId: '' });
                alert('Группа обновлена');
            } else {
                const err = await res.json();
                alert(err.error || 'Ошибка обновления группы');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети');
        }
    };

    // Удаление группы
    const handleDeleteGroup = async (id) => {
        try {
            const res = await fetch(`${API_URL}/admin/groups/${id}`, {
                method: 'DELETE',
                headers: authHeaders()
            });

            if (res.ok) {
                setGroups(prev => prev.filter(g => g.id !== id));
                alert('Группа удалена');
            } else {
                const err = await res.json();
                alert(err.error || 'Ошибка удаления группы');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети');
        }
        setDeleteConfirm({ isOpen: false, id: null, type: '', name: '' });
    };

    // Удаление практики (batch)
    const handleDeletePractice = async () => {
        if (!deletePracticeForm.groupId || !deletePracticeForm.startDate || !deletePracticeForm.endDate) {
            alert('Выберите группу и даты');
            return;
        }

        if (!window.confirm('Удалить практику для этой группы в указанном диапазоне?')) return;

        try {
            const res = await fetch(`${API_URL}/practice-days/batch`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders()
                },
                body: JSON.stringify({
                    groupId: deletePracticeForm.groupId,
                    startDate: deletePracticeForm.startDate,
                    endDate: deletePracticeForm.endDate
                })
            });

            if (res.ok) {
                const result = await res.json();
                alert(result.message);
                setDeletingPractice(false);
                setDeletePracticeForm({ groupId: '', startDate: '', endDate: '' });
                // Перезагружаем список
                const groupsRes = await fetch(`${API_URL}/admin/groups`, { headers: { ...authHeaders() } });
                if (groupsRes.ok) {
                    const groupsData = await groupsRes.json();
                    setAllGroups(groupsData);
                    loadPracticeDays(groupsData);
                }
            } else {
                const err = await res.json();
                alert(err.error || 'Ошибка удаления');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети');
        }
    };

    // ============ ПОЛЬЗОВАТЕЛИ ============
    const loadUsers = async () => {
        setLoadingUsers(true);
        try {
            const res = await fetch(`${API_URL}/admin/users`, { headers: { ...authHeaders() } });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (err) {
            console.error('Ошибка загрузки пользователей:', err);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleCreateUser = async () => {
        if (!newUser.login || !newUser.password) {
            alert('Заполните логин и пароль');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/admin/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders()
                },
                body: JSON.stringify({
                    ...newUser,
                    fullName: newUser.fullName || null
                })
            });

            if (res.ok) {
                const created = await res.json();
                setUsers(prev => [...prev, created]);
                setNewUser({ login: '', password: '', role: 'TEACHER', fullName: '' });
                setShowCreateForm(false);
            } else {
                const err = await res.json();
                alert(err.error || 'Ошибка создания пользователя');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети');
        }
    };

    const openEditUser = (user) => {
        setEditingUser(user);
        setEditForm({
            login: user.login,
            fullName: user.fullName || '',
            role: user.role,
            password: ''
        });
    };

    const handleEditUser = async () => {
        if (!editForm.login) return;

        try {
            const data = {
                login: editForm.login,
                fullName: editForm.fullName || null,
                role: editForm.role
            };
            if (editForm.password) data.password = editForm.password;

            const res = await fetch(`${API_URL}/admin/users/${editingUser.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders()
                },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                const updated = await res.json();
                setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
                setEditingUser(null);
                setEditForm({ login: '', fullName: '', role: 'TEACHER', password: '' });
            } else {
                const err = await res.json();
                alert(err.error || 'Ошибка обновления');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети');
        }
    };

    const handleDeleteUser = async (id) => {
        try {
            const res = await fetch(`${API_URL}/admin/users/${id}`, {
                method: 'DELETE',
                headers: authHeaders()
            });

            if (res.ok) {
                setUsers(prev => prev.filter(u => u.id !== id));
            } else {
                const err = await res.json();
                alert(err.error || 'Ошибка удаления');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети');
        }
        setDeleteConfirm({ isOpen: false, id: null, type: '', name: '' });
    };

    // ============ ГРУППЫ ============

    const loadGroups = async () => {
        setLoadingGroups(true);
        try {
            const res = await fetch(`${API_URL}/admin/groups`, { headers: { ...authHeaders() } });
            if (res.ok) {
                const data = await res.json();
                setGroups(data);
            }
        } catch (err) {
            console.error('Ошибка загрузки групп:', err);
        } finally {
            setLoadingGroups(false);
        }
    };

    const loadCurators = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/groups/curators`, { headers: { ...authHeaders() } });
            if (res.ok) {
                const data = await res.json();
                setCurators(data);
            }
        } catch (err) {
            console.error('Ошибка загрузки кураторов:', err);
        }
    };

    const startEditCurator = (group) => {
        setEditingGroupId(group.id);
        setEditCuratorId(group.curatorId || '');
    };

    const saveCurator = async (groupId) => {
        try {
            const curatorId = editCuratorId === '' || editCuratorId === 'null' ? null : editCuratorId;
            const res = await fetch(`${API_URL}/admin/groups/${groupId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders()
                },
                body: JSON.stringify({ curatorId })
            });

            if (res.ok) {
                const updated = await res.json();
                setGroups(prev => prev.map(g => g.id === updated.id ? { ...g, curator: updated.curator, curatorId: updated.curatorId } : g));
                setEditingGroupId(null);
                setEditCuratorId('');
            } else {
                const err = await res.json();
                alert(err.error || 'Ошибка обновления куратора');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети');
        }
    };

    // ============ СПЕЦИАЛЬНОСТИ ============
    const loadSpecialties = async () => {
        setLoadingSpecialties(true);
        try {
            const res = await fetch(`${API_URL}/specialties`, { headers: { ...authHeaders() } });
            if (res.ok) {
                const data = await res.json();
                setSpecialties(data);
            }
        } catch (err) {
            console.error('Ошибка загрузки специальностей:', err);
        } finally {
            setLoadingSpecialties(false);
        }
    };

    const handleCreateSpecialty = async () => {
        if (!newSpecialty.code || !newSpecialty.name || !newSpecialty.durationYears) {
            alert('Заполните все поля');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/admin/specialties`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders()
                },
                body: JSON.stringify({
                    ...newSpecialty,
                    durationYears: Number(newSpecialty.durationYears)
                })
            });

            if (res.ok) {
                const created = await res.json();
                setSpecialties(prev => [...prev, created]);
                setNewSpecialty({ code: '', name: '', durationYears: 4 });
                setShowSpecialtyForm(false);
            } else {
                const err = await res.json();
                alert(err.error || 'Ошибка создания');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети');
        }
    };

    const openEditSpecialty = (specialty) => {
        setEditingSpecialty(specialty);
        setEditSpecialtyForm({
            code: specialty.code,
            name: specialty.name,
            durationYears: specialty.durationYears
        });
    };

    const handleEditSpecialty = async () => {
        if (!editSpecialtyForm.code || !editSpecialtyForm.name) return;

        try {
            const res = await fetch(`${API_URL}/admin/specialties/${editingSpecialty.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders()
                },
                body: JSON.stringify({
                    ...editSpecialtyForm,
                    durationYears: Number(editSpecialtyForm.durationYears)
                })
            });

            if (res.ok) {
                const updated = await res.json();
                setSpecialties(prev => prev.map(s => s.id === updated.id ? updated : s));
                setEditingSpecialty(null);
                setEditSpecialtyForm({ code: '', name: '', durationYears: 4 });
            } else {
                const err = await res.json();
                alert(err.error || 'Ошибка обновления');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети');
        }
    };

    const handleDeleteSpecialty = async (id) => {
        try {
            const res = await fetch(`${API_URL}/admin/specialties/${id}`, {
                method: 'DELETE',
                headers: authHeaders()
            });

            if (res.ok) {
                setSpecialties(prev => prev.filter(s => s.id !== id));
            } else {
                const err = await res.json();
                alert(err.error || 'Ошибка удаления');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети');
        }
        setDeleteConfirm({ isOpen: false, id: null, type: '', name: '' });
    };

    // ============ ПРАЗДНИКИ ============
    const loadHolidays = async () => {
        setLoadingHolidays(true);
        try {
            const res = await fetch(`${API_URL}/admin/holidays`, { headers: { ...authHeaders() } });
            if (res.ok) {
                const data = await res.json();
                setHolidays(data);
            }
        } catch (err) {
            console.error('Ошибка загрузки праздников:', err);
        } finally {
            setLoadingHolidays(false);
        }
    };

    const handleCreateHoliday = async () => {
        if (!newHoliday.date || !newHoliday.name) {
            alert('Заполните дату и название');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/admin/holidays`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders()
                },
                body: JSON.stringify(newHoliday)
            });

            if (res.ok) {
                const created = await res.json();
                setHolidays(prev => [...prev, created].sort((a, b) => new Date(b.date) - new Date(a.date)));
                setNewHoliday({ date: '', name: '' });
                setShowHolidayForm(false);
            } else {
                const err = await res.json();
                alert(err.error || 'Ошибка создания');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети');
        }
    };

    const openEditHoliday = (holiday) => {
        setEditingHoliday(holiday);
        setEditHolidayForm({
            date: new Date(holiday.date).toISOString().split('T')[0],
            name: holiday.name
        });
    };

    const handleEditHoliday = async () => {
        if (!editHolidayForm.date || !editHolidayForm.name) {
            alert('Заполните дату и название');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/admin/holidays/${editingHoliday.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders()
                },
                body: JSON.stringify(editHolidayForm)
            });

            if (res.ok) {
                const updated = await res.json();
                setHolidays(prev => prev.map(h => h.id === updated.id ? updated : h).sort((a, b) => new Date(b.date) - new Date(a.date)));
                setEditingHoliday(null);
                setEditHolidayForm({ date: '', name: '' });
            } else {
                const err = await res.json();
                alert(err.error || 'Ошибка обновления');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети');
        }
    };

    const handleDeleteHoliday = async (id) => {
        try {
            const res = await fetch(`${API_URL}/admin/holidays/${id}`, {
                method: 'DELETE',
                headers: authHeaders()
            });

            if (res.ok) {
                setHolidays(prev => prev.filter(h => h.id !== id));
            } else {
                const err = await res.json();
                alert(err.error || 'Ошибка удаления');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети');
        }
        setDeleteConfirm({ isOpen: false, id: null, type: '', name: '' });
    };

    // ============ ДНИ ПРАКТИКИ ============
    const loadAllGroups = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/groups`, { headers: { ...authHeaders() } });
            if (res.ok) {
                const data = await res.json();
                setAllGroups(data);
            }
        } catch (err) {
            console.error('Ошибка загрузки групп:', err);
        }
    };

    const loadPracticeDays = async (groupsList = allGroups) => {
        setLoadingPractice(true);
        try {
            // Загружаем практику за текущий учебный год
            const now = new Date();
            const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
            const start = `${year}-09-01`;
            const end = `${year + 1}-07-31`;

            setPracticeRange({ start, end });

            const res = await fetch(`${API_URL}/practice-days/range?start=${start}&end=${end}`, {
                headers: { ...authHeaders() }
            });
            if (res.ok) {
                // Этот endpoint возвращает только groupId
                const groupIds = await res.json();
                // Получаем детали групп из уже загруженного списка
                const groupsWithPractice = groupsList.filter(g =>
                    groupIds.some(p => p.groupId === g.id)
                );
                setPracticeDays(groupsWithPractice.map(g => ({
                    groupId: g.id,
                    groupName: g.name,
                })));
            }
        } catch (err) {
            console.error('Ошибка загрузки дней практики:', err);
        } finally {
            setLoadingPractice(false);
        }
    };

    const handleCreatePractice = async () => {
        if (!newPractice.groupId || !newPractice.startDate || !newPractice.endDate) {
            alert('Заполните группу, дату начала и дату конца');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/practice-days/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders()
                },
                body: JSON.stringify({
                    groupId: newPractice.groupId,
                    startDate: newPractice.startDate,
                    endDate: newPractice.endDate,
                    name: newPractice.name || null
                })
            });

            if (res.ok) {
                const result = await res.json();
                alert(result.message);
                setNewPractice({ groupId: '', startDate: '', endDate: '', name: '' });
                setShowPracticeForm(false);
                // Перезагружаем список практики
                const groupsRes = await fetch(`${API_URL}/admin/groups`, { headers: { ...authHeaders() } });
                if (groupsRes.ok) {
                    const groupsData = await groupsRes.json();
                    setAllGroups(groupsData);
                    loadPracticeDays(groupsData);
                }
            } else {
                const err = await res.json();
                alert(err.error || 'Ошибка создания');
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети');
        }
    };

    // ============ РЕНДЕР ВКЛАДОК ============
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
                return (
                    <div>
                        <div className="action-header">
                            <h3>Пользователи ({users.length})</h3>
                            <button className="btn-primary" onClick={() => setShowCreateForm(true)}>
                                + Добавить пользователя
                            </button>
                        </div>

                        {showCreateForm && (
                            <div className="form-card">
                                <h4>Новый пользователь</h4>
                                <div className="form-grid">
                                    <input
                                        className="form-input"
                                        placeholder="Логин *"
                                        value={newUser.login}
                                        onChange={(e) => setNewUser(prev => ({ ...prev, login: e.target.value }))}
                                    />
                                    <input
                                        className="form-input"
                                        type="password"
                                        placeholder="Пароль *"
                                        value={newUser.password}
                                        onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                                    />
                                    <input
                                        className="form-input"
                                        placeholder="ФИО (опционально)"
                                        value={newUser.fullName}
                                        onChange={(e) => setNewUser(prev => ({ ...prev, fullName: e.target.value }))}
                                    />
                                    <select
                                        className="form-select"
                                        value={newUser.role}
                                        onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                                    >
                                        <option value="TEACHER">Преподаватель</option>
                                        <option value="HEAD">Заведующий</option>
                                        <option value="ADMIN">Администратор</option>
                                    </select>
                                    <div className="form-row">
                                        <button className="btn-success" onClick={handleCreateUser}>Создать</button>
                                        <button className="btn-cancel" onClick={() => setShowCreateForm(false)}>Отмена</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {editingUser && (
                            <div className="form-card form-card-edit">
                                <h4>Редактирование: {editingUser.login}</h4>
                                <div className="form-grid">
                                    <input
                                        className="form-input"
                                        placeholder="Логин"
                                        value={editForm.login}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, login: e.target.value }))}
                                    />
                                    <input
                                        className="form-input"
                                        placeholder="ФИО"
                                        value={editForm.fullName}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                                    />
                                    <input
                                        className="form-input"
                                        type="password"
                                        placeholder="Новый пароль (оставьте пустым)"
                                        value={editForm.password}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                                    />
                                    <select
                                        className="form-select"
                                        value={editForm.role}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                                    >
                                        <option value="TEACHER">Преподаватель</option>
                                        <option value="HEAD">Заведующий</option>
                                        <option value="ADMIN">Администратор</option>
                                    </select>
                                    <div className="form-row">
                                        <button className="btn-success" onClick={handleEditUser}>Сохранить</button>
                                        <button className="btn-cancel" onClick={() => setEditingUser(null)}>Отмена</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {loadingUsers ? (
                            <div className="loading">Загрузка пользователей...</div>
                        ) : users.length === 0 ? (
                            <div className="empty-state">
                                <p>Нет пользователей</p>
                            </div>
                        ) : (
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Логин</th>
                                        <th>ФИО</th>
                                        <th>Роль</th>
                                        <th style={{ textAlign: 'center' }}>Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td>{u.login}</td>
                                            <td>{u.fullName || '—'}</td>
                                            <td>
                                                <span className={`role-badge ${u.role.toLowerCase()}`}>
                                                    {u.role === 'ADMIN' ? 'Админ' :
                                                        u.role === 'HEAD' ? 'Заведующий' :
                                                            u.role === 'STUDENT' ? 'Студент' :
                                                                'Преподаватель'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button className="btn-edit" onClick={() => openEditUser(u)}>Редактировать</button>
                                                <button className="btn-danger" onClick={() => setDeleteConfirm({ isOpen: true, id: u.id, type: 'user', name: u.login })}>Удалить</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                );

            case 'groups':
                return (
                    <div>
                        <div className="action-header">
                            <h3>Группы ({groups.length})</h3>
                        </div>

                        {editingGroup && (
                            <div className="form-card form-card-edit">
                                <h4>Редактирование группы: {editingGroup.name}</h4>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Название *</label>
                                        <input
                                            className="form-input"
                                            value={editGroupForm.name}
                                            onChange={(e) => setEditGroupForm(prev => ({ ...prev, name: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Специальность *</label>
                                        <select
                                            className="form-select"
                                            value={editGroupForm.specialtyCode}
                                            onChange={(e) => setEditGroupForm(prev => ({ ...prev, specialtyCode: e.target.value }))}
                                        >
                                            <option value="">— Выберите специальность —</option>
                                            {specialties.map(s => (
                                                <option key={s.id} value={s.code}>{s.code} — {s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Курс *</label>
                                        <input
                                            className="form-input"
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={editGroupForm.course}
                                            onChange={(e) => setEditGroupForm(prev => ({ ...prev, course: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Год поступления *</label>
                                        <input
                                            className="form-input"
                                            type="number"
                                            min="2000"
                                            max="2100"
                                            value={editGroupForm.admissionYear}
                                            onChange={(e) => setEditGroupForm(prev => ({ ...prev, admissionYear: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Куратор</label>
                                        <select
                                            className="form-select"
                                            value={editGroupForm.curatorId}
                                            onChange={(e) => setEditGroupForm(prev => ({ ...prev, curatorId: e.target.value }))}
                                        >
                                            <option value="">— Без куратора —</option>
                                            {curators.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.fullName || c.login} ({c.role === 'HEAD' ? 'Заведующий' : 'Преподаватель'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-row">
                                        <button className="btn-success" onClick={handleEditGroup}>Сохранить</button>
                                        <button className="btn-cancel" onClick={() => {
                                            setEditingGroup(null);
                                            setEditGroupForm({ name: '', specialtyCode: '', course: '', admissionYear: '', curatorId: '' });
                                        }}>Отмена</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {loadingGroups ? (
                            <div className="loading">Загрузка групп...</div>
                        ) : groups.length === 0 ? (
                            <div className="empty-state">
                                <p>Нет групп</p>
                            </div>
                        ) : (
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Название</th>
                                        <th>Специальность</th>
                                        <th>Курс</th>
                                        <th>Куратор</th>
                                        <th style={{ textAlign: 'center' }}>Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groups.map(g => (
                                        <tr key={g.id}>
                                            <td><strong>{g.name}</strong></td>
                                            <td>{g.specialty?.code || '—'} {g.specialty?.name || ''}</td>
                                            <td>{g.currentCourse || g.course}</td>
                                            <td>
                                                {editingGroupId === g.id ? (
                                                    <div className="form-row" style={{ margin: 0 }}>
                                                        <select
                                                            className="form-select"
                                                            value={editCuratorId}
                                                            onChange={(e) => setEditCuratorId(e.target.value)}
                                                            style={{ width: '200px', marginRight: '8px' }}
                                                        >
                                                            <option value="">— Без куратора —</option>
                                                            {curators.map(c => (
                                                                <option key={c.id} value={c.id}>
                                                                    {c.fullName || c.login} ({c.role === 'HEAD' ? 'Заведующий' : 'Преподаватель'})
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <button className="btn-success" onClick={() => saveCurator(g.id)} style={{ padding: '6px 12px' }}>Сохранить</button>
                                                        <button className="btn-cancel" onClick={() => setEditingGroupId(null)} style={{ padding: '6px 12px', marginLeft: '4px' }}>Отмена</button>
                                                    </div>
                                                ) : (
                                                    g.curator ? (
                                                        <span>{g.curator.fullName || g.curator.login}</span>
                                                    ) : (
                                                        <span style={{ color: '#94a3b8' }}>—</span>
                                                    )
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {editingGroupId !== g.id && editingGroup?.id !== g.id && (
                                                    <>
                                                        <button className="btn-edit" onClick={() => openEditGroup(g)} style={{ marginRight: '8px' }}>Редактировать</button>
                                                        <button className="btn-edit" onClick={() => startEditCurator(g)} style={{ marginRight: '8px' }}>Изменить куратора</button>
                                                        <button className="btn-danger" onClick={() => setDeleteConfirm({ isOpen: true, id: g.id, type: 'group', name: g.name })}>Удалить</button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                );

            case 'specialties':
                return (
                    <div>
                        <div className="action-header">
                            <h3>Специальности ({specialties.length})</h3>
                            <button className="btn-primary" onClick={() => setShowSpecialtyForm(true)}>
                                + Добавить специальность
                            </button>
                        </div>

                        {showSpecialtyForm && (
                            <div className="form-card">
                                <h4>Новая специальность</h4>
                                <div className="form-grid">
                                    <input
                                        className="form-input"
                                        placeholder="Код *"
                                        value={newSpecialty.code}
                                        onChange={(e) => setNewSpecialty(prev => ({ ...prev, code: e.target.value }))}
                                    />
                                    <input
                                        className="form-input"
                                        placeholder="Название *"
                                        value={newSpecialty.name}
                                        onChange={(e) => setNewSpecialty(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                    <input
                                        className="form-input"
                                        type="number"
                                        placeholder="Длительность (лет) *"
                                        value={newSpecialty.durationYears}
                                        onChange={(e) => setNewSpecialty(prev => ({ ...prev, durationYears: e.target.value }))}
                                        min="1"
                                        max="10"
                                    />
                                    <div className="form-row">
                                        <button className="btn-success" onClick={handleCreateSpecialty}>Создать</button>
                                        <button className="btn-cancel" onClick={() => setShowSpecialtyForm(false)}>Отмена</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {editingSpecialty && (
                            <div className="form-card form-card-edit">
                                <h4>Редактирование: {editingSpecialty.code}</h4>
                                <div className="form-grid">
                                    <input
                                        className="form-input"
                                        placeholder="Код"
                                        value={editSpecialtyForm.code}
                                        onChange={(e) => setEditSpecialtyForm(prev => ({ ...prev, code: e.target.value }))}
                                    />
                                    <input
                                        className="form-input"
                                        placeholder="Название"
                                        value={editSpecialtyForm.name}
                                        onChange={(e) => setEditSpecialtyForm(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                    <input
                                        className="form-input"
                                        type="number"
                                        placeholder="Длительность (лет)"
                                        value={editSpecialtyForm.durationYears}
                                        onChange={(e) => setEditSpecialtyForm(prev => ({ ...prev, durationYears: e.target.value }))}
                                        min="1"
                                        max="10"
                                    />
                                    <div className="form-row">
                                        <button className="btn-success" onClick={handleEditSpecialty}>Сохранить</button>
                                        <button className="btn-cancel" onClick={() => setEditingSpecialty(null)}>Отмена</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {loadingSpecialties ? (
                            <div className="loading">Загрузка специальностей...</div>
                        ) : specialties.length === 0 ? (
                            <div className="empty-state">
                                <p>Нет специальностей</p>
                            </div>
                        ) : (
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Код</th>
                                        <th>Название</th>
                                        <th>Длительность (лет)</th>
                                        <th style={{ textAlign: 'center' }}>Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {specialties.map(s => (
                                        <tr key={s.id}>
                                            <td><strong>{s.code}</strong></td>
                                            <td>{s.name}</td>
                                            <td>{s.durationYears}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button className="btn-edit" onClick={() => openEditSpecialty(s)}>Редактировать</button>
                                                <button className="btn-danger" onClick={() => setDeleteConfirm({ isOpen: true, id: s.id, type: 'specialty', name: s.code })}>Удалить</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                );

            case 'holidays':
                return (
                    <div>
                        <div className="action-header">
                            <h3>Праздники ({holidays.length})</h3>
                            <button className="btn-primary" onClick={() => setShowHolidayForm(true)}>
                                + Добавить праздник
                            </button>
                        </div>

                        {showHolidayForm && (
                            <div className="form-card">
                                <h4>Новый праздник</h4>
                                <div className="form-grid">
                                    <input
                                        className="form-input"
                                        type="date"
                                        value={newHoliday.date}
                                        onChange={(e) => setNewHoliday(prev => ({ ...prev, date: e.target.value }))}
                                    />
                                    <input
                                        className="form-input"
                                        placeholder="Название *"
                                        value={newHoliday.name}
                                        onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                    <div className="form-row">
                                        <button className="btn-success" onClick={handleCreateHoliday}>Создать</button>
                                        <button className="btn-cancel" onClick={() => setShowHolidayForm(false)}>Отмена</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {editingHoliday && (
                            <div className="form-card form-card-edit">
                                <h4>Редактирование праздника</h4>
                                <div className="form-grid">
                                    <input
                                        className="form-input"
                                        type="date"
                                        value={editHolidayForm.date}
                                        onChange={(e) => setEditHolidayForm(prev => ({ ...prev, date: e.target.value }))}
                                    />
                                    <input
                                        className="form-input"
                                        placeholder="Название *"
                                        value={editHolidayForm.name}
                                        onChange={(e) => setEditHolidayForm(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                    <div className="form-row">
                                        <button className="btn-success" onClick={handleEditHoliday}>Сохранить</button>
                                        <button className="btn-cancel" onClick={() => {
                                            setEditingHoliday(null);
                                            setEditHolidayForm({ date: '', name: '' });
                                        }}>Отмена</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {loadingHolidays ? (
                            <div className="loading">Загрузка праздников...</div>
                        ) : holidays.length === 0 ? (
                            <div className="empty-state">
                                <p>Нет праздников</p>
                            </div>
                        ) : (
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Дата</th>
                                        <th>Название</th>
                                        <th style={{ textAlign: 'center' }}>Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {holidays.map(h => (
                                        <tr key={h.id}>
                                            <td>{new Date(h.date).toLocaleDateString('ru-RU')}</td>
                                            <td><strong>{h.name}</strong></td>
                                            <td style={{ textAlign: 'center' }}>
                                                {editingHoliday?.id !== h.id && (
                                                    <>
                                                        <button className="btn-edit" onClick={() => openEditHoliday(h)} style={{ marginRight: '8px' }}>Редактировать</button>
                                                        <button className="btn-danger" onClick={() => setDeleteConfirm({ isOpen: true, id: h.id, type: 'holiday', name: h.name })}>Удалить</button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                );

            case 'practice':
                return (
                    <div>
                        <div className="action-header">
                            <h3>Дни практики</h3>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn-primary" onClick={() => setShowPracticeForm(true)}>
                                    + Добавить практику
                                </button>
                                <button className="btn-danger" onClick={() => setDeletingPractice(true)}>
                                    — Удалить практику
                                </button>
                            </div>
                        </div>

                        {showPracticeForm && (
                            <div className="form-card">
                                <h4>Новая практика для группы</h4>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Группа *</label>
                                        <select
                                            className="form-select"
                                            value={newPractice.groupId}
                                            onChange={(e) => setNewPractice(prev => ({ ...prev, groupId: e.target.value }))}
                                        >
                                            <option value="">— Выберите группу —</option>
                                            {allGroups.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Дата начала *</label>
                                        <input
                                            className="form-input"
                                            type="date"
                                            value={newPractice.startDate}
                                            onChange={(e) => setNewPractice(prev => ({ ...prev, startDate: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Дата конца *</label>
                                        <input
                                            className="form-input"
                                            type="date"
                                            value={newPractice.endDate}
                                            onChange={(e) => setNewPractice(prev => ({ ...prev, endDate: e.target.value }))}
                                            min={newPractice.startDate}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Название практики (опционально)</label>
                                        <input
                                            className="form-input"
                                            placeholder="Например: Производственная практика"
                                            value={newPractice.name}
                                            onChange={(e) => setNewPractice(prev => ({ ...prev, name: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-row">
                                        <button className="btn-success" onClick={handleCreatePractice}>Создать</button>
                                        <button className="btn-cancel" onClick={() => setShowPracticeForm(false)}>Отмена</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {deletingPractice && (
                            <div className="form-card" style={{ background: '#fef2f2', borderColor: '#ef4444' }}>
                                <h4>Удаление практики для группы</h4>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Группа *</label>
                                        <select
                                            className="form-select"
                                            value={deletePracticeForm.groupId}
                                            onChange={(e) => setDeletePracticeForm(prev => ({ ...prev, groupId: e.target.value }))}
                                        >
                                            <option value="">— Выберите группу —</option>
                                            {allGroups.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Дата начала *</label>
                                        <input
                                            className="form-input"
                                            type="date"
                                            value={deletePracticeForm.startDate}
                                            onChange={(e) => setDeletePracticeForm(prev => ({ ...prev, startDate: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Дата конца *</label>
                                        <input
                                            className="form-input"
                                            type="date"
                                            value={deletePracticeForm.endDate}
                                            onChange={(e) => setDeletePracticeForm(prev => ({ ...prev, endDate: e.target.value }))}
                                            min={deletePracticeForm.startDate}
                                        />
                                    </div>
                                    <div className="form-row">
                                        <button className="btn-danger" onClick={handleDeletePractice}>Удалить</button>
                                        <button className="btn-cancel" onClick={() => {
                                            setDeletingPractice(null);
                                            setDeletePracticeForm({ groupId: '', startDate: '', endDate: '' });
                                        }}>Отмена</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {loadingPractice ? (
                            <div className="loading">Загрузка дней практики...</div>
                        ) : practiceDays.length === 0 ? (
                            <div className="empty-state">
                                <p>Нет записей о практике в текущем учебном году</p>
                                {practiceRange.start && (
                                    <p style={{ fontSize: '13px', marginTop: '8px' }}>
                                        Период: {practiceRange.start} — {practiceRange.end}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div>
                                {practiceRange.start && (
                                    <p style={{ marginBottom: '16px', color: '#64748b', fontSize: '14px' }}>
                                        Период: {practiceRange.start} — {practiceRange.end}
                                    </p>
                                )}
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Группа</th>
                                            <th>Статус</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {practiceDays.map(p => (
                                            <tr key={p.groupId}>
                                                <td><strong>{p.groupName}</strong></td>
                                                <td>
                                                    <span className="role-badge teacher">На практике</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    // Определяем сообщение для модального окна удаления
    const getDeleteMessage = () => {
        switch (deleteConfirm.type) {
            case 'user':
                return `Удалить пользователя "${deleteConfirm.name}"?`;
            case 'specialty':
                return `Удалить специальность "${deleteConfirm.name}"?`;
            case 'holiday':
                return `Удалить праздник "${deleteConfirm.name}"?`;
            default:
                return 'Вы уверены?';
        }
    };

    // Обработчик подтверждения удаления
    const handleConfirmDelete = () => {
        switch (deleteConfirm.type) {
            case 'user':
                handleDeleteUser(deleteConfirm.id);
                break;
            case 'specialty':
                handleDeleteSpecialty(deleteConfirm.id);
                break;
            case 'holiday':
                handleDeleteHoliday(deleteConfirm.id);
                break;
            case 'group':
                handleDeleteGroup(deleteConfirm.id);
                break;
        }
    };

    return (
        <HeadTabs>
            <div className="admin-panel">
                <h1>Админ-панель</h1>
                <p className="admin-welcome">
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

            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                message={getDeleteMessage()}
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteConfirm({ isOpen: false, id: null, type: '', name: '' })}
            />
        </HeadTabs>
    );
};

export default AdminPanel;
