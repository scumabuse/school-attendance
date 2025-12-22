import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import axios from 'axios';
import { API_URL } from '../../config';
import { authHeaders } from '../../api/auth';

const QrGenerator = ({ teacherId }) => {
  const [token, setToken] = useState('');

  const fetchToken = async () => {
    try {
      const res = await axios.get(
        `${API_URL}/attendance/qr/refresh/${teacherId}`,
        { headers: { ...authHeaders() } }
      );
      setToken(res.data.token);
    } catch (err) { console.error("Ошибка обновления токена", err); }
  };

  useEffect(() => {
    fetchToken();
    // Токен живет 30 минут, обновляем чуть раньше истечения (29 минут)
    const interval = setInterval(fetchToken, 29 * 60 * 1000);
    return () => clearInterval(interval);
  }, [teacherId]);

  return (
    <div style={{ textAlign: 'center', padding: '10px' }}>
      {token ? (
        <QRCodeCanvas value={token} size={250} level="H" includeMargin={true} />
      ) : (
        <p>Генерация кода...</p>
      )}
    </div>
  );
};
export default QrGenerator;