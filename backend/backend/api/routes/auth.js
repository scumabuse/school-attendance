// api/routes/auth.js
// Маршруты аутентификации

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * POST /api/auth/login
 * Вход в систему
 * Body: { login: string, password: string }
 * Response: { token: string, user: { id, login, role, fullName } }
 */
router.post('/login', async (req, res) => {
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
      JWT_SECRET,
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

/**
 * POST /api/auth/verify
 * Проверка токена
 * Headers: Authorization: Bearer <token>
 * Response: { valid: boolean, user?: { id, login, role, fullName } }
 */
router.post('/verify', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false, error: 'Токен отсутствует' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) {
      return res.status(401).json({ valid: false, error: 'Пользователь не найден' });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        login: user.login,
        role: user.role,
        fullName: user.fullName || 'Администратор'
      }
    });
  } catch (err) {
    res.status(401).json({ valid: false, error: 'Недействительный или просроченный токен' });
  }
});

module.exports = router;




