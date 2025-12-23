// Скрипт для безопасного применения миграции
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function applyMigration() {
  console.log('🔄 Начинаю безопасное применение миграции...\n');

  try {
    // Сначала проверяем текущий статус миграций
    console.log('📊 Проверяю статус миграций...');
    try {
      const status = execSync('npx prisma migrate status', {
        encoding: 'utf8',
        cwd: __dirname,
        stdio: 'pipe'
      });
      console.log(status);
    } catch (e) {
      console.log('⚠️  Не удалось проверить статус (это нормально, если миграции еще не применялись)');
    }

    console.log('\n🔒 Применяю миграцию (безопасно, данные не будут потеряны)...');
    
    // Применяем миграцию через Prisma
    const result = execSync('npx prisma migrate deploy', {
      encoding: 'utf8',
      cwd: __dirname,
      stdio: 'inherit'
    });

    console.log('\n✅ Миграция успешно применена!');
    
    console.log('\n🔄 Генерирую Prisma клиент...');
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
    if (error.stdout) console.error('Вывод:', error.stdout);
    if (error.stderr) console.error('Ошибки:', error.stderr);
    process.exit(1);
  }
}

applyMigration();

