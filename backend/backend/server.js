const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const morgan = require('morgan');
const chalk = require('chalk');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const { DateTime } = require('luxon');

// Единая таймзона для всей логики посещаемости
// Должна совпадать с таймзоной, которая используется в сервисах/экспорте
const ATTENDANCE_TIMEZONE = 'Asia/Almaty';

// ДОБАВЬ СЮДА, ПОСЛЕ require('./services/...')
const { calculateAttendance } = require('./utils/attendanceCalculator');

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

// Multer
const upload = multer({ storage: multer.memoryStorage() });

// ===================================
// МИДДЛВАР АУТЕНТИФИКАЦИИ (Только для защищённых роутов!)
// ===================================
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Токен отсутствует' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Недействительный или просроченный токен' });
  }
};

const isHeadOrAdmin = (req, res, next) => {
  if (!req.user || !['HEAD', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Доступ запрещён. Только для HEAD и ADMIN' });
  }
  next();
};

const isAdmin = async (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Доступ запрещён: требуется роль ADMIN' });
  }
  next();
};

const getCurrentCourse = (admissionYear) => {
  const now = DateTime.now().setZone(ATTENDANCE_TIMEZONE);
  const currentYear = now.month >= 9 ? now.year : now.year - 1;
  return currentYear - admissionYear + 1;
};

// Нормализация даты к "дню посещаемости" в нужной таймзоне
function normalizeAttendanceDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}



function getDateRange(type = 'academic_year', start, end) {
  const now = DateTime.now().setZone(ATTENDANCE_TIMEZONE);
  const year = now.month >= 9 ? now.year : now.year - 1;
  const next = year + 1;

  // Обработка кастомного периода
  if (type === 'custom' && start && end) {
    const startDt = DateTime.fromISO(start).setZone(ATTENDANCE_TIMEZONE, { keepLocalTime: true });
    const endDt = DateTime.fromISO(end).setZone(ATTENDANCE_TIMEZONE, { keepLocalTime: true }).endOf('day');
    return {
      start: startDt.toJSDate(),
      end: endDt.toJSDate()
    };
  }

  const ranges = {
    today: {
      start: now.startOf('day'),
      end: now.endOf('day')
    },
    week: {
      start: now.minus({ days: 6 }).startOf('day'),
      end: now.endOf('day')
    },
    month: {
      start: now.startOf('month'),
      end: now.endOf('month')
    },
    semester1: {
      start: DateTime.fromObject({ year, month: 9, day: 1 }).setZone(ATTENDANCE_TIMEZONE),
      end: DateTime.fromObject({ year: next, month: 1, day: 31 }).setZone(ATTENDANCE_TIMEZONE).endOf('day')
    },
    semester2: {
      start: DateTime.fromObject({ year: next, month: 2, day: 1 }).setZone(ATTENDANCE_TIMEZONE),
      end: DateTime.fromObject({ year: next, month: 7, day: 31 }).setZone(ATTENDANCE_TIMEZONE).endOf('day')
    },
    academic_year: {
      start: DateTime.fromObject({ year, month: 9, day: 1 }).setZone(ATTENDANCE_TIMEZONE),
      end: DateTime.fromObject({ year: next, month: 7, day: 31 }).setZone(ATTENDANCE_TIMEZONE).endOf('day')
    }
  };

  const range = ranges[type] || ranges.academic_year;

  return {
    start: range.start.toJSDate(),
    end: range.end.toJSDate()
  };
}

// Сервисы
const { importStudentsFromBuffer } = require('./services/importStudents');
const { exportAttendanceService } = require('./services/exportAttendance');
const attendanceRouter = require('./api/routes/attendance');
const scheduleRouter = require('./api/routes/schedule');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// Все маршруты посещаемости требуют авторизации
app.use('/api/attendance', authenticate, attendanceRouter);
// Расписание пар (чтение — всем аутентифицированным, изменения — только HEAD/ADMIN)
app.use(
  '/api/schedule',
  authenticate,
  (req, res, next) => {
    if (req.method === 'PUT' || (req.method === 'POST' && req.path === '/seed-defaults')) {
      if (!req.user || !['HEAD', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Доступ запрещён. Только для HEAD и ADMIN' });
      }
    }
    next();
  },
  scheduleRouter
);

// Логи
morgan.token('body', (req) => Object.keys(req.body).length ? ` Body: ${JSON.stringify(req.body).slice(0, 300)}` : '');
app.use(morgan((tokens, req, res) => {
  const status = tokens.status(req, res);
  const color = status >= 500 ? chalk.red : status >= 400 ? chalk.yellow : status >= 300 ? chalk.cyan : chalk.green;
  return color(`[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] ${tokens.method(req, res)} ${tokens.url(req, res)}${tokens.body(req, res)} ${status} ${tokens['response-time'](req, res)}ms`);
}));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(chalk.bold.cyan(`Сервер запущен → http://localhost:${PORT}`)));

// ===================================
// АУТЕНТИФИКАЦИЯ — РАБОЧАЯ, БЕЗ 401!
// ===================================
app.post('/api/auth/login', async (req, res) => {
  console.log('Попытка входа:', req.body);

  try {
    const { login, password } = req.body;
    if (!login || !password) {
      return res.status(400).json({ error: 'Логин и пароль обязательны' });
    }

    const user = await prisma.user.findUnique({
      where: { login: login.trim() }
    });

    if (!user) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    // СПЕЦИАЛЬНО ДЛЯ ТЕСТОВОГО АДМИНА — ЕСЛИ ПАРОЛЬ В ОТКРЫТОМ ВИДЕ
    let isValid = false;
    if (user.password.startsWith('$2a$')) {
      // Нормальный хэш
      isValid = await bcrypt.compare(password, user.password);
    } else {
      // Пароль в чистом виде (например, "admin123")
      isValid = password === user.password;
      console.log('Вход по чистому паролю (незахэшированному)');
    }

    if (!isValid) {
      console.log('Неверный пароль для:', login);
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    console.log('УСПЕШНЫЙ ВХОД:', user.login, 'Роль:', user.role);

    res.json({
      token,
      user: {
        id: user.id,
        login: user.login,
        role: user.role,
        fullName: user.fullName || 'Администратор'
      }
    });

  } catch (err) {
    console.error('Ошибка логина:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
// ===================================
// ПОЛЬЗОВАТЕЛИ — ПОЛНЫЙ CRUD
// ===================================
app.get('/api/admin/users', authenticate, isHeadOrAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, login: true, role: true, fullName: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(users);
});

app.post('/api/admin/users', authenticate, isHeadOrAdmin, async (req, res) => {
  const { login, password, role, fullName } = req.body;
  if (!login || !password || !role) return res.status(400).json({ error: 'login, password, role обязательны' });

  const hashed = bcrypt.hashSync(password, 10);
  const user = await prisma.user.create({
    data: { login, password: hashed, role, fullName: fullName || null }
  });
  const { password: _, ...safeUser } = user;
  res.status(201).json(safeUser);
});

app.put('/api/admin/users/:id', authenticate, isHeadOrAdmin, async (req, res) => {
  const { login, role, fullName, password } = req.body;
  const data = { login, role, fullName: fullName || null };
  if (password) data.password = bcrypt.hashSync(password, 10);

  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

app.patch('/api/admin/users/:id', authenticate, isHeadOrAdmin, async (req, res) => {
  const { login, password, role, fullName } = req.body;
  const data = {};

  if (login !== undefined) data.login = login;
  if (role !== undefined) data.role = role;
  if (fullName !== undefined) data.fullName = fullName || null;
  if (password) data.password = bcrypt.hashSync(password, 10);

  try {
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    res.status(400).json({ error: 'Не удалось обновить пользователя' });
  }
});

app.delete('/api/admin/users/:id', authenticate, isHeadOrAdmin, async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ message: 'Пользователь удалён' });
});

// ===================================
// СПЕЦИАЛЬНОСТИ — ПОЛНЫЙ CRUD
// ===================================
app.get('/api/specialties', authenticate, async (req, res) => {
  const specs = await prisma.specialty.findMany({
    include: { qualifications: true },
    orderBy: { code: 'asc' }
  });
  res.json(specs);
});

app.post('/api/admin/specialties', authenticate, isHeadOrAdmin, async (req, res) => {
  const { code, name, durationYears } = req.body;
  if (!code || !name || !durationYears) return res.status(400).json({ error: 'Все поля обязательны' });

  const spec = await prisma.specialty.create({
    data: { code, name, durationYears: Number(durationYears) }
  });
  res.status(201).json(spec);
});

app.put('/api/admin/specialties/:id', authenticate, isHeadOrAdmin, async (req, res) => {
  const { code, name, durationYears } = req.body;
  const spec = await prisma.specialty.update({
    where: { id: Number(req.params.id) },
    data: { code, name, durationYears: Number(durationYears) }
  });
  res.json(spec);
});

app.patch('/api/admin/specialties/:id', authenticate, isHeadOrAdmin, async (req, res) => {
  const { code, name, durationYears } = req.body;
  const data = {};

  if (code !== undefined) data.code = code;
  if (name !== undefined) data.name = name;
  if (durationYears !== undefined) data.durationYears = Number(durationYears);

  try {
    const spec = await prisma.specialty.update({
      where: { id: Number(req.params.id) },
      data
    });
    res.json(spec);
  } catch (err) {
    res.status(400).json({ error: 'Не удалось обновить специальность' });
  }
});

app.delete('/api/admin/specialties/:id', authenticate, isHeadOrAdmin, async (req, res) => {
  await prisma.specialty.delete({ where: { id: Number(req.params.id) } });
  res.json({ message: 'Специальность удалена' });
});
// ===================================
// КВАЛИФИКАЦИИ — ПОЛНЫЙ CRUD
// ===================================
app.get('/api/admin/qualifications', authenticate, isHeadOrAdmin, async (req, res) => {
  const quals = await prisma.qualification.findMany({
    include: { specialty: true },
    orderBy: { name: 'asc' }
  });
  res.json(quals);
});

app.post('/api/admin/qualifications', authenticate, isHeadOrAdmin, async (req, res) => {
  const { name, specialtyCode, type = 'IT_TECHNICIAN' } = req.body;
  if (!name || !specialtyCode) return res.status(400).json({ error: 'name и specialtyCode обязательны' });

  const specialty = await prisma.specialty.findUnique({ where: { code: specialtyCode } });
  if (!specialty) return res.status(400).json({ error: 'Специальность не найдена' });

  const qual = await prisma.qualification.create({
    data: { name, specialtyId: specialty.id, type }
  });
  res.status(201).json(qual);
});

app.put('/api/admin/qualifications/:id', authenticate, isHeadOrAdmin, async (req, res) => {
  const { name, specialtyCode, type } = req.body;
  const specialty = specialtyCode ? await prisma.specialty.findUnique({ where: { code: specialtyCode } }) : null;
  const data = { name, type };
  if (specialty) data.specialtyId = specialty.id;

  const qual = await prisma.qualification.update({
    where: { id: Number(req.params.id) },
    data
  });
  res.json(qual);
});

app.delete('/api/admin/qualifications/:id', authenticate, isHeadOrAdmin, async (req, res) => {
  await prisma.qualification.delete({ where: { id: Number(req.params.id) } });
  res.json({ message: 'Квалификация удалена' });
});

// ===================================
// ПРАЗДНИКИ — ПОЛНЫЙ CRUD
// ===================================
// GET /api/holidays - доступно всем аутентифицированным
app.get('/api/holidays', authenticate, async (req, res) => {
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

app.get('/api/admin/holidays', authenticate, isHeadOrAdmin, async (req, res) => {
  const holidays = await prisma.holiday.findMany({ orderBy: { date: 'desc' } });
  res.json(holidays);
});

app.post('/api/admin/holidays', authenticate, isHeadOrAdmin, async (req, res) => {
  const { date, name } = req.body;
  const holiday = await prisma.holiday.create({ data: { date: new Date(date), name } });
  res.status(201).json(holiday);
});

app.put('/api/admin/holidays/:id', authenticate, isHeadOrAdmin, async (req, res) => {
  const { date, name } = req.body;
  const holiday = await prisma.holiday.update({
    where: { id: Number(req.params.id) },
    data: { date: new Date(date), name }
  });
  res.json(holiday);
});

app.delete('/api/admin/holidays/:id', authenticate, isHeadOrAdmin, async (req, res) => {
  await prisma.holiday.delete({ where: { id: Number(req.params.id) } });
  res.json({ message: 'Праздник удалён' });
});

// ===================================
// ГРУППЫ — ПОЛНЫЙ CRUD
// ===================================
// ===================================
// КУРАТОРЫ — ДЛЯ ДРОПДАУНА (ФИО + ID)
// ===================================
app.get('/api/admin/curators', authenticate, isHeadOrAdmin, async (req, res) => {
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
    res.status(500).json({ error: 'Ошибка загрузки кураторов' });
  }
});

// ===================================
// ГРУППЫ — ПОЛНЫЙ CRUD С PATCH
// ===================================

// Все группы + ФИО куратора
app.get('/api/admin/groups', authenticate, isHeadOrAdmin, async (req, res) => {
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
});

// Создать группу
app.post('/api/admin/groups', authenticate, isHeadOrAdmin, async (req, res) => {
  const { name, specialtyCode, course, admissionYear, curatorId } = req.body;

  if (!name || !specialtyCode || !course || !admissionYear) {
    return res.status(400).json({ error: 'Заполните: название, специальность, курс, год поступления' });
  }

  const specialty = await prisma.specialty.findUnique({ where: { code: specialtyCode } });
  if (!specialty) return res.status(400).json({ error: 'Специальность не найдена' });

  if (curatorId) {
    const busy = await prisma.group.findFirst({ where: { curatorId } });
    if (busy) return res.status(400).json({ error: 'Этот куратор уже закреплён за другой группой' });
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
});

// PATCH — ТОЛЬКО ТО, ЧТО ПРИСЛАЛИ (ЛУЧШЕ PUT!)
app.patch('/api/admin/groups/:id', authenticate, isHeadOrAdmin, async (req, res) => {
  const { name, specialtyCode, course, admissionYear, curatorId } = req.body;
  const data = {};

  if (name !== undefined) data.name = name;
  if (course !== undefined) data.course = Number(course);
  if (admissionYear !== undefined) data.admissionYear = Number(admissionYear);

  if (specialtyCode !== undefined) {
    const spec = await prisma.specialty.findUnique({ where: { code: specialtyCode } });
    if (!spec) return res.status(400).json({ error: 'Специальность не найдена' });
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

  try {
    const group = await prisma.group.update({
      where: { id: req.params.id },
      data
    });
    res.json(group);
  } catch (err) {
    res.status(400).json({ error: 'Не удалось обновить группу' });
  }
});

// GET /api/groups — получить все группы
app.get('/api/groups', authenticate, async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        course: true,
        admissionYear: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(groups);
  } catch (err) {
    console.error('Ошибка получения групп:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удалить группу
app.delete('/api/admin/groups/:id', authenticate, isHeadOrAdmin, async (req, res) => {
  await prisma.group.delete({ where: { id: req.params.id } });
  res.json({ message: 'Группа удалена' });
});

// ===================================
// СТУДЕНТЫ + ИМПОРТ
// ===================================
app.get('/api/students', authenticate, async (req, res) => {
  const students = await prisma.student.findMany({
    include: { group: { include: { specialty: true } } }
  });
  res.json(students);
});

app.post('/api/admin/students', authenticate, isHeadOrAdmin, async (req, res) => {
  const student = await prisma.student.create({ data: req.body });
  res.status(201).json(student);
});

// Новый PATCH роут для частичного обновления студента
app.patch('/api/admin/students/:id', authenticate, isHeadOrAdmin, async (req, res) => {
  // Получаем поля, которые могут быть обновлены
  const { fullName, groupId } = req.body;
  const data = {};

  // Добавляем в объект обновления только те поля, которые были переданы
  // и не являются undefined. Это позволяет обновлять только часть данных.
  if (fullName !== undefined) data.fullName = fullName;
  if (groupId !== undefined) data.groupId = groupId;

  // Проверяем, есть ли что обновлять
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Нет данных для обновления' });
  }

  try {
    // Обновляем студента по ID с переданными данными
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data,
    });
    res.json(student);
  } catch (err) {
    // Обработка ошибок, например, если ID студента не найден
    // или нарушено ограничение уникальности (fullName, groupId)
    console.error('Ошибка обновления студента:', err);
    // В зависимости от типа ошибки Prisma можно вернуть более специфичный код,
    // но 400 или 500 — универсальный вариант.
    res.status(400).json({ error: 'Не удалось обновить студента. Проверьте ID, ФИО или ID группы.' });
  }
});

app.delete('/api/admin/students/:id', authenticate, isHeadOrAdmin, async (req, res) => {
  await prisma.student.delete({ where: { id: req.params.id } });
  res.json({ message: 'Студент удалён' });
});

app.post('/api/admin/import/students', authenticate, isHeadOrAdmin, upload.single('file'), async (req, res) => {
  if (!req.file?.buffer) return res.status(400).json({ error: 'Файл не загружен' });
  try {
    const result = await importStudentsFromBuffer(req.file.buffer, prisma);
    if (result.errors?.length > 0) {
      return res.status(207).json({ message: 'Импорт с ошибками', ...result });
    }
    res.json({ message: `Успешно импортировано: ${result.importedCount} студентов` });
  } catch (err) {
    console.error('Импорт ошибка:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===================================
// ПОСЕЩАЕМОСТЬ
// ===================================
// GET /api/attendance - получить посещаемость с фильтрами
app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    const { groupId, studentId, date, startDate, endDate } = req.query;
    const where = {};

    if (groupId) where.groupId = groupId;
    if (studentId && studentId !== 'current') where.studentId = studentId;
    if (studentId === 'current') where.studentId = req.user.id;

    if (date) {
      // Конкретная дата — нормализуем её в учебную таймзону
      const startOfDay = normalizeAttendanceDate(date);
      const nextDay = DateTime.fromISO(date)
        .setZone(ATTENDANCE_TIMEZONE, { keepLocalTime: true })
        .plus({ days: 1 })
        .startOf('day')
        .toJSDate();
      where.date = {
        gte: startOfDay,
        lt: nextDay
      };
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = normalizeAttendanceDate(startDate);
      }
      if (endDate) {
        const end = DateTime.fromISO(endDate)
          .setZone(ATTENDANCE_TIMEZONE, { keepLocalTime: true })
          .endOf('day')
          .toJSDate();
        where.date.lte = end;
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

app.post('/api/attendance', authenticate, async (req, res) => {
  const { studentId, groupId, date, status } = req.body;
  const cleanDate = normalizeAttendanceDate(date);
  console.log('--- ATTENDANCE DATE DEBUG ---');
  console.log('RAW FROM FRONT:', date);
  console.log('CLEAN (ISO):', cleanDate.toISOString());
  console.log('CLEAN (LOCAL):', cleanDate.toString());
  console.log('------------------------------');


  const attendance = await prisma.attendance.upsert({
    where: { studentId_date: { studentId, date: cleanDate } },
    update: { status, updatedById: req.user.id },
    create: { studentId, groupId, date: cleanDate, status, updatedById: req.user.id }
  });

  res.json(attendance);
});

// Добавь это прямо в server.js, где остальные роуты посещаемости
app.post('/api/attendance/batch', authenticate, async (req, res) => {
  const { records } = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'records должен быть непустым массивом' });
  }

  const errors = [];
  let created = 0;
  let updated = 0;

  for (const record of records) {
    try {
      const { studentId, groupId, date, status } = record;
      const cleanDate = normalizeAttendanceDate(date);
      console.log('--- ATTENDANCE DATE DEBUG ---');
      console.log('RAW FROM FRONT:', date);
      console.log('CLEAN (ISO):', cleanDate.toISOString());
      console.log('CLEAN (LOCAL):', cleanDate.toString());
      console.log('------------------------------');


      const existing = await prisma.attendance.findUnique({
        where: { studentId_date: { studentId, date: cleanDate } }
      });

      if (existing) {
        await prisma.attendance.update({
          where: { id: existing.id },
          data: { status, updatedById: req.user.id }
        });
        updated++;
      } else {
        await prisma.attendance.create({
          data: { studentId, groupId, date: cleanDate, status, updatedById: req.user.id }
        });
        created++;
      }
    } catch (err) {
      errors.push(`Ошибка: ${err.message}`);
    }
  }

  res.json({ created, updated, errors: errors.length > 0 ? errors : undefined });
});

// ===================================
// ЭКСПОРТ В EXCEL — РАБОЧАЯ ВЕРСИЯ
// ===================================
app.get('/api/export/attendance', authenticate, isHeadOrAdmin, (req, res) => {
  exportAttendanceService(prisma, req, res);
});

// ===================================
// ЗАВЕРШЕНИЕ УЧЕБНОГО ГОДА — БЕЗОПАСНО
// ===================================
app.post('/api/admin/finish-year', authenticate, isHeadOrAdmin, async (req, res) => {
  const now = DateTime.now();
  const year = now.month >= 9 ? now.year : now.year - 1;
  const nextYear = year + 1;
  const archiveTable = `attendance_archive_${year}_${nextYear}`;

  try {
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

// === СТАТИСТИКА СТУДЕНТА ===
app.get('/api/attendance/stats/summary', authenticate, isHeadOrAdmin, async (req, res) => {
  try {
    const { type = 'academic_year', start, end } = req.query;
    const range = getDateRange(type, start, end);

    const holidays = await prisma.holiday.findMany({
      where: { date: { gte: range.start, lte: range.end } },
      select: { date: true }
    });
    const holidayDates = holidays.map(h => h.date);

    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        curatorId: true,
        _count: { select: { students: true } }
      }
    });

    const summary = [];

    for (const group of groups) {
      let stats;
      if (type === 'today') {
        const todayRecords = await prisma.attendance.findMany({
          where: {
            groupId: group.id,
            date: { gte: range.start, lte: range.end }
          },
          select: { status: true }
        });

        const markedCount = todayRecords.length;
        const totalStudents = group._count.students;

        let presentCount = 0;
        let absentCount = 0;

        todayRecords.forEach(r => {
          if (['PRESENT', 'VALID_ABSENT', 'ITHUB', 'DUAL', 'LATE'].includes(r.status)) {
            presentCount++;
          } else if (r.status === 'ABSENT') {
            absentCount++;
          }
        });

        let percent;
        if (totalStudents === 0) {
          percent = 100;
        }else if (markedCount === 0) {
          percent = 0; // никто не отмечен — 0%
        } else {
          const total = presentCount + absentCount;
          percent = total > 0 ? Math.round((presentCount / total) * 100) : 0;
        }

          stats = { percent };

        } else {
          // Для других периодов — обычная логика
          const records = await prisma.attendance.findMany({
            where: {
              groupId: group.id,
              date: { gte: range.start, lte: range.end }
            },
            select: { date: true, status: true }
          });

          stats = await calculateAttendance(records, holidayDates, range.start, range.end);
        }

        summary.push({
          groupId: group.id,
          groupName: group.name,
          curatorId: group.curatorId,
          percent: Math.round(stats.percent || 0),
          studentsCount: group._count.students
        });
      }

      // Добавляем нулевые группы, чтобы не исчезали
      const sorted = [...summary].sort((a, b) => b.percent - a.percent);

      const avg = sorted.length ? Math.round(sorted.reduce((a, b) => a + b.percent, 0) / sorted.length) : 100;

      res.json({
        period: type === 'custom' ? `${start} → ${end}` : type,
        averagePercent: avg,
        bestGroup: sorted[0] || null,
        worstGroup: sorted[sorted.length - 1] || null,
        groups: sorted
      });
    } catch (err) {
      console.error('Ошибка в /stats/summary:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });
// === СТАТИСТИКА ПО ОДНОМУ СТУДЕНТУ (для страницы "Все студенты") ===
app.get('/api/attendance/student/:id/percent', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'academic_year', start, end } = req.query;

    const range = getDateRange(type, start, end);

    // Праздники за период
    const holidays = await prisma.holiday.findMany({
      where: {
        date: { gte: range.start, lte: range.end }
      },
      select: { date: true }
    });
    const holidayDates = holidays.map(h => h.date);

    // Записи посещаемости только этого студента за период
    const records = await prisma.attendance.findMany({
      where: {
        studentId: id,
        date: { gte: range.start, lte: range.end }
      },
      select: {
        date: true,
        status: true
      }
    });

    const stats = await calculateAttendance(records, holidayDates, range.start, range.end);

    // Инфо о студенте для красоты (можно не использовать, но полезно)
    const student = await prisma.student.findUnique({
      where: { id },
      select: { fullName: true, group: { select: { name: true } } }
    });

    if (!student) {
      return res.status(404).json({ error: 'Студент не найден' });
    }

    res.json({
      studentId: id,
      fullName: student.fullName,
      group: student.group.name,
      percent: Math.round(stats.percent || 0),
      period: type === 'custom' ? `${start} → ${end}` : type
    });
  } catch (err) {
    console.error('Ошибка статистики одного студента:', err);
    res.status(500).json({ error: 'Ошибка сервера при расчёте процента' });
  }
});

// ===================================
// ТЕСТ
// ===================================
app.get('/api/test', (req, res) => res.json({ message: 'Бэкенд работает!' }));

// POST /api/practice-days/batch
// Добавляет дни практики для группы в диапазоне дат
app.post('/api/practice-days/batch', authenticate, isAdmin, async (req, res) => {
  try {
    const { groupId, startDate, endDate, name } = req.body;

    if (!groupId || !startDate || !endDate) {
      return res.status(400).json({ error: 'groupId, startDate и endDate обязательны' });
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(400).json({ error: 'Группа не найдена' });
    }

    const start = DateTime.fromISO(startDate).startOf('day');
    const end = DateTime.fromISO(endDate).startOf('day');

    if (start > end) {
      return res.status(400).json({ error: 'Начальная дата не может быть позже конечной' });
    }

    const days = [];
    let current = start;
    while (current <= end) {
      days.push(current.toJSDate());
      current = current.plus({ days: 1 });
    }

    const created = [];
    const skipped = [];

    for (const date of days) {
      try {
        const practice = await prisma.practiceDay.upsert({
          where: { groupId_date: { groupId, date } },
          update: { name: name || null },
          create: { groupId, date, name: name || null }
        });
        created.push(practice);
      } catch (err) {
        skipped.push(date.toISOString().slice(0, 10));
      }
    }

    res.json({
      message: `Добавлено ${created.length} дней практики`,
      skipped: skipped.length > 0 ? skipped : undefined
    });
  } catch (err) {
    console.error('Ошибка добавления дней практики:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/practice-days/check?groupId=...&date=2025-12-23
// Проверяет, является ли день практикой для группы
app.get('/api/practice-days/check', authenticate, async (req, res) => {
  try {
    const { groupId, date } = req.query;

    if (!groupId || !date) {
      return res.status(400).json({ error: 'groupId и date обязательны' });
    }

    // Приводим дату к началу дня (как в других местах)
    const cleanDate = new Date(date);
    cleanDate.setHours(0, 0, 0, 0);

    const practice = await prisma.practiceDay.findUnique({
      where: {
        groupId_date: {
          groupId,
          date: cleanDate
        }
      }
    });

    res.json({
      isPractice: !!practice,
      name: practice?.name || 'практика'
    });
  } catch (err) {
    console.error('Ошибка проверки дня практики:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/practice-days/today — группы на практике сегодня
app.get('/api/practice-days/today', authenticate, isHeadOrAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const practices = await prisma.practiceDay.findMany({
      where: { date: today },
      select: { groupId: true }
    });

    res.json(practices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка' });
  }
});

app.get('/api/practice-days/range', authenticate, isHeadOrAdmin, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: 'start и end обязательны' });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const practices = await prisma.practiceDay.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      select: { groupId: true },
      distinct: ['groupId'] // только уникальные группы
    });

    res.json(practices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/users?role=HEAD — получить пользователей по роли
app.get('/api/users', authenticate, isHeadOrAdmin, async (req, res) => {
  try {
    const { role } = req.query;

    const where = {};
    if (role) {
      where.role = role.toUpperCase(); // HEAD, ADMIN и т.д.
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        login: true,
        role: true
      },
      orderBy: { fullName: 'asc' }
    });

    res.json(users);
  } catch (err) {
    console.error('Ошибка получения пользователей:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

console.log(chalk.bold.green('Сервер готов к бою.'));