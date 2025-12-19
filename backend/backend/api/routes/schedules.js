// api/routes/schedules.js
// Маршруты для управления расписанием групп

const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/schedules
 * Получить все расписания (с фильтром по группе)
 * Query params: groupId?: string
 * Response: Array<{ id, groupId, dayOfWeek, startTime, endTime, group }>
 */
router.get('/', async (req, res) => {
  try {
    const { groupId } = req.query;
    const where = {};

    if (groupId) {
      where.groupId = groupId;
    }

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        group: { select: { id: true, name: true } }
      },
      orderBy: [
        { groupId: 'asc' },
        { dayOfWeek: 'asc' }
      ]
    });

    res.json(schedules);
  } catch (err) {
    console.error('Ошибка получения расписаний:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/schedules/:id
 * Получить расписание по ID
 * Response: { id, groupId, dayOfWeek, startTime, endTime, group }
 */
router.get('/:id', async (req, res) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        group: { select: { id: true, name: true } }
      }
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Расписание не найдено' });
    }

    res.json(schedule);
  } catch (err) {
    console.error('Ошибка получения расписания:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/schedules
 * Создать расписание
 * Body: { groupId: string, dayOfWeek: number (1-5), startTime: string (HH:mm), endTime?: string (HH:mm) }
 * Response: { id, groupId, dayOfWeek, startTime, endTime }
 */
router.post('/', async (req, res) => {
  try {
    const { groupId, dayOfWeek, startTime, endTime } = req.body;

    if (!groupId || !dayOfWeek || !startTime) {
      return res.status(400).json({ error: 'groupId, dayOfWeek и startTime обязательны' });
    }

    // Валидация dayOfWeek (1-5, понедельник-пятница)
    if (dayOfWeek < 1 || dayOfWeek > 5) {
      return res.status(400).json({ error: 'dayOfWeek должен быть от 1 до 5 (понедельник-пятница)' });
    }

    // Валидация формата времени
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime)) {
      return res.status(400).json({ error: 'startTime должен быть в формате HH:mm (например, 09:00)' });
    }

    if (endTime && !timeRegex.test(endTime)) {
      return res.status(400).json({ error: 'endTime должен быть в формате HH:mm (например, 10:30)' });
    }

    // Проверка существования группы
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(400).json({ error: 'Группа не найдена' });
    }

    const schedule = await prisma.schedule.create({
      data: {
        groupId,
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime: endTime || null
      },
      include: {
        group: { select: { id: true, name: true } }
      }
    });

    res.status(201).json(schedule);
  } catch (err) {
    console.error('Ошибка создания расписания:', err);
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Расписание для этой группы и дня недели уже существует' });
    }
    res.status(400).json({ error: 'Не удалось создать расписание' });
  }
});

/**
 * PUT /api/schedules/:id
 * Полное обновление расписания
 * Body: { groupId?: string, dayOfWeek?: number, startTime?: string, endTime?: string }
 * Response: { id, groupId, dayOfWeek, startTime, endTime }
 */
router.put('/:id', async (req, res) => {
  try {
    const { groupId, dayOfWeek, startTime, endTime } = req.body;
    const data = {};

    if (groupId !== undefined) data.groupId = groupId;
    if (dayOfWeek !== undefined) {
      if (dayOfWeek < 1 || dayOfWeek > 5) {
        return res.status(400).json({ error: 'dayOfWeek должен быть от 1 до 5' });
      }
      data.dayOfWeek = Number(dayOfWeek);
    }
    if (startTime !== undefined) {
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(startTime)) {
        return res.status(400).json({ error: 'startTime должен быть в формате HH:mm' });
      }
      data.startTime = startTime;
    }
    if (endTime !== undefined) {
      if (endTime === null || endTime === '') {
        data.endTime = null;
      } else {
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(endTime)) {
          return res.status(400).json({ error: 'endTime должен быть в формате HH:mm' });
        }
        data.endTime = endTime;
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    // Проверка существования группы, если указана
    if (data.groupId) {
      const group = await prisma.group.findUnique({ where: { id: data.groupId } });
      if (!group) {
        return res.status(400).json({ error: 'Группа не найдена' });
      }
    }

    const schedule = await prisma.schedule.update({
      where: { id: Number(req.params.id) },
      data,
      include: {
        group: { select: { id: true, name: true } }
      }
    });

    res.json(schedule);
  } catch (err) {
    console.error('Ошибка обновления расписания:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Расписание не найдено' });
    }
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Расписание для этой группы и дня недели уже существует' });
    }
    res.status(400).json({ error: 'Не удалось обновить расписание' });
  }
});

/**
 * PATCH /api/schedules/:id
 * Частичное обновление расписания
 * Body: { groupId?: string, dayOfWeek?: number, startTime?: string, endTime?: string }
 * Response: { id, groupId, dayOfWeek, startTime, endTime }
 */
router.patch('/:id', async (req, res) => {
  try {
    const { groupId, dayOfWeek, startTime, endTime } = req.body;
    const data = {};

    if (groupId !== undefined) data.groupId = groupId;
    if (dayOfWeek !== undefined) {
      if (dayOfWeek < 1 || dayOfWeek > 5) {
        return res.status(400).json({ error: 'dayOfWeek должен быть от 1 до 5' });
      }
      data.dayOfWeek = Number(dayOfWeek);
    }
    if (startTime !== undefined) {
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(startTime)) {
        return res.status(400).json({ error: 'startTime должен быть в формате HH:mm' });
      }
      data.startTime = startTime;
    }
    if (endTime !== undefined) {
      if (endTime === null || endTime === '') {
        data.endTime = null;
      } else {
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(endTime)) {
          return res.status(400).json({ error: 'endTime должен быть в формате HH:mm' });
        }
        data.endTime = endTime;
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    // Проверка существования группы, если указана
    if (data.groupId) {
      const group = await prisma.group.findUnique({ where: { id: data.groupId } });
      if (!group) {
        return res.status(400).json({ error: 'Группа не найдена' });
      }
    }

    const schedule = await prisma.schedule.update({
      where: { id: Number(req.params.id) },
      data,
      include: {
        group: { select: { id: true, name: true } }
      }
    });

    res.json(schedule);
  } catch (err) {
    console.error('Ошибка обновления расписания:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Расписание не найдено' });
    }
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Расписание для этой группы и дня недели уже существует' });
    }
    res.status(400).json({ error: 'Не удалось обновить расписание' });
  }
});

/**
 * DELETE /api/schedules/:id
 * Удалить расписание
 * Response: { message: string }
 */
router.delete('/:id', async (req, res) => {
  try {
    await prisma.schedule.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Расписание удалено' });
  } catch (err) {
    console.error('Ошибка удаления расписания:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Расписание не найдено' });
    }
    res.status(500).json({ error: 'Не удалось удалить расписание' });
  }
});

module.exports = router;








