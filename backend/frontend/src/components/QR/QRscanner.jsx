import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';
import { API_URL } from '../../config';
import { authHeaders } from '../../api/auth';

const QrScanner = () => {
  // Используем ref, чтобы избежать дубликатов запросов
  const isScanning = useRef(false);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", { 
      fps: 10, 
      qrbox: { width: 250, height: 250 },
      // Добавим поддержку мобильных камер
      rememberLastUsedCamera: true 
    });

    scanner.render(async (decodedText) => {
      // Блокируем повторные запросы, пока обрабатывается первый
      if (isScanning.current) return;
      isScanning.current = true;

      try {
        const response = await axios.post(
          `${API_URL}/attendance/qr/verify`,
          { token: decodedText },
          { headers: { ...authHeaders() } }
        );
        
        alert(response.data.message || "Успешно отмечено!");
        
        // После успеха лучше остановить камеру
        await scanner.clear();
        window.location.reload(); // Перезагружаем, чтобы обновить список посещаемости
      } catch (err) {
        alert(err.response?.data?.error || "Ошибка сканирования");
        // Разблокируем для повторной попытки при ошибке
        isScanning.current = false;
      }
    });

    return () => {
      // Безопасная очистка
      scanner.clear().catch(error => console.error("Ошибка при закрытии сканера", error));
    };
  }, []);

  return (
    <div style={{ maxWidth: '400px', margin: '20px auto', padding: '10px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
        Сканируйте QR преподавателя
      </h2>
      {/* Контейнер для камеры */}
      <div id="reader" style={{ borderRadius: '10px', overflow: 'hidden' }}></div>
      
      <p style={{ textAlign: 'center', marginTop: '15px', color: '#666', fontSize: '14px' }}>
        Наведите камеру на QR-код, чтобы отметиться на паре
      </p>
    </div>
  );
};

export default QrScanner;