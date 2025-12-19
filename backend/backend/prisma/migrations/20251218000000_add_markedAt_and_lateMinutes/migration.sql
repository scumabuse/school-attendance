-- Добавляем поля для учёта опозданий в таблицу attendance
-- Только добавление, без удаления существующих данных/столбцов

ALTER TABLE "attendance"
  ADD COLUMN IF NOT EXISTS "markedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lateMinutes" INTEGER;


