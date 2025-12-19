# Настройка переменных окружения

Для работы приложения необходимо создать файл `.env` в папке `backend/backend/`.

## Инструкция

1. Создайте файл `.env` в папке `backend/backend/`
2. Скопируйте следующее содержимое в файл:

```env
# База данных PostgreSQL
# Замените user, password и database_name на свои реальные данные
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/college_attendance?schema=public"

# Секретный ключ для JWT токенов
JWT_SECRET="your-secret-key-change-this-in-production"

# Порт сервера (опционально, по умолчанию 5000)
PORT=5000
```

3. Замените значения на свои:
   - `postgres:postgres` - имя пользователя и пароль PostgreSQL
   - `college_attendance` - имя базы данных
   - `localhost:5432` - хост и порт PostgreSQL (обычно localhost:5432)

## Примеры DATABASE_URL

Если ваша база данных на localhost с другими данными:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/database_name?schema=public"
```

Если база данных на удаленном сервере:
```env
DATABASE_URL="postgresql://username:password@hostname:5432/database_name?schema=public"
```

## После создания .env файла

1. Убедитесь, что PostgreSQL запущен
2. Установите зависимости: `npm install`
3. Выполните миграции: `npm run prisma:migrate`
4. Запустите сервер: `npm run dev`








