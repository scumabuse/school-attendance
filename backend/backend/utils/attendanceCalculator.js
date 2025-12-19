// utils/attendanceCalculator.js
const { DateTime } = require('luxon');

/**
 * ЕДИНЫЕ ПРАВИЛА ПОСЕЩАЕМОСТИ
 * Меняется ТОЛЬКО ЗДЕСЬ
 */
const ATTENDANCE_RULES = {
  PRESENT:       { isPresent: true,  countsInTotal: true  }, // П
  VALID_ABSENT:  { isPresent: true,  countsInTotal: true  }, // У
  ITHUB:         { isPresent: true,  countsInTotal: true  }, // IT
  DUAL:          { isPresent: true,  countsInTotal: true  }, // Д
  LATE:          { isPresent: true,  countsInTotal: true  }, // ОП
  ABSENT:        { isPresent: false, countsInTotal: true  }, // О
  SICK:          { isPresent: false, countsInTotal: false }, // Б
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

  academicDays.forEach(dateStr => {
    const status = recordsMap.get(dateStr) || 'ABSENT';
    const rule = ATTENDANCE_RULES[status];
    if (!rule) return;

    if (rule.countsInTotal) {
      totalDays++;
      if (rule.isPresent) presentDays++;
    }
  });

  const percent = totalDays > 0
    ? Math.round((presentDays / totalDays) * 100)
    : 100;

  return {
    percent,
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
