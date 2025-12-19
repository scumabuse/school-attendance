import { API_URL } from "../config";
import { authHeaders } from "./auth";

/**
 * Получить процент посещаемости группы
 * @param {string} groupId - ID группы
 * @param {string} type - Тип периода (academic_year, semester1, semester2, month, week, today, custom)
 * @param {string} start - Начало периода (для custom)
 * @param {string} end - Конец периода (для custom)
 * @returns {Promise<{percent: number, ...}>}
 */
export async function getGroupAttendancePercent(groupId, type = 'academic_year', start, end) {
  const params = new URLSearchParams({ type });
  if (type === 'custom' && start && end) {
    params.append('start', start);
    params.append('end', end);
  }

  const res = await fetch(`${API_URL}/attendance/group/${groupId}/percent?${params}`, {
    headers: { ...authHeaders() }
  });

  if (!res.ok) {
    throw new Error('Ошибка загрузки процента посещаемости группы');
  }

  return res.json();
}

/**
 * Получить процент посещаемости студента
 * @param {string} studentId - ID студента
 * @param {string} type - Тип периода (academic_year, semester1, semester2, month, week, today, custom)
 * @param {string} start - Начало периода (для custom)
 * @param {string} end - Конец периода (для custom)
 * @returns {Promise<{percent: number, ...}>}
 */
export async function getStudentAttendancePercent(studentId, type = 'academic_year', start, end) {
  const params = new URLSearchParams({ type });
  if (type === 'custom' && start && end) {
    params.append('start', start);
    params.append('end', end);
  }

  const res = await fetch(`${API_URL}/attendance/student/${studentId}/percent?${params}`, {
    headers: { ...authHeaders() }
  });

  if (!res.ok) {
    throw new Error('Ошибка загрузки процента посещаемости студента');
  }

  return res.json();
}
