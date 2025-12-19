// api/routes/qualifications.js
// Маршруты для управления квалификациями

const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/admin/qualifications
 * Получить список всех квалификаций
 * Headers: Authorization: Bearer <token>
 * Response: Array<{ id, name, type, specialtyId, specialty }>
 */
router.get('/', async (req, res) => {
  try {
    const quals = await prisma.qualification.findMany({
      include: { specialty: true },
      orderBy: { name: 'asc' }
    });
    res.json(quals);
  } catch (err) {
    console.error('Ошибка получения квалификаций:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/admin/qualifications/:id
 * Получить квалификацию по ID
 * Headers: Authorization: Bearer <token>
 * Response: { id, name, type, specialtyId, specialty }
 */
router.get('/:id', async (req, res) => {
  try {
    const qual = await prisma.qualification.findUnique({
      where: { id: Number(req.params.id) },
      include: { specialty: true }
    });

    if (!qual) {
      return res.status(404).json({ error: 'Квалификация не найдена' });
    }

    res.json(qual);
  } catch (err) {
    console.error('Ошибка получения квалификации:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/admin/qualifications
 * Создать новую квалификацию
 * Headers: Authorization: Bearer <token>
 * Body: { name: string, specialtyCode: string, type?: QualificationType }
 * Response: { id, name, type, specialtyId }
 */
router.post('/', async (req, res) => {
  try {
    const { name, specialtyCode, type = 'IT_TECHNICIAN' } = req.body;
    if (!name || !specialtyCode) {
      return res.status(400).json({ error: 'name и specialtyCode обязательны' });
    }

    const specialty = await prisma.specialty.findUnique({ where: { code: specialtyCode } });
    if (!specialty) {
      return res.status(400).json({ error: 'Специальность не найдена' });
    }

    // Проверка уникальности
    const existing = await prisma.qualification.findFirst({
      where: { specialtyId: specialty.id, type }
    });
    if (existing) {
      return res.status(400).json({ error: 'Квалификация с таким типом уже существует для этой специальности' });
    }

    const qual = await prisma.qualification.create({
      data: { name, specialtyId: specialty.id, type }
    });
    res.status(201).json(qual);
  } catch (err) {
    console.error('Ошибка создания квалификации:', err);
    res.status(400).json({ error: 'Не удалось создать квалификацию' });
  }
});

/**
 * PUT /api/admin/qualifications/:id
 * Полное обновление квалификации
 * Headers: Authorization: Bearer <token>
 * Body: { name?: string, specialtyCode?: string, type?: QualificationType }
 * Response: { id, name, type, specialtyId }
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, specialtyCode, type } = req.body;
    const data = {};

    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;

    if (specialtyCode) {
      const specialty = await prisma.specialty.findUnique({ where: { code: specialtyCode } });
      if (!specialty) {
        return res.status(400).json({ error: 'Специальность не найдена' });
      }
      data.specialtyId = specialty.id;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    // Проверка уникальности (если изменяется specialtyId или type)
    if (data.specialtyId || data.type) {
      const current = await prisma.qualification.findUnique({
        where: { id: Number(req.params.id) }
      });
      const checkSpecialtyId = data.specialtyId || current.specialtyId;
      const checkType = data.type || current.type;

      const existing = await prisma.qualification.findFirst({
        where: {
          specialtyId: checkSpecialtyId,
          type: checkType,
          NOT: { id: Number(req.params.id) }
        }
      });
      if (existing) {
        return res.status(400).json({ error: 'Квалификация с таким типом уже существует для этой специальности' });
      }
    }

    const qual = await prisma.qualification.update({
      where: { id: Number(req.params.id) },
      data
    });
    res.json(qual);
  } catch (err) {
    console.error('Ошибка обновления квалификации:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Квалификация не найдена' });
    }
    res.status(400).json({ error: 'Не удалось обновить квалификацию' });
  }
});

/**
 * PATCH /api/admin/qualifications/:id
 * Частичное обновление квалификации
 * Headers: Authorization: Bearer <token>
 * Body: { name?: string, specialtyCode?: string, type?: QualificationType }
 * Response: { id, name, type, specialtyId }
 */
router.patch('/:id', async (req, res) => {
  try {
    const { name, specialtyCode, type } = req.body;
    const data = {};

    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;

    if (specialtyCode) {
      const specialty = await prisma.specialty.findUnique({ where: { code: specialtyCode } });
      if (!specialty) {
        return res.status(400).json({ error: 'Специальность не найдена' });
      }
      data.specialtyId = specialty.id;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    // Проверка уникальности (если изменяется specialtyId или type)
    if (data.specialtyId || data.type) {
      const current = await prisma.qualification.findUnique({
        where: { id: Number(req.params.id) }
      });
      const checkSpecialtyId = data.specialtyId || current.specialtyId;
      const checkType = data.type || current.type;

      const existing = await prisma.qualification.findFirst({
        where: {
          specialtyId: checkSpecialtyId,
          type: checkType,
          NOT: { id: Number(req.params.id) }
        }
      });
      if (existing) {
        return res.status(400).json({ error: 'Квалификация с таким типом уже существует для этой специальности' });
      }
    }

    const qual = await prisma.qualification.update({
      where: { id: Number(req.params.id) },
      data
    });
    res.json(qual);
  } catch (err) {
    console.error('Ошибка обновления квалификации:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Квалификация не найдена' });
    }
    res.status(400).json({ error: 'Не удалось обновить квалификацию' });
  }
});

/**
 * DELETE /api/admin/qualifications/:id
 * Удалить квалификацию
 * Headers: Authorization: Bearer <token>
 * Response: { message: string }
 */
router.delete('/:id', async (req, res) => {
  try {
    await prisma.qualification.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Квалификация удалена' });
  } catch (err) {
    console.error('Ошибка удаления квалификации:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Квалификация не найдена' });
    }
    res.status(500).json({ error: 'Не удалось удалить квалификацию' });
  }
});

module.exports = router;




