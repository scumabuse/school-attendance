import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import axios from 'axios';
import { API_URL } from '../../config';
import { authHeaders } from '../../api/auth';

const QrGenerator = ({ teacherId }) => {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const fetchToken = async () => {
    try {
      setError('');
      const res = await axios.get(
        `${API_URL}/attendance/qr/refresh/${teacherId}`,
        { headers: { ...authHeaders() } }
      );
      if (res.data && res.data.token) {
        setToken(res.data.token);
      } else {
        setError('Не удалось получить токен');
      }
    } catch (err) {
      console.error("Ошибка обновления токена", err);
      setError(err.response?.data?.error || 'Ошибка загрузки QR кода');
    }
  };

  useEffect(() => {
    if (!teacherId) return;
    fetchToken();
    // Токен живет 30 минут, обновляем чуть раньше истечения (29 минут)
    const interval = setInterval(fetchToken, 29 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <QRCodeCanvas value={token} size={250} level="H" includeMargin={true} />
      ) : (
        <p>Генерация кода...</p>
      )}
    </div>
  );
};
export default QrGenerator;