const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

// Базовое расписание (по умолчанию)
const defaultSchedules = [
  // Понедельник (dayOfWeek = 1)
  { dayOfWeek: 1, pairNumber: 0, startTime: '07:45', endTime: '08:05' }, // классный час
  { dayOfWeek: 1, pairNumber: 1, startTime: '08:10', endTime: '09:40' },
  { dayOfWeek: 1, pairNumber: 2, startTime: '09:50', endTime: '11:20' },
  { dayOfWeek: 1, pairNumber: 3, startTime: '11:40', endTime: '13:10' },
  { dayOfWeek: 1, pairNumber: 4, startTime: '13:15', endTime: '14:45' },
  { dayOfWeek: 1, pairNumber: 5, startTime: '15:05', endTime: '16:35' },
  { dayOfWeek: 1, pairNumber: 6, startTime: '16:40', endTime: '18:10' },
  { dayOfWeek: 1, pairNumber: 7, startTime: '18:15', endTime: '19:45' },
  // Вторник–пятница (dayOfWeek = 2..5)
  { dayOfWeek: 2, pairNumber: 1, startTime: '07:45', endTime: '09:15' },
  { dayOfWeek: 2, pairNumber: 2, startTime: '09:25', endTime: '10:55' },
  { dayOfWeek: 2, pairNumber: 3, startTime: '11:15', endTime: '12:45' },
  { dayOfWeek: 2, pairNumber: 4, startTime: '12:50', endTime: '14:20' },
  { dayOfWeek: 2, pairNumber: 5, startTime: '14:40', endTime: '16:10' },
  { dayOfWeek: 2, pairNumber: 6, startTime: '16:15', endTime: '17:45' },
  { dayOfWeek: 2, pairNumber: 7, startTime: '17:50', endTime: '19:20' },
  { dayOfWeek: 3, pairNumber: 1, startTime: '07:45', endTime: '09:15' },
  { dayOfWeek: 3, pairNumber: 2, startTime: '09:25', endTime: '10:55' },
  { dayOfWeek: 3, pairNumber: 3, startTime: '11:15', endTime: '12:45' },
  { dayOfWeek: 3, pairNumber: 4, startTime: '12:50', endTime: '14:20' },
  { dayOfWeek: 3, pairNumber: 5, startTime: '14:40', endTime: '16:10' },
  { dayOfWeek: 3, pairNumber: 6, startTime: '16:15', endTime: '17:45' },
  { dayOfWeek: 3, pairNumber: 7, startTime: '17:50', endTime: '19:20' },
  { dayOfWeek: 4, pairNumber: 1, startTime: '07:45', endTime: '09:15' },
  { dayOfWeek: 4, pairNumber: 2, startTime: '09:25', endTime: '10:55' },
  { dayOfWeek: 4, pairNumber: 3, startTime: '11:15', endTime: '12:45' },
  { dayOfWeek: 4, pairNumber: 4, startTime: '12:50', endTime: '14:20' },
  { dayOfWeek: 4, pairNumber: 5, startTime: '14:40', endTime: '16:10' },
  { dayOfWeek: 4, pairNumber: 6, startTime: '16:15', endTime: '17:45' },
  { dayOfWeek: 4, pairNumber: 7, startTime: '17:50', endTime: '19:20' },
  { dayOfWeek: 5, pairNumber: 1, startTime: '07:45', endTime: '09:15' },
  { dayOfWeek: 5, pairNumber: 2, startTime: '09:25', endTime: '10:55' },
  { dayOfWeek: 5, pairNumber: 3, startTime: '11:15', endTime: '12:45' },
  { dayOfWeek: 5, pairNumber: 4, startTime: '12:50', endTime: '14:20' },
  { dayOfWeek: 5, pairNumber: 5, startTime: '14:40', endTime: '16:10' },
  { dayOfWeek: 5, pairNumber: 6, startTime: '16:15', endTime: '17:45' },
  { dayOfWeek: 5, pairNumber: 7, startTime: '17:50', endTime: '19:20' },
];

// GET /api/schedule - список расписаний
router.get('/', async (_req, res) => {
  try {
    const schedules = await prisma.lessonSchedule.findMany({
      orderBy: [{ dayOfWeek: 'asc' }, { pairNumber: 'asc' }]
    });
    res.json(schedules);
  } catch (err) {
    console.error('Ошибка получения расписания:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/schedule/today - расписание на сегодня
router.get('/today', async (_req, res) => {
  try {
    const now = new Date();
    const day = now.getDay(); // 0=Вск ... 6=Сб
    const dayOfWeek = day === 0 ? 7 : day; // Приводим: Пн=1 ... Вс=7
    const schedules = await prisma.lessonSchedule.findMany({
      where: { dayOfWeek },
      orderBy: { pairNumber: 'asc' }
    });
    res.json(schedules);
  } catch (err) {
    console.error('Ошибка получения расписания на сегодня:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/schedule - обновление/добавление расписания (HEAD/ADMIN)
router.put('/', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items должен быть непустым массивом' });
    }

    const updated = [];
    for (const item of items) {
      const { dayOfWeek, pairNumber, startTime, endTime } = item;
      if (
        typeof dayOfWeek !== 'number' ||
        typeof pairNumber !== 'number' ||
        typeof startTime !== 'string' ||
        typeof endTime !== 'string'
      ) {
        return res.status(400).json({ error: 'Некорректные поля в items' });
      }

      const rec = await prisma.lessonSchedule.upsert({
        where: { dayOfWeek_pairNumber: { dayOfWeek, pairNumber } },
        update: { startTime, endTime },
        create: { dayOfWeek, pairNumber, startTime, endTime }
      });
      updated.push(rec);
    }

    res.json({ updated: updated.length });
  } catch (err) {
    console.error('Ошибка обновления расписания:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/schedule/seed-defaults - заполнить дефолтным расписанием (если нужно)
router.post('/seed-defaults', async (_req, res) => {
  try {
    const updated = [];
    for (const item of defaultSchedules) {
      const rec = await prisma.lessonSchedule.upsert({
        where: { dayOfWeek_pairNumber: { dayOfWeek: item.dayOfWeek, pairNumber: item.pairNumber } },
        update: { startTime: item.startTime, endTime: item.endTime },
        create: item
      });
      updated.push(rec);
    }
    res.json({ updated: updated.length });
  } catch (err) {
    console.error('Ошибка сидирования расписания:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;

