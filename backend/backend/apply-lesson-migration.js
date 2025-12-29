// Скрипт для безопасного применения миграции с логикой по парам
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function applyMigration() {
  console.log('🔄 Начинаю безопасное применение миграции для логики по парам...\n');

  try {
    const prisma = new PrismaClient();

    // Читаем SQL миграцию
    const migrationPath = path.join(__dirname, 'prisma', 'migrations', '20251220000000_add_lessons_and_user_relations', 'migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📊 Проверяю наличие данных в lesson_schedule...\n');
    
    // Проверяем, есть ли данные в lesson_schedule
    const lessonCount = await prisma.lessonSchedule.count();
    
    if (lessonCount === 0) {
      console.log('⚠️  Внимание: таблица lesson_schedule пустая!');
      console.log('💡 Рекомендуется сначала заполнить расписание пар через интерфейс заведующей.');
      console.log('   Или миграция использует ID = 1 по умолчанию.\n');
    } else {
      console.log(`✅ Найдено ${lessonCount} записей в расписании пар\n`);
    }

    console.log('🔒 Применяю миграцию (безопасно, данные не будут потеряны)...\n');
    
    // Выполняем миграцию через Prisma migrate
    try {
      execSync('npx prisma migrate deploy', {
        encoding: 'utf8',
        cwd: __dirname,
        stdio: 'inherit'
      });
      console.log('\n✅ Миграция успешно применена!');
    } catch (error) {
      console.error('\n❌ Ошибка при применении миграции через Prisma migrate deploy');
      console.error('Попробуйте применить миграцию вручную через:');
      console.error('  npx prisma migrate deploy');
      throw error;
    }
    
    console.log('\n🔄 Генерирую Prisma клиент...');
    execSync('npx prisma generate', {
      encoding: 'utf8',
      cwd: __dirname,
      stdio: 'inherit'
    });

    console.log('\n✅ Все готово! Миграция применена, Prisma клиент обновлен.');
    console.log('💡 Теперь можно перезапустить сервер.');
    console.log('\n📌 Важно:');
    console.log('   - Для существующих записей attendance установлен lessonId = первый доступный ID из lesson_schedule');
    console.log('   - Если есть дубликаты по [studentId, date], они будут распределены по разным парам (1, 2, 3...)');
    console.log('   - Проверьте данные после миграции!');

    await prisma.$disconnect();

  } catch (error) {
    console.error('\n❌ Ошибка при применении миграции:');
    console.error(error.message);
    if (error.stdout) console.error('Вывод:', error.stdout);
    if (error.stderr) console.error('Ошибки:', error.stderr);
    process.exit(1);
  }
}

applyMigration();





