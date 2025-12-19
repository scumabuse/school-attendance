// api/routes/holidays.js
// Маршруты для управления праздниками

const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/admin/holidays
 * Получить список всех праздников
 * Headers: Authorization: Bearer <token>
 * Response: Array<{ id, date, name }>
 */
router.get('/', async (req, res) => {
  try {
    const holidays = await prisma.holiday.findMany({
      orderBy: { date: 'desc' }
    });
    res.json(holidays);
  } catch (err) {
    console.error('Ошибка получения праздников:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/admin/holidays/:id
 * Получить праздник по ID
 * Headers: Authorization: Bearer <token>
 * Response: { id, date, name }
 */
router.get('/:id', async (req, res) => {
  try {
    const holiday = await prisma.holiday.findUnique({
      where: { id: Number(req.params.id) }
    });

    if (!holiday) {
      return res.status(404).json({ error: 'Праздник не найден' });
    }

    res.json(holiday);
  } catch (err) {
    console.error('Ошибка получения праздника:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/admin/holidays
 * Создать новый праздник
 * Headers: Authorization: Bearer <token>
 * Body: { date: string (ISO date), name: string }
 * Response: { id, date, name }
 */
router.post('/', async (req, res) => {
  try {
    const { date, name } = req.body;
    if (!date || !name) {
      return res.status(400).json({ error: 'date и name обязательны' });
    }

    // Проверка уникальности даты
    const existing = await prisma.holiday.findUnique({
      where: { date: new Date(date) }
    });
    if (existing) {
      return res.status(400).json({ error: 'Праздник на эту дату уже существует' });
    }

    const holiday = await prisma.holiday.create({
      data: { date: new Date(date), name }
    });
    res.status(201).json(holiday);
  } catch (err) {
    console.error('Ошибка создания праздника:', err);
    res.status(400).json({ error: 'Не удалось создать праздник' });
  }
});

/**
 * PUT /api/admin/holidays/:id
 * Полное обновление праздника
 * Headers: Authorization: Bearer <token>
 * Body: { date: string (ISO date), name: string }
 * Response: { id, date, name }
 */
router.put('/:id', async (req, res) => {
  try {
    const { date, name } = req.body;
    
    if (!date || !name) {
      return res.status(400).json({ error: 'date и name обязательны' });
    }

    // Проверка уникальности даты (если изменяется)
    const existing = await prisma.holiday.findFirst({
      where: {
        date: new Date(date),
        NOT: { id: Number(req.params.id) }
      }
    });
    if (existing) {
      return res.status(400).json({ error: 'Праздник на эту дату уже существует' });
    }

    const holiday = await prisma.holiday.update({
      where: { id: Number(req.params.id) },
      data: { date: new Date(date), name }
    });
    res.json(holiday);
  } catch (err) {
    console.error('Ошибка обновления праздника:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Праздник не найден' });
    }
    res.status(400).json({ error: 'Не удалось обновить праздник' });
  }
});

/**
 * PATCH /api/admin/holidays/:id
 * Частичное обновление праздника
 * Headers: Authorization: Bearer <token>
 * Body: { date?: string (ISO date), name?: string }
 * Response: { id, date, name }
 */
router.patch('/:id', async (req, res) => {
  try {
    const { date, name } = req.body;
    const data = {};

    if (date !== undefined) data.date = new Date(date);
    if (name !== undefined) data.name = name;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    // Проверка уникальности даты (если изменяется)
    if (date) {
      const existing = await prisma.holiday.findFirst({
        where: {
          date: new Date(date),
          NOT: { id: Number(req.params.id) }
        }
      });
      if (existing) {
        return res.status(400).json({ error: 'Праздник на эту дату уже существует' });
      }
    }

    const holiday = await prisma.holiday.update({
      where: { id: Number(req.params.id) },
      data
    });
    res.json(holiday);
  } catch (err) {
    console.error('Ошибка обновления праздника:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Праздник не найден' });
    }
    res.status(400).json({ error: 'Не удалось обновить праздник' });
  }
});

/**
 * DELETE /api/admin/holidays/:id
 * Удалить праздник
 * Headers: Authorization: Bearer <token>
 * Response: { message: string }
 */
router.delete('/:id', async (req, res) => {
  try {
    await prisma.holiday.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Праздник удалён' });
  } catch (err) {
    console.error('Ошибка удаления праздника:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Праздник не найден' });
    }
    res.status(500).json({ error: 'Не удалось удалить праздник' });
  }
});

module.exports = router;




