// api/routes/users.js
// Маршруты для управления пользователями

const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/admin/users
 * Получить список всех пользователей
 * Headers: Authorization: Bearer <token>
 * Response: Array<{ id, login, role, fullName, createdAt }>
 */
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, login: true, role: true, fullName: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (err) {
    console.error('Ошибка получения пользователей:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/admin/users/:id
 * Получить пользователя по ID
 * Headers: Authorization: Bearer <token>
 * Response: { id, login, role, fullName, createdAt }
 */
router.get('/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, login: true, role: true, fullName: true, createdAt: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json(user);
  } catch (err) {
    console.error('Ошибка получения пользователя:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/admin/users
 * Создать нового пользователя
 * Headers: Authorization: Bearer <token>
 * Body: { login: string, password: string, role: UserRole, fullName?: string }
 * Response: { id, login, role, fullName, createdAt }
 */
router.post('/', async (req, res) => {
  try {
    const { login, password, role, fullName } = req.body;
    if (!login || !password || !role) {
      return res.status(400).json({ error: 'login, password, role обязательны' });
    }

    // Проверка уникальности логина
    const existing = await prisma.user.findUnique({ where: { login } });
    if (existing) {
      return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
    }

    const hashed = bcrypt.hashSync(password, 10);
    const user = await prisma.user.create({
      data: { login, password: hashed, role, fullName: fullName || null }
    });

    const { password: _, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (err) {
    console.error('Ошибка создания пользователя:', err);
    res.status(400).json({ error: 'Не удалось создать пользователя' });
  }
});

/**
 * PUT /api/admin/users/:id
 * Полное обновление пользователя
 * Headers: Authorization: Bearer <token>
 * Body: { login?: string, role?: UserRole, fullName?: string, password?: string }
 * Response: { id, login, role, fullName, createdAt }
 */
router.put('/:id', async (req, res) => {
  try {
    const { login, role, fullName, password } = req.body;
    const data = { login, role, fullName: fullName || null };
    
    if (password) {
      data.password = bcrypt.hashSync(password, 10);
    }

    // Проверка уникальности логина (если изменяется)
    if (login) {
      const existing = await prisma.user.findFirst({
        where: { login, NOT: { id: req.params.id } }
      });
      if (existing) {
        return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data
    });

    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    console.error('Ошибка обновления пользователя:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.status(400).json({ error: 'Не удалось обновить пользователя' });
  }
});

/**
 * PATCH /api/admin/users/:id
 * Частичное обновление пользователя
 * Headers: Authorization: Bearer <token>
 * Body: { login?: string, role?: UserRole, fullName?: string, password?: string }
 * Response: { id, login, role, fullName, createdAt }
 */
router.patch('/:id', async (req, res) => {
  try {
    const { login, password, role, fullName } = req.body;
    const data = {};

    if (login !== undefined) data.login = login;
    if (role !== undefined) data.role = role;
    if (fullName !== undefined) data.fullName = fullName || null;
    if (password) data.password = bcrypt.hashSync(password, 10);

    // Проверка уникальности логина (если изменяется)
    if (login) {
      const existing = await prisma.user.findFirst({
        where: { login, NOT: { id: req.params.id } }
      });
      if (existing) {
        return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data
    });

    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    console.error('Ошибка обновления пользователя:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.status(400).json({ error: 'Не удалось обновить пользователя' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Удалить пользователя
 * Headers: Authorization: Bearer <token>
 * Response: { message: string }
 */
router.delete('/:id', async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'Пользователь удалён' });
  } catch (err) {
    console.error('Ошибка удаления пользователя:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.status(500).json({ error: 'Не удалось удалить пользователя' });
  }
});

module.exports = router;




