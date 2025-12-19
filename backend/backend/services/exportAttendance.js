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
  LATE: 'ОП'
};

const STATUS_COLORS = {
  'П': 'FF90EE90',
  'О': 'FFFFCC00',
  'Б': 'FFFF6666',
  'У': 'FF92D050',
  'IT': 'FF4472C4',
  'Д': 'FFADD8E6',
  'ОП': 'FFFFA500'
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

    const academicDays = getAcademicDays(start.toJSDate(), end.toJSDate(), holidays);

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

      academicDays.forEach(dateStr => {
        const cell = row.getCell(dateStr);
        const record = attendanceMap.get(`${student.id}_${dateStr}`);

        const status = record?.status || 'ABSENT';
        const display = STATUS_MAP[status];

        cell.value = display;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: STATUS_COLORS[display] }
        };

        if (status === 'LATE' && record?.lateMinutes != null) {
          cell.note = `Опоздание: ${record.lateMinutes} мин`;
        }
      });

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
