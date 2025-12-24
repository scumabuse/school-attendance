// utils/attendanceCalculator.js
const { DateTime } = require('luxon');

/**
 * ЕДИНЫЕ ПРАВИЛА ПОСЕЩАЕМОСТИ
 * Меняется ТОЛЬКО ЗДЕСЬ
 */
const ATTENDANCE_RULES = {
  PRESENT:       { isPresent: true,  countsInTotal: true,  bonus: 0   }, // П
  VALID_ABSENT:  { isPresent: true,  countsInTotal: true,  bonus: 0.2 }, // У (По приказу) - повышает процент
  ITHUB:         { isPresent: true,  countsInTotal: true,  bonus: 0   }, // IT
  DUAL:          { isPresent: true,  countsInTotal: true,  bonus: 0   }, // Д
  LATE:          { isPresent: false, countsInTotal: false, bonus: 0   }, // ОП (По заявлению) - не влияет на процент
  ABSENT:        { isPresent: false, countsInTotal: true,  bonus: 0   }, // О
  SICK:          { isPresent: false, countsInTotal: false, bonus: 0   }, // Б
};

/**
 * Учебные дни (ПН–ПТ) минус праздники
 */
function getAcademicDays(startDate, endDate, holidays = []) {
  const holidaySet = new Set(
    holidays.map(h => DateTime.fromJSDate(h.date).toISODate())
  );

  const days = [];
  let current = DateTime.fromJSDate(startDate).startOf('day');
  const end = DateTime.fromJSDate(endDate).startOf('day');

  while (current <= end) {
    const dateStr = current.toISODate();
    if (current.weekday <= 5 && !holidaySet.has(dateStr)) {
      days.push(dateStr);
    }
    current = current.plus({ days: 1 });
  }

  return days;
}

async function calculateAttendance(
  attendanceRecords,
  holidays = [],
  startDate,
  endDate
) {
  const academicDays = getAcademicDays(startDate, endDate, holidays);

  const recordsMap = new Map();
  attendanceRecords.forEach(r => {
    const dateStr = DateTime.fromJSDate(r.date).toISODate();
    recordsMap.set(dateStr, r.status);
  });

  let totalDays = 0;
  let presentDays = 0;
  let bonusPoints = 0;

  academicDays.forEach(dateStr => {
    const status = recordsMap.get(dateStr) || 'ABSENT';
    const rule = ATTENDANCE_RULES[status];
    if (!rule) return;

    if (rule.countsInTotal) {
      totalDays++;
      if (rule.isPresent) {
        presentDays++;
        // Добавляем бонусные очки для VALID_ABSENT (По приказу)
        bonusPoints += rule.bonus || 0;
      }
    }
  });

  // Рассчитываем процент с учетом бонусов
  // Бонус добавляется к числителю (presentDays), что повышает процент
  const percent = totalDays > 0
    ? Math.round(((presentDays + bonusPoints) / totalDays) * 100)
    : 100;
  
  // Ограничиваем процент максимумом 100%
  const finalPercent = Math.min(percent, 100);

  return {
    percent: finalPercent,
    presentDays,
    totalDays,
    absentDays: totalDays - presentDays
  };
}

module.exports = {
  ATTENDANCE_RULES,
  getAcademicDays,
  calculateAttendance
};
