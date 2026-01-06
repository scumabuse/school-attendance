import React, { useEffect, useState } from "react";
import QrScanner from "../components/QR/QRscanner";
import { API_URL } from "../config";
import { authHeaders, getUser, logout } from "../api/auth";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";

const StudentDashboard = () => {
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const u = getUser();
    setUser(u);
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/attendance?studentId=current`, {
        headers: { ...authHeaders() },
      });

      if (!res.ok) {
        throw new Error("Не удалось загрузить историю посещаемости");
      }

      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Ошибка загрузки истории");
    } finally {
      setLoading(false);
    }
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

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <h1 style={{ margin: 0 }}>Кабинет ученика</h1>
        <button
          className="logout-btn"
          onClick={handleLogoutClick}
        >
          Выйти
        </button>
      </div>
      <p style={{ marginBottom: "24px", color: "#555" }}>
        {user?.fullName || "Ученик"} — сканируйте QR преподавателя или заведующей,
        чтобы отметиться на занятии.
      </p>

      {/* Блок сканера */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          padding: "20px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
          marginBottom: "28px",
        }}
      >
        <QrScanner />
      </div>

      {/* История посещаемости */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          padding: "20px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ margin: 0 }}>Моя посещаемость</h2>
          <button
            onClick={fetchHistory}
            style={{
              padding: "6px 14px",
              borderRadius: "999px",
              border: "1px solid #ddd",
              background: "#f8f9fa",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Обновить
          </button>
        </div>

        {loading && <p>Загрузка истории...</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}

        {!loading && history.length === 0 && !error && (
          <p style={{ color: "#777" }}>Записей пока нет.</p>
        )}

        {!loading && history.length > 0 && (
          <div style={{ maxHeight: "360px", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f7f7f7" }}>
                  <th style={{ padding: "8px", textAlign: "left" }}>Дата</th>
                  <th style={{ padding: "8px", textAlign: "left" }}>Класс</th>
                  <th style={{ padding: "8px", textAlign: "left" }}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => {
                  const d = new Date(item.date);
                  const dateStr = d.toLocaleDateString("ru-RU");

                  let label = "";
                  let color = "#333";
                  if (item.status === "PRESENT") {
                    label = "Присутствует";
                    color = "#2e7d32";
                  } else if (item.status === "ABSENT") {
                    label = "Отсутствует";
                    color = "#c62828";
                  } else if (item.status === "SICK") {
                    label = "Больничный";
                    color = "#ef6c00";
                  } else if (item.status === "VALID_ABSENT") {
                    label = "По приказу";
                    color = "#1565c0";
                  } else if (item.status === "ITHUB") {
                    label = "IT HUB";
                    color = "#7b1fa2";
                  } else if (item.status === "DUAL") {
                    label = "Дуальное";
                    color = "#0277bd";
                  } else if (item.status === "LATE") {
                    label = "По заявлению";
                    color = "#e65100";
                  }

                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "8px" }}>{dateStr}</td>
                      <td style={{ padding: "8px" }}>{item.group?.name || "—"}</td>
                      <td style={{ padding: "8px" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "999px",
                            background: "#f1f3f4",
                            color,
                            fontWeight: 500,
                          }}
                        >
                          {label || item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={showLogoutModal}
        message="Вы точно хотите выйти?"
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
      />
      <style>{`
        .logout-btn {
          padding: 10px 20px;
          background-color: #f44336;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .logout-btn:hover {
          background-color: #d32f2f;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
        }

        .logout-btn:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
};

export default StudentDashboard;


