const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const QRCode = require('qrcode');
const crypto = require('crypto');

class QRService {
    // Генерируем токен, привязанный к преподавателю и ПАРЕ
    async generateToken(teacherId, lessonId) {
        // Удаляем старые токены этого преподавателя для этой пары
        await prisma.qrToken.deleteMany({ 
            where: { 
                teacherId: teacherId,
                lessonId: parseInt(lessonId)
            } 
        });

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут лимит

        return await prisma.qrToken.create({
            data: {
                token,
                teacherId,
                lessonId: parseInt(lessonId),
                expiresAt
            }
        });
    }

    // Создаем DataURL для отображения QR на фронтенде
    async generateQRCode(token) {
        try {
            // В QR зашиваем сам токен
            return await QRCode.toDataURL(token);
        } catch (err) {
            console.error('QR Generation Error:', err);
            throw err;
        }
    }

    // Проверка токена
    async verifyToken(token) {
        const qrRecord = await prisma.qrToken.findUnique({
            where: { token }
        });

        if (!qrRecord) return null;
        if (new Date() > qrRecord.expiresAt) return null;

        return qrRecord;
    }
}

module.exports = new QRService();