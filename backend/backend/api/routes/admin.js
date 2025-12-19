// api/routes/admin.js
// Административные маршруты

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { DateTime } = require('luxon');

const router = express.Router();
const prisma = new PrismaClient();

// Импорт сервиса экспорта
const { exportAttendanceService } = require('../../backend/services/exportAttendance');

/**
 * GET /api/export/attendance
 * Экспорт посещаемости в Excel
 * Headers: Authorization: Bearer <token>
 * Query params:
 *   - groupIds?: string (через запятую, например "id1,id2,id3")
 *   - dateRangeType?: 'today' | 'week' | 'month' | 'academic_year' | 'custom'
 *   - startDate?: string (ISO date, для custom)
 *   - endDate?: string (ISO date, для custom)
 * Response: Excel файл
 */
router.get('/export/attendance', (req, res) => {
  exportAttendanceService(prisma, req, res);
});

/**
 * POST /api/admin/finish-year
 * Завершение учебного года
 * Headers: Authorization: Bearer <token>
 * Response: { success: boolean, message: string, deletedGroups: Array<string> }
 */
router.post('/finish-year', async (req, res) => {
  try {
    const now = DateTime.now();
    const year = now.month >= 9 ? now.year : now.year - 1;
    const nextYear = year + 1;
    const archiveTable = `attendance_archive_${year}_${nextYear}`;

    // Создаём архивную таблицу и копируем всё
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${archiveTable}" (LIKE "Attendance" INCLUDING ALL);
      INSERT INTO "${archiveTable}" SELECT * FROM "Attendance";
      DELETE FROM "Attendance";
    `);

    // Удаляем выпускников
    const graduates = await prisma.group.findMany({
      where: {
        OR: [
          { specialty: { durationYears: 3 }, course: 3 },
          { specialty: { durationYears: 4 }, course: 4 }
        ]
      }
    });

    await prisma.group.deleteMany({
      where: { id: { in: graduates.map(g => g.id) } }
    });

    // Поднимаем курс остальным
    await prisma.group.updateMany({
      data: { course: { increment: 1 } }
    });

    res.json({
      success: true,
      message: `Год завершён. Архивировано в ${archiveTable}`,
      deletedGroups: graduates.map(g => g.name)
    });
  } catch (err) {
    console.error('Ошибка завершения года:', err);
    res.status(500).json({ error: 'Не удалось завершить год' });
  }
});

/**
 * GET /api/admin/stats
 * Получить статистику системы
 * Headers: Authorization: Bearer <token>
 * Response: { users: number, groups: number, students: number, specialties: number, attendanceRecords: number }
 */
router.get('/stats', async (req, res) => {
  try {
    const [users, groups, students, specialties, attendanceRecords] = await Promise.all([
      prisma.user.count(),
      prisma.group.count(),
      prisma.student.count(),
      prisma.specialty.count(),
      prisma.attendance.count()
    ]);

    res.json({
      users,
      groups,
      students,
      specialties,
      attendanceRecords
    });
  } catch (err) {
    console.error('Ошибка получения статистики:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/admin/stats/attendance
 * Получить статистику посещаемости
 * Headers: Authorization: Bearer <token>
 * Query params:
 *   - groupId?: string
 *   - startDate?: string (ISO date)
 *   - endDate?: string (ISO date)
 * Response: { total: number, present: number, absent: number, sick: number, validAbsent: number, ithub: number, percentage: number }
 */
router.get('/stats/attendance', async (req, res) => {
  try {
    const { groupId, startDate, endDate } = req.query;
    const where = {};

    if (groupId) where.groupId = groupId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    const attendance = await prisma.attendance.findMany({ where });

    const stats = {
      total: attendance.length,
      present: attendance.filter(a => a.status === 'PRESENT').length,
      absent: attendance.filter(a => a.status === 'ABSENT').length,
      sick: attendance.filter(a => a.status === 'SICK').length,
      validAbsent: attendance.filter(a => a.status === 'VALID_ABSENT').length,
      ithub: attendance.filter(a => a.status === 'ITHUB').length
    };

    const presentCount = stats.present + stats.validAbsent + stats.ithub;
    const totalCount = stats.total - stats.sick; // Исключаем больничные из общего подсчёта
    stats.percentage = totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(2) : 0;

    res.json(stats);
  } catch (err) {
    console.error('Ошибка получения статистики посещаемости:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/test
 * Тестовый маршрут для проверки работы сервера
 * Response: { message: string }
 */
router.get('/test', (req, res) => {
  res.json({ message: 'Бэкенд работает!' });
});

module.exports = router;




