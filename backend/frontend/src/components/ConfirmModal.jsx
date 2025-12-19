import React from 'react';
import './ConfirmModal.css';

const ConfirmModal = ({ isOpen, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{message}</h3>
        <div className="confirm-modal-buttons">
          <button className="confirm-btn-yes" onClick={onConfirm}>
            Да
          </button>
          <button className="confirm-btn-no" onClick={onCancel}>
            Нет
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;

