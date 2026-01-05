// services/exportAttendance.js
const { DateTime } = require('luxon');
const exceljs = require('exceljs');
const { calculateAttendance, getAcademicDays } = require('../utils/attendanceCalculator');

// Единая таймзона для экспорта и отметки посещаемости
// Должна совпадать с таймзоной, которая используется при сохранении посещаемости (см. api/routes/attendance.js)
const ATTENDANCE_TIMEZONE = 'Asia/Almaty';

const STATUS_MAP = {
  PRESENT: 'П',
  ABSENT: 'О',
  SICK: 'Б',
  ITHUB: 'IT',
  VALID_ABSENT: 'У',
  DUAL: 'Д',
  LATE: 'ОП',
  REMOTE: 'Дис'
};

const STATUS_COLORS = {
  'П': 'FF90EE90',
  'О': 'FF6868',
  'Б': 'FFFFCC00',
  'У': '507CFF',
  'IT': 'C300FF',
  'Д': 'FFADD8E6',
  'ОП': 'FFFFA500',
  'Дис': 'FFD1C4E9',
  'Пр': 'FFADD8E6',
  'Вых': 'FFDDDDDD'
};

function getDateRange(type, customStart, customEnd) {
  // Используем ту же таймзону, что и при сохранении посещаемости,
  // чтобы "сегодня" в экспорте совпадал с "сегодня" в журнале.
  const now = DateTime.now().setZone(ATTENDANCE_TIMEZONE);
  const year = now.month >= 9 ? now.year : now.year - 1;
  const next = year + 1;

  const ranges = {
    today: { start: now, end: now },
    week: { start: now.minus({ days: 6 }), end: now },
    month: { start: now.startOf('month'), end: now.endOf('month') },
    academic_year: {
      start: DateTime.fromObject({ year, month: 9, day: 1 }),
      end: DateTime.fromObject({ year: next, month: 7, day: 31 })
    },
    custom: {
      start: DateTime.fromISO(customStart),
      end: DateTime.fromISO(customEnd)
    }
  };

  const range = ranges[type] || ranges.academic_year;
  return {
    start: range.start.startOf('day'),
    end: range.end.endOf('day')
  };
}

async function exportAttendanceService(prisma, req, res) {
  try {
    const { groupIds = '', dateRangeType, startDate, endDate } = req.query;
    const groups = groupIds ? groupIds.split(',') : [];

    const { start, end } = getDateRange(dateRangeType, startDate, endDate);

    const holidays = await prisma.holiday.findMany({
      where: { date: { gte: start.toJSDate(), lte: end.toJSDate() } }
    });

    const students = await prisma.student.findMany({
      where: groups.length ? { groupId: { in: groups } } : {},
      include: { group: true }
    });

    if (!students.length) {
      return res.status(404).json({ error: 'Студенты не найдены' });
    }

    const attendance = await prisma.attendance.findMany({
      where: {
        studentId: { in: students.map(s => s.id) },
        // Диапазон дат также считаем в единой таймзоне,
        // чтобы записи за "сегодня" не попадали в "вчера" из‑за сдвигов.
        date: { gte: start.toJSDate(), lte: end.toJSDate() }
      }
    });

    const generateAllDaysInRange = (startDate, endDate) => {
      const days = [];
      let current = DateTime.fromJSDate(startDate)
        .setZone(ATTENDANCE_TIMEZONE)
        .startOf('day');
      const endDt = DateTime.fromJSDate(endDate)
        .setZone(ATTENDANCE_TIMEZONE)
        .startOf('day');

      while (current <= endDt) {
        days.push(current.toISODate());
        current = current.plus({ days: 1 });
      }
      return days;
    };

    const academicDays = generateAllDaysInRange(start.toJSDate(), end.toJSDate());

    const attendanceMap = new Map();
    attendance.forEach(r => {
      // Приводим дату записи к той же таймзоне, что и диапазон,
      // чтобы ключи совпадали с учебными днями и "сегодня" не съезжал на "вчера".
      const dateStr = DateTime
        .fromJSDate(r.date)
        .setZone(ATTENDANCE_TIMEZONE, { keepLocalTime: true })
        .toISODate();
      attendanceMap.set(`${r.studentId}_${dateStr}`, r);
    });

    const workbook = new exceljs.Workbook();
    const sheet = workbook.addWorksheet('Посещаемость');

    sheet.columns = [
      { header: 'ФИО', key: 'name', width: 30 },
      { header: 'Группа', key: 'group', width: 12 },
      ...academicDays.map(d => ({
        header: DateTime.fromISO(d).toFormat('dd.MM'),
        key: d,
        width: 6
      })),
      { header: '%', key: 'percent', width: 8 }
    ];

    sheet.getRow(1).font = { bold: true };

    let rowIndex = 2;

    for (const student of students) {
      const row = sheet.getRow(rowIndex++);
      row.getCell('name').value = student.fullName;
      row.getCell('group').value = student.group.name;

      const studentRecords = attendance.filter(a => a.studentId === student.id);

      const stats = await calculateAttendance(
        studentRecords,
        holidays,
        start.toJSDate(),
        end.toJSDate()
      );

      for (const dateStr of academicDays) {
        const cell = row.getCell(dateStr);
        const record = attendanceMap.get(`${student.id}_${dateStr}`);

        const dt = DateTime.fromISO(dateStr).setZone(ATTENDANCE_TIMEZONE);

        const isWeekend = dt.weekday === 6 || dt.weekday === 7;

        const isHoliday = holidays.some(h => {
          const holidayDate = DateTime.fromJSDate(h.date).toISODate();
          return holidayDate === dateStr;
        });

        // ←←← НОВАЯ ПРОВЕРКА ПРАКТИКИ ←←←
        const practice = await prisma.practiceDay.findUnique({
          where: {
            groupId_date: {
              groupId: student.groupId,
              date: dt.toJSDate()
            }
          }
        });
        const isPractice = !!practice;

        let display = 'О';
        let bgColor = STATUS_COLORS['О'];

        if (isWeekend || isHoliday || isPractice) {
          display = isPractice ? 'Пр' : 'Вых';
          bgColor = isPractice ? STATUS_COLORS['Пр'] : STATUS_COLORS['Вых'];
        } else if (record) {
          display = STATUS_MAP[record.status] || 'О';
          bgColor = STATUS_COLORS[display] || STATUS_COLORS['О'];
        }

        cell.value = display;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor }
        };

        // Подсказки
        if (record?.status === 'LATE' && record?.lateMinutes != null) {
          cell.note = `Опоздание: ${record.lateMinutes} мин`;
        }

        if (isHoliday) {
          const holiday = holidays.find(h => DateTime.fromJSDate(h.date).toISODate() === dateStr);
          if (holiday?.name) {
            cell.note = holiday.name;
          }
        }

        if (isPractice && practice?.name) {
          cell.note = `Практика: ${practice.name}`;
        }
      }

      row.getCell('percent').value = `${stats.percent}%`;
      row.getCell('percent').font = { bold: true };
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=attendance_${DateTime.now().toISODate()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
}

module.exports = { exportAttendanceService };
