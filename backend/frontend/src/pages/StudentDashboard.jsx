import React, { useEffect, useState } from "react";
import QrScanner from "../components/QR/QRscanner";
import { API_URL } from "../config";
import { authHeaders, getUser } from "../api/auth";

const StudentDashboard = () => {
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <h1 style={{ marginBottom: "8px" }}>Кабинет студента</h1>
      <p style={{ marginBottom: "24px", color: "#555" }}>
        {user?.fullName || "Студент"} — сканируйте QR преподавателя или заведующей,
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
                  <th style={{ padding: "8px", textAlign: "left" }}>Группа</th>
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
    </div>
  );
};

export default StudentDashboard;


