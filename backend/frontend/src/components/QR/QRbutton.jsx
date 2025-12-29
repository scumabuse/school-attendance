import React, { useState } from 'react';
import QrGenerator from './QRgenerator';

const QrButton = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        style={{ position: 'fixed', bottom: '83px', right: '25px', width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#007bff', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 1000, fontSize: '20px' }}
      >
        QR
      </button>

      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1001 }} onClick={() => setIsOpen(false)}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '15px', position: 'relative', minWidth: '300px' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsOpen(false)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer' }}>×</button>
            
            <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>Генерация QR-кода</h3>
            
            <QrGenerator teacherId={user.id} />
            
            <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '12px', color: '#666' }}>
              QR-код автоматически определит текущую пару по расписанию
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default QrButton;