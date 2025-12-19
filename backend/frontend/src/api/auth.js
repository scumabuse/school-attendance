import { API_URL } from "../config";

export async function loginUser(login, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Ошибка авторизации");
  }

  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  return data.user;
}

export function getToken() {
  return localStorage.getItem("token");
}

export function getUser() {
  const saved = localStorage.getItem("user");
  return saved ? JSON.parse(saved) : null;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

// Простая проверка токена на клиенте — бэкенд не предоставляет /verify
export async function verifyToken() {
  const token = getToken();
  if (!token) return null;
  return getUser();
}

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

