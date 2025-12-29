import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import axios from 'axios';
import { API_URL } from '../../config';
import { authHeaders } from '../../api/auth';

const QrGenerator = ({ teacherId }) => {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [currentLessonId, setCurrentLessonId] = useState(null);

  const fetchToken = async () => {
    // Если нет ID учителя, не делаем запрос
    if (!teacherId) {
        setError('Не выбран преподаватель');
        return;
    }

    try {
      setError('');
      // Новый URL: без lessonId, пару определяет сервер автоматически
      const res = await axios.get(
        `${API_URL}/attendance/qr/refresh/${teacherId}`,
        { headers: { ...authHeaders() } }
      );
      
      if (res.data && res.data.token) {
        setToken(res.data.token);
        if (res.data.lessonId) {
          setCurrentLessonId(res.data.lessonId);
        }
      } else {
        setError('Не удалось получить токен');
      }
    } catch (err) {
      console.error("Ошибка обновления токена", err);
      setError(err.response?.data?.error || 'Ошибка загрузки QR кода');
    }
  };

  useEffect(() => {
    fetchToken();

    // ВАЖНО: Токен в новой логике живет 1 минуту (60000 мс).
    // Обновляем его каждые 55 секунд, чтобы QR всегда был свежим.
    // При обновлении автоматически определяется текущая пара.
    const interval = setInterval(fetchToken, 55 * 1000);
    
    return () => clearInterval(interval);
  }, [teacherId]);

  const handleRetry = () => {
    fetchToken();
  };

  return (
    <div style={{ textAlign: 'center', padding: '10px' }}>
      {error ? (
        <div style={{ color: 'red', padding: '10px' }}>
          <p>{error}</p>
          <button onClick={handleRetry} style={{ marginTop: '10px', padding: '8px 16px', cursor: 'pointer' }}>
            Попробовать снова
          </button>
        </div>
      ) : token ? (
        <div style={{ background: 'white', padding: '20px', display: 'inline-block', borderRadius: '10px' }}>
            <QRCodeCanvas value={token} size={250} level="H" includeMargin={true} />
            <p style={{ marginTop: '10px', color: '#666', fontSize: '14px' }}>
                Код обновляется автоматически
            </p>
            {currentLessonId && (
              <p style={{ marginTop: '5px', color: '#666', fontSize: '12px' }}>
                Текущая пара определена автоматически
              </p>
            )}
        </div>
      ) : (
        <p>Определение текущей пары и генерация кода...</p>
      )}
    </div>
  );
};

export default QrGenerator;