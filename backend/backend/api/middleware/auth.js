// api/middleware/auth.js
// Middleware для аутентификации и авторизации

const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware для проверки аутентификации
 * Проверяет наличие и валидность JWT токена
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Токен отсутствует' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Недействительный или просроченный токен' });
  }
};

/**
 * Middleware для проверки прав доступа (только HEAD и ADMIN)
 */
const isHeadOrAdmin = (req, res, next) => {
  if (!req.user || !['HEAD', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Доступ запрещён. Только для HEAD и ADMIN' });
  }
  next();
};

/**
 * Middleware для проверки прав доступа (только ADMIN)
 */
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Доступ запрещён. Только для ADMIN' });
  }
  next();
};

/**
 * Middleware для проверки прав доступа (HEAD, ADMIN или TEACHER)
 */
const isTeacherOrAbove = (req, res, next) => {
  if (!req.user || !['TEACHER', 'HEAD', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Доступ запрещён. Только для TEACHER, HEAD и ADMIN' });
  }
  next();
};

module.exports = {
  authenticate,
  isHeadOrAdmin,
  isAdmin,
  isTeacherOrAbove
};




