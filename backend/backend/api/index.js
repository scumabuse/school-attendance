// api/index.js
// Главный файл для объединения всех API маршрутов

const express = require('express');
const { authenticate, isHeadOrAdmin } = require('./middleware/auth');

// Импорт всех маршрутов
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const specialtyRoutes = require('./routes/specialties');
const qualificationRoutes = require('./routes/qualifications');
const holidayRoutes = require('./routes/holidays');
const groupRoutes = require('./routes/groups');
const studentRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const scheduleRoutes = require('./routes/schedules');
const adminRoutes = require('./routes/admin');

const router = express.Router();

// ===================================
// АУТЕНТИФИКАЦИЯ (без токена)
// ===================================
router.use('/auth', authRoutes);

// ===================================
// ПОЛЬЗОВАТЕЛИ (требуется HEAD или ADMIN)
// ===================================
router.use('/admin/users', authenticate, isHeadOrAdmin, userRoutes);

// ===================================
// СПЕЦИАЛЬНОСТИ
// ===================================
// GET /api/specialties - доступно всем аутентифицированным
router.get('/specialties', authenticate, async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
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
// GET /api/specialties/:id - доступно всем аутентифицированным
router.get('/specialties/:id', authenticate, async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
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
// Остальные операции - только HEAD или ADMIN
router.use('/admin/specialties', authenticate, isHeadOrAdmin, specialtyRoutes);

// ===================================
// КВАЛИФИКАЦИИ
// ===================================
// GET /api/qualifications - доступно всем аутентифицированным
router.get('/qualifications', authenticate, async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
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
// GET /api/qualifications/:id - доступно всем аутентифицированным
router.get('/qualifications/:id', authenticate, async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
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
// Остальные операции - только HEAD или ADMIN
router.use('/admin/qualifications', authenticate, isHeadOrAdmin, qualificationRoutes);

// ===================================
// ПРАЗДНИКИ
// ===================================
// GET /api/holidays - доступно всем аутентифицированным
router.get('/holidays', authenticate, async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
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
// GET /api/holidays/:id - доступно всем аутентифицированным
router.get('/holidays/:id', authenticate, async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
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
// Остальные операции - только HEAD или ADMIN
router.use('/admin/holidays', authenticate, isHeadOrAdmin, holidayRoutes);

// ===================================
// ГРУППЫ
// ===================================
// GET /api/groups - доступно всем аутентифицированным
router.get('/groups', authenticate, async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const { DateTime } = require('luxon');
  const prisma = new PrismaClient();
  try {
    const getCurrentCourse = (admissionYear) => {
      const now = DateTime.now();
      const currentYear = now.month >= 9 ? now.year : now.year - 1;
      return currentYear - admissionYear + 1;
    };
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
// GET /api/groups/curators - доступно всем аутентифицированным (должен быть выше /groups/:id)
router.get('/groups/curators', authenticate, async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
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
// GET /api/groups/:id - доступно всем аутентифицированным
router.get('/groups/:id', authenticate, async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const { DateTime } = require('luxon');
  const prisma = new PrismaClient();
  try {
    const getCurrentCourse = (admissionYear) => {
      const now = DateTime.now();
      const currentYear = now.month >= 9 ? now.year : now.year - 1;
      return currentYear - admissionYear + 1;
    };
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
// Остальные операции - только HEAD или ADMIN
router.use('/admin/groups', authenticate, isHeadOrAdmin, groupRoutes);

// ===================================
// СТУДЕНТЫ
// ===================================
// GET /api/students - доступно всем аутентифицированным
router.get('/students', authenticate, async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
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
router.get('/students/:id', authenticate, async (req, res) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
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
// Остальные операции - только HEAD или ADMIN
router.use('/admin/students', authenticate, isHeadOrAdmin, studentRoutes);

// ===================================
// ПОСЕЩАЕМОСТЬ (требуется аутентификация)
// ===================================
router.use('/attendance', authenticate, attendanceRoutes);

// ===================================
// РАСПИСАНИЕ (требуется аутентификация)
// ===================================
router.use('/schedules', authenticate, scheduleRoutes);

// ===================================
// АДМИНИСТРАТИВНЫЕ МАРШРУТЫ (требуется HEAD или ADMIN)
// ===================================
router.use('/admin', authenticate, isHeadOrAdmin, adminRoutes);
router.use('/export', authenticate, isHeadOrAdmin, adminRoutes);

// ===================================
// ТЕСТОВЫЙ МАРШРУТ (без аутентификации)
// ===================================
router.get('/test', (req, res) => {
  res.json({ message: 'Бэкенд работает!' });
});

module.exports = router;

