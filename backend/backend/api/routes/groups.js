// api/routes/groups.js
// Маршруты для управления группами

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { DateTime } = require('luxon');

const router = express.Router();
const prisma = new PrismaClient();

const getCurrentCourse = (admissionYear) => {
  const now = DateTime.now();
  const currentYear = now.month >= 9 ? now.year : now.year - 1;
  return currentYear - admissionYear + 1;
};

/**
 * GET /api/admin/curators
 * Получить список кураторов (для дропдауна)
 * Headers: Authorization: Bearer <token>
 * Response: Array<{ id, fullName, role }>
 */
router.get('/curators', async (req, res) => {
  try {
    const curators = await prisma.user.findMany({
      where: {
        role: { in: ['TEACHER', 'HEAD'] }
      },
      select: {
        id: true,
        fullName: true,
        role: true
      },
      orderBy: { fullName: 'asc' }
    });
    res.json(curators);
  } catch (err) {
    console.error('Ошибка загрузки кураторов:', err);
    res.status(500).json({ error: 'Ошибка загрузки кураторов' });
  }
});

/**
 * GET /api/admin/groups
 * Получить список всех групп
 * Headers: Authorization: Bearer <token>
 * Response: Array<{ id, name, admissionYear, course, currentCourse, specialtyId, specialty, curatorId, curator, createdAt, updatedAt }>
 */
router.get('/', async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      include: {
        specialty: { select: { code: true, name: true } },
        curator: { select: { id: true, fullName: true } }
      },
      orderBy: { name: 'asc' }
    });

    res.json(groups.map(g => ({
      ...g,
      currentCourse: getCurrentCourse(g.admissionYear)
    })));
  } catch (err) {
    console.error('Ошибка получения групп:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/admin/groups/:id
 * Получить группу по ID
 * Headers: Authorization: Bearer <token>
 * Response: { id, name, admissionYear, course, currentCourse, specialtyId, specialty, curatorId, curator, createdAt, updatedAt }
 */
router.get('/:id', async (req, res) => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: {
        specialty: { select: { code: true, name: true } },
        curator: { select: { id: true, fullName: true } }
      }
    });

    if (!group) {
      return res.status(404).json({ error: 'Группа не найдена' });
    }

    res.json({
      ...group,
      currentCourse: getCurrentCourse(group.admissionYear)
    });
  } catch (err) {
    console.error('Ошибка получения группы:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/admin/groups
 * Создать новую группу
 * Headers: Authorization: Bearer <token>
 * Body: { name: string, specialtyCode: string, course: number, admissionYear: number, curatorId?: string }
 * Response: { id, name, admissionYear, course, specialtyId, curatorId, createdAt, updatedAt }
 */
router.post('/', async (req, res) => {
  try {
    const { name, specialtyCode, course, admissionYear, curatorId } = req.body;

    if (!name || !specialtyCode || !course || !admissionYear) {
      return res.status(400).json({ error: 'Заполните: название, специальность, курс, год поступления' });
    }

    // Проверка уникальности названия
    const existingName = await prisma.group.findUnique({ where: { name } });
    if (existingName) {
      return res.status(400).json({ error: 'Группа с таким названием уже существует' });
    }

    const specialty = await prisma.specialty.findUnique({ where: { code: specialtyCode } });
    if (!specialty) {
      return res.status(400).json({ error: 'Специальность не найдена' });
    }

    if (curatorId) {
      const busy = await prisma.group.findFirst({ where: { curatorId } });
      if (busy) {
        return res.status(400).json({ error: 'Этот куратор уже закреплён за другой группой' });
      }
    }

    const group = await prisma.group.create({
      data: {
        name,
        admissionYear: Number(admissionYear),
        course: Number(course),
        specialtyId: specialty.id,
        curatorId: curatorId || null
      }
    });

    res.status(201).json(group);
  } catch (err) {
    console.error('Ошибка создания группы:', err);
    res.status(400).json({ error: 'Не удалось создать группу' });
  }
});

/**
 * PUT /api/admin/groups/:id
 * Полное обновление группы
 * Headers: Authorization: Bearer <token>
 * Body: { name?: string, specialtyCode?: string, course?: number, admissionYear?: number, curatorId?: string | null }
 * Response: { id, name, admissionYear, course, specialtyId, curatorId, createdAt, updatedAt }
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, specialtyCode, course, admissionYear, curatorId } = req.body;
    const data = {};

    if (name !== undefined) data.name = name;
    if (course !== undefined) data.course = Number(course);
    if (admissionYear !== undefined) data.admissionYear = Number(admissionYear);

    if (specialtyCode !== undefined) {
      const spec = await prisma.specialty.findUnique({ where: { code: specialtyCode } });
      if (!spec) {
        return res.status(400).json({ error: 'Специальность не найдена' });
      }
      data.specialtyId = spec.id;
    }

    // КУРАТОР — САМАЯ ГЛАВНАЯ ЛОГИКА
    if (curatorId !== undefined) {
      if (curatorId === null || curatorId === '' || curatorId === 'null') {
        data.curatorId = null;
      } else {
        const conflict = await prisma.group.findFirst({
          where: {
            curatorId,
            NOT: { id: req.params.id }
          }
        });
        if (conflict) {
          return res.status(400).json({ error: 'Этот преподаватель уже куратор другой группы' });
        }
        data.curatorId = curatorId;
      }
    }

    // Проверка уникальности названия (если изменяется)
    if (name) {
      const existingName = await prisma.group.findFirst({
        where: { name, NOT: { id: req.params.id } }
      });
      if (existingName) {
        return res.status(400).json({ error: 'Группа с таким названием уже существует' });
      }
    }

    const group = await prisma.group.update({
      where: { id: req.params.id },
      data
    });
    res.json(group);
  } catch (err) {
    console.error('Ошибка обновления группы:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Группа не найдена' });
    }
    res.status(400).json({ error: 'Не удалось обновить группу' });
  }
});

/**
 * PATCH /api/admin/groups/:id
 * Частичное обновление группы
 * Headers: Authorization: Bearer <token>
 * Body: { name?: string, specialtyCode?: string, course?: number, admissionYear?: number, curatorId?: string | null }
 * Response: { id, name, admissionYear, course, specialtyId, curatorId, createdAt, updatedAt }
 */
router.patch('/:id', async (req, res) => {
  try {
    const { name, specialtyCode, course, admissionYear, curatorId } = req.body;
    const data = {};

    if (name !== undefined) data.name = name;
    if (course !== undefined) data.course = Number(course);
    if (admissionYear !== undefined) data.admissionYear = Number(admissionYear);

    if (specialtyCode !== undefined) {
      const spec = await prisma.specialty.findUnique({ where: { code: specialtyCode } });
      if (!spec) {
        return res.status(400).json({ error: 'Специальность не найдена' });
      }
      data.specialtyId = spec.id;
    }

    // КУРАТОР — САМАЯ ГЛАВНАЯ ЛОГИКА
    if (curatorId !== undefined) {
      if (curatorId === null || curatorId === '' || curatorId === 'null') {
        data.curatorId = null;
      } else {
        const conflict = await prisma.group.findFirst({
          where: {
            curatorId,
            NOT: { id: req.params.id }
          }
        });
        if (conflict) {
          return res.status(400).json({ error: 'Этот преподаватель уже куратор другой группы' });
        }
        data.curatorId = curatorId;
      }
    }

    // Проверка уникальности названия (если изменяется)
    if (name) {
      const existingName = await prisma.group.findFirst({
        where: { name, NOT: { id: req.params.id } }
      });
      if (existingName) {
        return res.status(400).json({ error: 'Группа с таким названием уже существует' });
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    const group = await prisma.group.update({
      where: { id: req.params.id },
      data
    });
    res.json(group);
  } catch (err) {
    console.error('Ошибка обновления группы:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Группа не найдена' });
    }
    res.status(400).json({ error: 'Не удалось обновить группу' });
  }
});

/**
 * DELETE /api/admin/groups/:id
 * Удалить группу
 * Headers: Authorization: Bearer <token>
 * Response: { message: string }
 */
router.delete('/:id', async (req, res) => {
  try {
    await prisma.group.delete({ where: { id: req.params.id } });
    res.json({ message: 'Группа удалена' });
  } catch (err) {
    console.error('Ошибка удаления группы:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Группа не найдена' });
    }
    res.status(500).json({ error: 'Не удалось удалить группу' });
  }
});

module.exports = router;




