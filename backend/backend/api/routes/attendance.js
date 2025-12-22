// api/routes/attendance.js
// Маршруты для управления посещаемостью

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const qrService = require('../../services/QRservice');
const { DateTime } = require('luxon');
const ATTENDANCE_TIMEZONE = 'Asia/Almaty';
const router = express.Router();
const prisma = new PrismaClient();

function normalizeAttendanceDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Проверяет, является ли дата выходным (суббота или воскресенье)
 */
function isWeekend(date) {
  const dt = DateTime.fromJSDate(date);
  return dt.weekday === 6 || dt.weekday === 7; // Суббота или воскресенье
}

/**
 * Проверяет, является ли дата праздником
 */
async function isHoliday(date) {
  const holiday = await prisma.holiday.findUnique({
    where: { date }
  });
  return !!holiday;
}

/**
 * Вычисляет количество минут опоздания на основе расписания группы
 */
async function calculateLateMinutes(groupId, date, markedAt) {
  try {
    const dt = DateTime.fromJSDate(date);
    const dayOfWeek = dt.weekday; // 1 = понедельник, 5 = пятница

    if (dayOfWeek < 1 || dayOfWeek > 5) {
      return null; // Не учебный день
    }

    const schedule = await prisma.schedule.findUnique({
      where: {
        groupId_dayOfWeek: {
          groupId,
          dayOfWeek
        }
      }
    });

    if (!schedule || !schedule.startTime) {
      return null; // Нет расписания для этого дня
    }

    // Парсим время начала пары (формат "HH:mm")
    const [hours, minutes] = schedule.startTime.split(':').map(Number);
    const startTime = dt.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

    // markedAt уже должен быть DateTime или Date
    const marked = markedAt instanceof Date
      ? DateTime.fromJSDate(markedAt)
      : DateTime.fromISO(markedAt);

    const diff = marked.diff(startTime, 'minutes').minutes;
    return diff > 0 ? Math.round(diff) : 0; // Если не опоздал, возвращаем 0
  } catch (err) {
    console.error('Ошибка расчета опоздания:', err);
    return null;
  }
}

/**
 * GET /api/attendance/log
 * Получить лог посещаемости
 * Headers: Authorization: Bearer <token>
 * Query params: 
 *   - groupId?: string (фильтр по группе)
 *   - date?: string (ISO date, фильтр по дате)
 *   - studentId?: string (фильтр по студенту)
 *   - startDate?: string (ISO date, начало периода)
 *   - endDate?: string (ISO date, конец периода)
 * Response: Array<{ fullName, groupName, status, date, updatedAt, updatedBy }>
 */
router.get('/log', async (req, res) => {
  try {
    const { groupId, date, studentId, startDate, endDate } = req.query;
    const where = {};

    if (groupId) where.groupId = groupId;
    if (studentId) where.studentId = studentId;

    if (date) {
      const startOfDay = normalizeAttendanceDate(date); // Например: 2025-12-22T00:00:00.000Z

      const endOfDay = new Date(startOfDay);
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1); // 2025-12-23T00:00:00.000Z

      where.date = {
        gte: startOfDay,
        lt: endOfDay
      };

      console.log('LOG DATE RANGE:', startOfDay.toISOString(), 'to', endOfDay.toISOString());
      console.log('Запрос логов для даты:', date, 'Диапазон:', startOfDay, 'до', endOfDay);
    
  } else if (startDate || endDate) {
    // Период
    where.date = {};
    if (startDate) {
      where.date.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.date.lte = end;
    }
  }

  const logs = await prisma.attendance.findMany({
    where,
    include: {
      student: { select: { fullName: true } },
      group: { select: { name: true } },
      updatedBy: { select: { fullName: true } }
    },
    orderBy: { date: 'desc' }
  });

  console.log('Найдено логов:', logs.length, 'для запроса:', JSON.stringify(where));

  console.log('LOGS TO SEND:', logs);

  res.json(logs.map(l => ({
    id: l.id,
    studentId: l.studentId,
    groupId: l.groupId,
    fullName: l.student.fullName,
    groupName: l.group.name,
    status: l.status,
    date: l.date,
    updatedAt: l.updatedAt,
    updatedBy: l.updatedBy?.fullName || 'Система'
  })));

} catch (err) {
  console.error('Ошибка получения лога посещаемости:', err);
  res.status(500).json({ error: 'Ошибка сервера' });
}
});
/**
 * GET /api/attendance
 * Получить посещаемость с фильтрами
 * Headers: Authorization: Bearer <token>
 * Query params:
 *   - groupId?: string
 *   - studentId?: string
 *   - date?: string (ISO date)
 *   - startDate?: string (ISO date)
 *   - endDate?: string (ISO date)
 * Response: Array<{ id, studentId, groupId, date, status, updatedAt, updatedById, student, group }>
 */
router.get('/', async (req, res) => {
  try {
    const { groupId, studentId, date, startDate, endDate } = req.query;
    const where = {};

    if (groupId) where.groupId = groupId;
    if (studentId) where.studentId = studentId;

    if (date) {
      where.date = normalizeAttendanceDate(date);
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = normalizeAttendanceDate(startDate);
      }
      if (endDate) {
        where.date.lte = normalizeAttendanceDate(endDate);
      }
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true } },
        group: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, fullName: true } }
      },
      orderBy: { date: 'desc' }
    });

    res.json(attendance);
  } catch (err) {
    console.error('Ошибка получения посещаемости:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/attendance/:id
 * Получить запись посещаемости по ID
 * Headers: Authorization: Bearer <token>
 * Response: { id, studentId, groupId, date, status, updatedAt, updatedById, student, group, updatedBy }
 */
router.get('/:id', async (req, res) => {
  try {
    const attendance = await prisma.attendance.findUnique({
      where: { id: req.params.id },
      include: {
        student: { select: { id: true, fullName: true } },
        group: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, fullName: true } }
      }
    });

    if (attendance.length === 0) {
      console.log('Ни одной записи посещаемости для этой даты');
      // Дальше можно либо вернуть нули, либо строить массив студентов с 0
    }


    res.json(attendance);
  } catch (err) {
    console.error('Ошибка получения посещаемости:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/attendance
 * Создать или обновить запись посещаемости
 * Headers: Authorization: Bearer <token>
 * Body: { studentId: string, groupId: string, date: string (ISO date), status: AttendanceStatus }
 * Response: { id, studentId, groupId, date, status, updatedAt, updatedById }
 */
router.post('/', async (req, res) => {
  try {
    const { studentId, groupId, date, status, markedAt } = req.body;

    if (!studentId || !groupId || !date || !status) {
      return res.status(400).json({ error: 'studentId, groupId, date и status обязательны' });
    }

    // Проверка существования студента и группы
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return res.status(400).json({ error: 'Студент не найден' });
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(400).json({ error: 'Группа не найдена' });
    }

    // Проверка, что студент принадлежит группе
    if (student.groupId !== groupId) {
      return res.status(400).json({ error: 'Студент не принадлежит указанной группе' });
    }

    const cleanDate = normalizeAttendanceDate(date);


    // Валидация: запрет отметок в выходные и праздники
    if (isWeekend(cleanDate)) {
      return res.status(400).json({ error: 'Нельзя отметить посещаемость в выходной день' });
    }

    if (await isHoliday(cleanDate)) {
      return res.status(400).json({ error: 'Нельзя отметить посещаемость в праздничный день' });
    }

    const updatedById = req.user?.id || null;

    // Для статуса LATE вычисляем опоздание
    let lateMinutes = null;
    let finalMarkedAt = markedAt ? DateTime.fromISO(markedAt).toJSDate() : new Date();

    if (status === 'LATE') {
      // Если lateMinutes переданы в запросе (ручной таймер), используем их
      if (req.body.lateMinutes !== undefined) {
        lateMinutes = req.body.lateMinutes;
      } else {
        // Иначе вычисляем на основе расписания
        lateMinutes = await calculateLateMinutes(groupId, cleanDate, finalMarkedAt);
      }
      // Если не удалось вычислить, всё равно сохраняем, но lateMinutes будет null
    }

    const attendance = await prisma.attendance.upsert({
      where: { studentId_date: { studentId, date: cleanDate } },
      update: {
        status,
        updatedById,
        ...(status === 'LATE' && { markedAt: finalMarkedAt, lateMinutes }),
        ...(status !== 'LATE' && { markedAt: null, lateMinutes: null }) // Очищаем для других статусов
      },
      create: {
        studentId,
        groupId,
        date: cleanDate,
        status,
        updatedById,
        ...(status === 'LATE' && { markedAt: finalMarkedAt, lateMinutes })
      }
    });

    res.json(attendance);
  } catch (err) {
    console.error('Ошибка создания/обновления посещаемости:', err);
    res.status(400).json({ error: 'Не удалось сохранить посещаемость' });
  }
});

/**
 * PUT /api/attendance/:id
 * Полное обновление записи посещаемости
 * Headers: Authorization: Bearer <token>
 * Body: { status: AttendanceStatus, date?: string, studentId?: string, groupId?: string }
 * Response: { id, studentId, groupId, date, status, updatedAt, updatedById }
 */
router.put('/:id', async (req, res) => {
  try {
    const { status, date, studentId, groupId, markedAt } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status обязателен' });
    }

    // Получаем текущую запись для получения groupId и date
    const current = await prisma.attendance.findUnique({
      where: { id: req.params.id }
    });

    if (!current) {
      return res.status(404).json({ error: 'Запись посещаемости не найдена' });
    }

    const finalGroupId = groupId || current.groupId;
    const finalDate = date
      ? normalizeAttendanceDate(date)
      : current.date;


    // Валидация: запрет отметок в выходные и праздники
    if (isWeekend(finalDate)) {
      return res.status(400).json({ error: 'Нельзя отметить посещаемость в выходной день' });
    }

    if (await isHoliday(finalDate)) {
      return res.status(400).json({ error: 'Нельзя отметить посещаемость в праздничный день' });
    }

    const data = { status, updatedById: req.user?.id || null };

    if (date) {
      data.date = finalDate;
    }
    if (studentId) data.studentId = studentId;
    if (groupId) data.groupId = groupId;

    // Для статуса LATE вычисляем опоздание
    if (status === 'LATE') {
      const finalMarkedAt = markedAt ? DateTime.fromISO(markedAt).toJSDate() : new Date();
      const lateMinutes = await calculateLateMinutes(finalGroupId, finalDate, finalMarkedAt);
      data.markedAt = finalMarkedAt;
      data.lateMinutes = lateMinutes;
    } else {
      // Очищаем для других статусов
      data.markedAt = null;
      data.lateMinutes = null;
    }

    const attendance = await prisma.attendance.update({
      where: { id: req.params.id },
      data
    });

    res.json(attendance);
  } catch (err) {
    console.error('Ошибка обновления посещаемости:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Запись посещаемости не найдена' });
    }
    res.status(400).json({ error: 'Не удалось обновить посещаемость' });
  }
});

/**
 * PATCH /api/attendance/:id
 * Частичное обновление записи посещаемости
 * Headers: Authorization: Bearer <token>
 * Body: { status?: AttendanceStatus }
 * Response: { id, studentId, groupId, date, status, updatedAt, updatedById }
 */
router.patch('/:id', async (req, res) => {
  try {
    const { status, markedAt } = req.body;
    const data = {};

    if (status !== undefined) data.status = status;
    if (Object.keys(data).length === 0 && markedAt === undefined) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    data.updatedById = req.user?.id || null;

    // Получаем текущую запись для валидации даты и groupId
    const current = await prisma.attendance.findUnique({
      where: { id: req.params.id }
    });

    if (!current) {
      return res.status(404).json({ error: 'Запись посещаемости не найдена' });
    }

    // Валидация: запрет отметок в выходные и праздники
    if (isWeekend(current.date)) {
      return res.status(400).json({ error: 'Нельзя отметить посещаемость в выходной день' });
    }

    if (await isHoliday(current.date)) {
      return res.status(400).json({ error: 'Нельзя отметить посещаемость в праздничный день' });
    }

    // Для статуса LATE вычисляем опоздание
    if (status === 'LATE' || (status === undefined && current.status === 'LATE')) {
      const finalMarkedAt = markedAt ? DateTime.fromISO(markedAt).toJSDate() : new Date();
      const lateMinutes = await calculateLateMinutes(current.groupId, current.date, finalMarkedAt);
      data.markedAt = finalMarkedAt;
      data.lateMinutes = lateMinutes;
    } else if (status !== undefined && status !== 'LATE') {
      // Если меняем статус на не-LATE, очищаем
      data.markedAt = null;
      data.lateMinutes = null;
    }

    const attendance = await prisma.attendance.update({
      where: { id: req.params.id },
      data
    });

    res.json(attendance);
  } catch (err) {
    console.error('Ошибка обновления посещаемости:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Запись посещаемости не найдена' });
    }
    res.status(400).json({ error: 'Не удалось обновить посещаемость' });
  }
});

/**
 * DELETE /api/attendance/:id
 * Удалить запись посещаемости
 * Headers: Authorization: Bearer <token>
 * Response: { message: string }
 */
router.delete('/:id', async (req, res) => {
  try {
    await prisma.attendance.delete({ where: { id: req.params.id } });
    res.json({ message: 'Запись посещаемости удалена' });
  } catch (err) {
    console.error('Ошибка удаления посещаемости:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Запись посещаемости не найдена' });
    }
    res.status(500).json({ error: 'Не удалось удалить запись посещаемости' });
  }
});

/**
 * POST /api/attendance/batch
 * Массовое создание/обновление посещаемости
 * Headers: Authorization: Bearer <token>
 * Body: { records: Array<{ studentId, groupId, date, status }> }
 * Response: { created: number, updated: number, errors: Array<string> }
 */
router.post('/batch', async (req, res) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'records должен быть непустым массивом' });
    }

    const errors = [];
    let created = 0;
    let updated = 0;

    for (const record of records) {
      try {
        const { studentId, groupId, date, status, markedAt } = record;

        if (!studentId || !groupId || !date || !status) {
          errors.push(`Неполные данные: ${JSON.stringify(record)}`);
          continue;
        }

        const cleanDate = normalizeAttendanceDate(date);


        // Валидация: запрет отметок в выходные и праздники
        if (isWeekend(cleanDate)) {
          errors.push(`Выходной день: ${date}`);
          continue;
        }

        if (await isHoliday(cleanDate)) {
          errors.push(`Праздничный день: ${date}`);
          continue;
        }

        const updatedById = req.user?.id || null;

        // Для статуса LATE вычисляем опоздание
        let lateMinutes = null;
        let finalMarkedAt = markedAt ? DateTime.fromISO(markedAt).toJSDate() : new Date();

        if (status === 'LATE') {
          // Если lateMinutes переданы в запросе (ручной таймер), используем их
          if (record.lateMinutes !== undefined) {
            lateMinutes = record.lateMinutes;
          } else {
            // Иначе вычисляем на основе расписания
            lateMinutes = await calculateLateMinutes(groupId, cleanDate, finalMarkedAt);
          }
        }

        const existing = await prisma.attendance.findUnique({
          where: { studentId_date: { studentId, date: cleanDate } }
        });

        if (existing) {
          await prisma.attendance.update({
            where: { id: existing.id },
            data: {
              status,
              updatedById,
              ...(status === 'LATE' && { markedAt: finalMarkedAt, lateMinutes }),
              ...(status !== 'LATE' && { markedAt: null, lateMinutes: null })
            }
          });
          updated++;
        } else {
          await prisma.attendance.create({
            data: {
              studentId,
              groupId,
              date: cleanDate,
              status,
              updatedById,
              ...(status === 'LATE' && { markedAt: finalMarkedAt, lateMinutes })
            }
          });
          created++;
        }
      } catch (err) {
        errors.push(`Ошибка обработки записи ${JSON.stringify(record)}: ${err.message}`);
      }
    }

    res.json({
      created,
      updated,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Ошибка массового обновления посещаемости:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 1. Получение нового QR (для преподавателя)
router.get('/qr/refresh/:teacherId', async (req, res) => {
  try {
    const { teacherId } = req.params;
    const qrData = await qrService.generateToken(teacherId);
    res.json({ token: qrData.token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Верификация скана (для студента)
router.post('/qr/verify', async (req, res) => {
  try {
    const { token } = req.body;
    const currentUserId = req.user?.id;
    if (!currentUserId) return res.status(401).json({ error: "Нет авторизации" });

    const check = await qrService.validateToken(token);
    if (!check.valid) return res.status(400).json({ error: check.message });

    // Ищем запись студента. В идеале userId == studentId, но если нет,
    // пытаемся сопоставить по ФИО.
    let student = await prisma.student.findUnique({
      where: { id: currentUserId },
      select: { id: true, groupId: true }
    });

    if (!student && req.user?.fullName) {
      student = await prisma.student.findFirst({
        where: { fullName: req.user.fullName },
        select: { id: true, groupId: true }
      });
    }

    if (!student) {
      return res.status(400).json({ error: "Студент не найден для этого аккаунта" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Обнуляем время для соответствия @db.Date

    // Создаем запись или обновляем до PRESENT в карточке группы
    await prisma.attendance.upsert({
      where: {
        studentId_date: { studentId: student.id, date: today }
      },
      update: {
        status: 'PRESENT',
        markedAt: new Date()
      },
      create: {
        studentId: student.id,
        groupId: student.groupId,
        date: today,
        status: 'PRESENT',
        markedAt: new Date()
      }
    });

    res.json({ success: true, message: "Вы успешно отмечены!" });
  } catch (e) {
    res.status(500).json({ error: "Ошибка сервера: " + e.message });
  }
});

module.exports = router;




