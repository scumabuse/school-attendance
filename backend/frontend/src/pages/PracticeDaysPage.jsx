import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { authHeaders } from '../api/auth';
import HeadTabs from '../components/HeadTabs';
import { getUser } from '../api/auth';

const PracticeDaysPage = () => {
    const [groups, setGroups] = useState([]);
    const [groupId, setGroupId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const user = getUser();

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const res = await fetch(`${API_URL}/groups`, { headers: { ...authHeaders() } });
            if (res.ok) {
                const data = await res.json();
                setGroups(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!groupId || !startDate || !endDate) {
            setMessage('Заполните все обязательные поля');
            return;
        }

        try {
            setLoading(true);
            setMessage('');

            const res = await fetch(`${API_URL}/practice-days/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders()
                },
                body: JSON.stringify({ groupId, startDate, endDate, name })
            });

            const data = await res.json();
            if (res.ok) {
                setMessage(data.message);
                setStartDate('');
                setEndDate('');
                setName('');
            } else {
                setMessage(data.error || 'Ошибка');
            }
        } catch (err) {
            setMessage('Ошибка соединения');
        } finally {
            setLoading(false);
        }
    };

    if (!user || user.role !== 'ADMIN') {
        return (
            <HeadTabs>
                <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                    <h2>Доступ запрещён</h2>
                    <p>Эта страница доступна только администратору.</p>
                </div>
            </HeadTabs>
        );
    }

    return (
        <HeadTabs>
            <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
                <h1>Добавить дни практики</h1>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label>Группа *</label>
                        <select
                            value={groupId}
                            onChange={(e) => setGroupId(e.target.value)}
                            required
                            style={{ width: '100%', padding: '8px' }}
                        >
                            <option value="">Выберите группу</option>
                            {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label>Дата начала *</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required
                            style={{ width: '100%', padding: '8px' }}
                        />
                    </div>

                    <div>
                        <label>Дата конца *</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            required
                            min={startDate}
                            style={{ width: '100%', padding: '8px' }}
                        />
                    </div>

                    <div>
                        <label>Название практики (опционально)</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Например: Производственная практика"
                            style={{ width: '100%', padding: '8px' }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '12px',
                            background: '#1976d2',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            cursor: 'pointer'
                        }}
                    >
                        {loading ? 'Добавляется...' : 'Добавить дни практики'}
                    </button>
                </form>

                {message && (
                    <p style={{ marginTop: '20px', padding: '12px', background: '#e8f5e8', borderRadius: '8px' }}>
                        {message}
                    </p>
                )}
            </div>
        </HeadTabs>
    );
};

export default PracticeDaysPage;