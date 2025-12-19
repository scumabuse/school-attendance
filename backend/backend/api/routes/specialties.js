// api/routes/specialties.js
// Маршруты для управления специальностями

const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/specialties
 * Получить список всех специальностей
 * Headers: Authorization: Bearer <token>
 * Response: Array<{ id, code, name, durationYears, qualifications }>
 */
router.get('/', async (req, res) => {
  try {
    const specs = await prisma.specialty.findMany({
      include: { qualifications: true },
      orderBy: { code: 'asc' }
    });
    res.json(specs);
  } catch (err) {
    console.error('Ошибка получения специальностей:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/specialties/:id
 * Получить специальность по ID
 * Headers: Authorization: Bearer <token>
 * Response: { id, code, name, durationYears, qualifications }
 */
router.get('/:id', async (req, res) => {
  try {
    const spec = await prisma.specialty.findUnique({
      where: { id: Number(req.params.id) },
      include: { qualifications: true }
    });

    if (!spec) {
      return res.status(404).json({ error: 'Специальность не найдена' });
    }

    res.json(spec);
  } catch (err) {
    console.error('Ошибка получения специальности:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/admin/specialties
 * Создать новую специальность
 * Headers: Authorization: Bearer <token>
 * Body: { code: string, name: string, durationYears: number }
 * Response: { id, code, name, durationYears }
 */
router.post('/', async (req, res) => {
  try {
    const { code, name, durationYears } = req.body;
    if (!code || !name || !durationYears) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    // Проверка уникальности кода
    const existing = await prisma.specialty.findUnique({ where: { code } });
    if (existing) {
      return res.status(400).json({ error: 'Специальность с таким кодом уже существует' });
    }

    const spec = await prisma.specialty.create({
      data: { code, name, durationYears: Number(durationYears) }
    });
    res.status(201).json(spec);
  } catch (err) {
    console.error('Ошибка создания специальности:', err);
    res.status(400).json({ error: 'Не удалось создать специальность' });
  }
});

/**
 * PUT /api/admin/specialties/:id
 * Полное обновление специальности
 * Headers: Authorization: Bearer <token>
 * Body: { code: string, name: string, durationYears: number }
 * Response: { id, code, name, durationYears }
 */
router.put('/:id', async (req, res) => {
  try {
    const { code, name, durationYears } = req.body;
    
    if (!code || !name || durationYears === undefined) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    // Проверка уникальности кода (если изменяется)
    const existing = await prisma.specialty.findFirst({
      where: { code, NOT: { id: Number(req.params.id) } }
    });
    if (existing) {
      return res.status(400).json({ error: 'Специальность с таким кодом уже существует' });
    }

    const spec = await prisma.specialty.update({
      where: { id: Number(req.params.id) },
      data: { code, name, durationYears: Number(durationYears) }
    });
    res.json(spec);
  } catch (err) {
    console.error('Ошибка обновления специальности:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Специальность не найдена' });
    }
    res.status(400).json({ error: 'Не удалось обновить специальность' });
  }
});

/**
 * PATCH /api/admin/specialties/:id
 * Частичное обновление специальности
 * Headers: Authorization: Bearer <token>
 * Body: { code?: string, name?: string, durationYears?: number }
 * Response: { id, code, name, durationYears }
 */
router.patch('/:id', async (req, res) => {
  try {
    const { code, name, durationYears } = req.body;
    const data = {};

    if (code !== undefined) data.code = code;
    if (name !== undefined) data.name = name;
    if (durationYears !== undefined) data.durationYears = Number(durationYears);

    // Проверка уникальности кода (если изменяется)
    if (code) {
      const existing = await prisma.specialty.findFirst({
        where: { code, NOT: { id: Number(req.params.id) } }
      });
      if (existing) {
        return res.status(400).json({ error: 'Специальность с таким кодом уже существует' });
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    const spec = await prisma.specialty.update({
      where: { id: Number(req.params.id) },
      data
    });
    res.json(spec);
  } catch (err) {
    console.error('Ошибка обновления специальности:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Специальность не найдена' });
    }
    res.status(400).json({ error: 'Не удалось обновить специальность' });
  }
});

/**
 * DELETE /api/admin/specialties/:id
 * Удалить специальность
 * Headers: Authorization: Bearer <token>
 * Response: { message: string }
 */
router.delete('/:id', async (req, res) => {
  try {
    await prisma.specialty.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Специальность удалена' });
  } catch (err) {
    console.error('Ошибка удаления специальности:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Специальность не найдена' });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'Невозможно удалить специальность, так как она используется в группах' });
    }
    res.status(500).json({ error: 'Не удалось удалить специальность' });
  }
});

module.exports = router;




