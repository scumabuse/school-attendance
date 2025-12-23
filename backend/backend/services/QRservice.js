const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

class QrService {
  // Генерируем токен на 30 минут
  async generateToken(teacherId) {
    // Удаляем старые токены этого преподавателя, чтобы не засорять БД
    await prisma.qrToken.deleteMany({ where: { teacherId } });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // Срок жизни 30 минут

    return await prisma.qrToken.create({
      data: { 
        token, 
        teacherId, 
        expiresAt 
      }
    });
  }

  // Проверяем токен при сканировании
  async validateToken(token) {
    const record = await prisma.qrToken.findUnique({ where: { token } });

    if (!record) return { valid: false, message: "Код недействителен" };
    if (new Date() > record.expiresAt) return { valid: false, message: "Срок действия кода истек" };

    return { valid: true, teacherId: record.teacherId };
  }
}

module.exports = new QrService();