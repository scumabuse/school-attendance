import React, { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';
import { API_URL } from '../../config';
import { authHeaders } from '../../api/auth';

const QrScanner = () => {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });

    scanner.render(async (decodedText) => {
      try {
        const response = await axios.post(
          `${API_URL}/attendance/qr/verify`,
          { token: decodedText },
          { headers: { ...authHeaders() } }
        );
        alert(response.data.message);
        scanner.clear();
      } catch (err) {
        alert(err.response?.data?.error || "Ошибка сканирования");
      }
    });

    return () => scanner.clear();
  }, []);

  return (
    <div style={{ maxWidth: '400px', margin: '20px auto' }}>
      <h2 style={{ textAlign: 'center' }}>Сканируйте QR преподавателя</h2>
      <div id="reader"></div>
    </div>
  );
};
export default QrScanner;