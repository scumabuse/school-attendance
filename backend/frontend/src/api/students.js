// api/routes/students.js
// Маршруты для управления студентами

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');

const router = express.Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

// Импорт сервиса импорта студентов
const { importStudentsFromBuffer } = require('../../backend/services/importStudents');

/**
 * GET /api/students
 * Получить список всех студентов
 * Headers: Authorization: Bearer <token>
 * Query params: groupId?: string (фильтр по группе)
 * Response: Array<{ id, fullName, groupId, group, createdAt }>
 */
router.get('/', async (req, res) => {
  try {
    const { groupId } = req.query;
    const where = groupId ? { groupId } : {};

    const students = await prisma.student.findMany({
      where,
      include: { group: { include: { specialty: true } } },
      orderBy: { fullName: 'asc' }
    });
    res.json(students);
  } catch (err) {
    console.error('Ошибка получения студентов:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/students/:id
 * Получить студента по ID
 * Headers: Authorization: Bearer <token>
 * Response: { id, fullName, groupId, group, createdAt }
 */
router.get('/:id', async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: { group: { include: { specialty: true } } }
    });

    if (!student) {
      return res.status(404).json({ error: 'Студент не найден' });
    }

    res.json(student);
  } catch (err) {
    console.error('Ошибка получения студента:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/admin/students
 * Создать нового студента
 * Headers: Authorization: Bearer <token>
 * Body: { fullName: string, groupId: string }
 * Response: { id, fullName, groupId, createdAt }
 */
router.post('/', async (req, res) => {
  try {
    const { fullName, groupId } = req.body;

    if (!fullName || !groupId) {
      return res.status(400).json({ error: 'fullName и groupId обязательны' });
    }

    // Проверка существования группы
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(400).json({ error: 'Группа не найдена' });
    }

    // Проверка уникальности (fullName + groupId)
    const existing = await prisma.student.findFirst({
      where: {
        fullName: fullName.trim(),
        groupId
      }
    });
    if (existing) {
      return res.status(400).json({ error: 'Студент с таким ФИО уже существует в этой группе' });
    }

    const student = await prisma.student.create({
      data: {
        fullName: fullName.trim(),
        groupId
      }
    });
    res.status(201).json(student);
  } catch (err) {
    console.error('Ошибка создания студента:', err);
    res.status(400).json({ error: 'Не удалось создать студента' });
  }
});

/**
 * PUT /api/admin/students/:id
 * Полное обновление студента
 * Headers: Authorization: Bearer <token>
 * Body: { fullName?: string, groupId?: string }
 * Response: { id, fullName, groupId, createdAt }
 */
router.put('/:id', async (req, res) => {
  try {
    const { fullName, groupId } = req.body;
    const data = {};

    if (fullName !== undefined) data.fullName = fullName.trim();
    if (groupId !== undefined) {
      // Проверка существования группы
      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (!group) {
        return res.status(400).json({ error: 'Группа не найдена' });
      }
      data.groupId = groupId;
    }

    // Проверка уникальности (если изменяется fullName или groupId)
    if (data.fullName || data.groupId) {
      const current = await prisma.student.findUnique({
        where: { id: req.params.id }
      });
      const checkFullName = data.fullName || current.fullName;
      const checkGroupId = data.groupId || current.groupId;

      const existing = await prisma.student.findFirst({
        where: {
          fullName: checkFullName,
          groupId: checkGroupId,
          NOT: { id: req.params.id }
        }
      });
      if (existing) {
        return res.status(400).json({ error: 'Студент с таким ФИО уже существует в этой группе' });
      }
    }

    const student = await prisma.student.update({
      where: { id: req.params.id },
      data
    });
    res.json(student);
  } catch (err) {
    console.error('Ошибка обновления студента:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Студент не найден' });
    }
    res.status(400).json({ error: 'Не удалось обновить студента' });
  }
});

/**
 * PATCH /api/admin/students/:id
 * Частичное обновление студента
 * Headers: Authorization: Bearer <token>
 * Body: { fullName?: string, groupId?: string }
 * Response: { id, fullName, groupId, createdAt }
 */
router.patch('/:id', async (req, res) => {
  try {
    const { fullName, groupId } = req.body;
    const data = {};

    if (fullName !== undefined) data.fullName = fullName.trim();
    if (groupId !== undefined) {
      // Проверка существования группы
      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (!group) {
        return res.status(400).json({ error: 'Группа не найдена' });
      }
      data.groupId = groupId;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    // Проверка уникальности (если изменяется fullName или groupId)
    if (data.fullName || data.groupId) {
      const current = await prisma.student.findUnique({
        where: { id: req.params.id }
      });
      const checkFullName = data.fullName || current.fullName;
      const checkGroupId = data.groupId || current.groupId;

      const existing = await prisma.student.findFirst({
        where: {
          fullName: checkFullName,
          groupId: checkGroupId,
          NOT: { id: req.params.id }
        }
      });
      if (existing) {
        return res.status(400).json({ error: 'Студент с таким ФИО уже существует в этой группе' });
      }
    }

    const student = await prisma.student.update({
      where: { id: req.params.id },
      data
    });
    res.json(student);
  } catch (err) {
    console.error('Ошибка обновления студента:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Студент не найден' });
    }
    res.status(400).json({ error: 'Не удалось обновить студента. Проверьте ID, ФИО или ID группы.' });
  }
});

/**
 * DELETE /api/admin/students/:id
 * Удалить студента
 * Headers: Authorization: Bearer <token>
 * Response: { message: string }
 */
router.delete('/:id', async (req, res) => {
  try {
    await prisma.student.delete({ where: { id: req.params.id } });
    res.json({ message: 'Студент удалён' });
  } catch (err) {
    console.error('Ошибка удаления студента:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Студент не найден' });
    }
    res.status(500).json({ error: 'Не удалось удалить студента' });
  }
});

/**
 * POST /api/admin/import/students
 * Импорт студентов из Excel файла
 * Headers: Authorization: Bearer <token>
 * Body: FormData с полем 'file' (Excel файл)
 * Response: { message: string, importedCount?: number, errors?: Array<string> }
 */
router.post('/import/students', upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const result = await importStudentsFromBuffer(req.file.buffer, prisma);
    
    if (result.errors?.length > 0) {
      return res.status(207).json({
        message: 'Импорт с ошибками',
        ...result
      });
    }
    
    res.json({
      message: `Успешно импортировано: ${result.importedCount} студентов`,
      ...result
    });
  } catch (err) {
    console.error('Импорт ошибка:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

