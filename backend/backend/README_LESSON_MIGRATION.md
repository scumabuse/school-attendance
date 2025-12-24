# Инструкция по применению миграции для логики по парам

## Безопасная миграция базы данных

Эта миграция **НЕ УДАЛИТ** существующие данные. Она добавляет:
- Поле `lessonId` в таблицу `attendance` (связь с парами)
- Поле `userId` в таблицу `students` (связь с аккаунтами пользователей)
- Изменяет уникальный индекс с `[studentId, date]` на `[studentId, date, lessonId]`

## Что делает миграция

### 1. Добавление lessonId в attendance

- Добавляет поле `lessonId INTEGER NOT NULL`
- Для существующих записей устанавливает значение = первый доступный ID из `lesson_schedule`
- Если таблица `lesson_schedule` пустая, использует ID = 1 (потребуется создать расписание позже)

### 2. Связь с lesson_schedule

- Добавляет внешний ключ `attendance.lessonId -> lesson_schedule.id`
- Использует `ON DELETE RESTRICT` для защиты данных
- Создает индекс для производительности

### 3. Изменение уникального ключа

- Удаляет старый уникальный индекс `[studentId, date]`
- Создает новый уникальный индекс `[studentId, date, lessonId]`
- Теперь один студент может иметь несколько записей в один день (для разных пар)

### 4. Связь Student с User

- Добавляет поле `userId UUID` в таблицу `students` (nullable, unique)
- Добавляет внешний ключ `students.userId -> users.id`
- Позволяет связать аккаунт студента с профилем студента

## Важно перед применением!

⚠️ **Рекомендуется создать резервную копию базы данных перед применением миграции!**

```sql
-- Создание бэкапа (пример для PostgreSQL)
pg_dump -U postgres -d college_attendance > backup_before_lesson_migration.sql
```

## Как применить миграцию

### Вариант 1: Через Node.js скрипт (рекомендуется)

```bash
cd College_Attendance/backend/backend
node apply-lesson-migration.js
```

### Вариант 2: Через Prisma напрямую

```bash
cd College_Attendance/backend/backend

# Применить миграцию
npx prisma migrate deploy

# Перегенерировать Prisma клиент
npx prisma generate
```

### Вариант 3: Через npm скрипт

```bash
cd College_Attendance/backend/backend
npm run prisma:migrate:deploy
npx prisma generate
```

## После применения миграции

1. ✅ Проверьте, что все данные на месте
2. ✅ Убедитесь, что в таблице `lesson_schedule` есть хотя бы одна запись
3. ✅ Если используется ID = 1 для старых записей, убедитесь что такой ID существует в `lesson_schedule`
4. ✅ Перезапустите сервер

## Проверка после миграции

```sql
-- Проверить, что все записи attendance имеют lessonId
SELECT COUNT(*) FROM attendance WHERE "lessonId" IS NULL;
-- Должно быть 0

-- Проверить, что lessonId существует в lesson_schedule
SELECT DISTINCT a."lessonId" 
FROM attendance a 
LEFT JOIN lesson_schedule ls ON a."lessonId" = ls.id 
WHERE ls.id IS NULL;
-- Должно быть пусто

-- Проверить уникальность по новому ключу
SELECT "studentId", "date", "lessonId", COUNT(*) as cnt
FROM attendance
GROUP BY "studentId", "date", "lessonId"
HAVING COUNT(*) > 1;
-- Должно быть пусто
```

## Возможные проблемы

### Проблема: Миграция не проходит из-за внешнего ключа

**Решение**: Убедитесь, что в таблице `lesson_schedule` есть хотя бы одна запись с ID, который используется в старых записях `attendance`.

### Проблема: Ошибка "duplicate key value"

**Решение**: Это значит, что уже есть записи с одинаковым `[studentId, date, lessonId]`. Проверьте данные и исправьте дубликаты вручную.

### Проблема: lessonId = 1 не существует в lesson_schedule

**Решение**: 
1. Создайте расписание через интерфейс заведующей
2. Или создайте запись вручную:
```sql
INSERT INTO lesson_schedule ("dayOfWeek", "pairNumber", "startTime", "endTime") 
VALUES (1, 1, '08:00', '09:30');
```

## Откат миграции (если нужно)

Если нужно откатить миграцию:

1. Удалите новые поля и индексы
2. Восстановите старую структуру

**⚠️ Внимание**: Откат может привести к потере данных! Обязательно используйте резервную копию!

