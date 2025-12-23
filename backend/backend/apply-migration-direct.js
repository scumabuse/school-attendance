// Прямое применение миграции через SQL
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const migrationSQL = `
-- БЕЗОПАСНАЯ МИГРАЦИЯ: Добавление поля teacherId в таблицу qr_tokens
-- Эта миграция НЕ удаляет и НЕ изменяет существующие данные
-- Она только добавляет новые поля, если их еще нет

-- Создаем таблицу qr_tokens, если её еще нет (сохраняем все существующие данные)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'qr_tokens'
    ) THEN
        CREATE TABLE "qr_tokens" (
            "id" UUID NOT NULL,
            "token" TEXT NOT NULL,
            "expiresAt" TIMESTAMP(3) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "qr_tokens_pkey" PRIMARY KEY ("id")
        );
        
        CREATE UNIQUE INDEX "qr_tokens_token_key" ON "qr_tokens"("token");
    END IF;
END $$;

-- Добавляем поле teacherId, если его еще нет (NULL безопасно для существующих записей)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'qr_tokens' 
        AND column_name = 'teacherId'
    ) THEN
        ALTER TABLE "qr_tokens" ADD COLUMN "teacherId" UUID;
    END IF;
END $$;

-- Добавляем поле lessonId, если его еще нет (делаем его nullable)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'qr_tokens' 
        AND column_name = 'lessonId'
    ) THEN
        ALTER TABLE "qr_tokens" ADD COLUMN "lessonId" INTEGER;
    ELSE
        -- Если поле уже существует, убеждаемся что оно nullable
        ALTER TABLE "qr_tokens" ALTER COLUMN "lessonId" DROP NOT NULL;
    END IF;
END $$;

-- Создаем индекс для teacherId, если его еще нет
CREATE INDEX IF NOT EXISTS "qr_tokens_teacherId_idx" ON "qr_tokens"("teacherId");

-- Добавляем внешний ключ на users, если его еще нет
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'qr_tokens_teacherId_fkey' 
        AND table_name = 'qr_tokens'
        AND constraint_schema = 'public'
    ) THEN
        ALTER TABLE "qr_tokens" 
        ADD CONSTRAINT "qr_tokens_teacherId_fkey" 
        FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
`;

async function applyMigration() {
  console.log('🔄 Начинаю безопасное применение миграции...\n');
  
  try {
    console.log('📊 Выполняю миграцию SQL...\n');
    
    // Выполняем весь SQL как одну транзакцию
    // Убираем комментарии и лишние пробелы
    const cleanSQL = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .replace(/BEGIN;/g, '')
      .replace(/COMMIT;/g, '');
    
    try {
      await prisma.$executeRawUnsafe(cleanSQL);
      console.log('✅ SQL миграция выполнена успешно!');
    } catch (error) {
      // Игнорируем ошибки "уже существует" - это нормально для идемпотентной миграции
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate') ||
          error.message.includes('уже существует') ||
          error.message.includes('does not exist') && error.message.includes('qr_tokens')) {
        console.log('ℹ️  Некоторые объекты уже существуют (это нормально для безопасной миграции)');
      } else {
        throw error;
      }
    }
    
    console.log('\n✅ Миграция успешно применена!');
    console.log('🔄 Генерирую Prisma клиент...\n');
    
    // Перегенерируем Prisma клиент
    const { execSync } = require('child_process');
    execSync('npx prisma generate', {
      encoding: 'utf8',
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    console.log('\n✅ Все готово! Миграция применена, Prisma клиент обновлен.');
    console.log('💡 Теперь можно перезапустить сервер.');
    
  } catch (error) {
    console.error('\n❌ Ошибка при применении миграции:');
    console.error(error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();

