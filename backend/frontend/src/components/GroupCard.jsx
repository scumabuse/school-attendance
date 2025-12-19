import React from "react";

export default function GroupCard({ group }) {
  return (
    <div
      style={{
        background: "#ffffff",
        padding: "16px",
        borderRadius: "12px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        marginBottom: "16px"
      }}
    >
      <h2 style={{ marginBottom: "8px" }}>{group.name}</h2>

      <p><strong>Год поступления:</strong> {group.admissionYear}</p>
      <p><strong>Курс:</strong> {group.course}</p>
      <p><strong>Специальность ID:</strong> {group.specialtyId}</p>
      <p><strong>Куратор ID:</strong> {group.curatorId}</p>

      <small style={{ color: "#666" }}>
        Создано: {new Date(group.createdAt).toLocaleDateString()}
      </small>
    </div>
  );
}
