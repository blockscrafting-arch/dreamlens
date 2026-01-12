# Быстрая инструкция по настройке Neon PostgreSQL

## Шаг 1: Создание Neon базы данных

1. Откройте [neon.tech](https://neon.tech)
2. Зарегистрируйтесь или войдите (можно через GitHub)
3. Нажмите **Create Project**
4. Выберите регион (ближайший к вам)
5. Выберите PostgreSQL версию (любая последняя)
6. Нажмите **Create Project**

## Шаг 2: Получение Connection String

1. После создания проекта откройте Dashboard
2. Найдите раздел **Connection Details** или **Connection String**
3. Скопируйте **Connection string** (начинается с `postgresql://...`)
4. Это будет ваш `POSTGRES_URL`

## Шаг 3: Настройка в Vercel

1. Откройте Vercel Dashboard → ваш проект
2. Перейдите в **Settings** → **Environment Variables**
3. Добавьте переменную:
   - **Key**: `POSTGRES_URL`
   - **Value**: ваш Connection String из Neon
   - Выберите окружения: Production, Preview, Development
4. Нажмите **Save**

## Шаг 4: Пересборка проекта

1. В Vercel Dashboard перейдите в **Deployments**
2. Найдите последний deployment
3. Нажмите на три точки (⋯) → **Redeploy**
4. Или просто сделайте новый commit и push (автоматический деплой)

## Шаг 5: Инициализация схемы БД

После пересборки проекта схема БД инициализируется автоматически при первом запросе к API.

**Проверка:**
1. Откройте ваш сайт и выполните любой запрос к API
2. Или проверьте логи в Vercel Dashboard → Functions → Logs
3. Должно появиться сообщение: "Database schema initialized successfully"

**Альтернатива - ручная инициализация:**
1. Добавьте переменную `DB_INIT_SECRET` в Vercel (любая случайная строка)
2. Вызовите: `https://your-domain.vercel.app/api/init-db?secret=YOUR_SECRET`

## Шаг 6: Проверка работоспособности

### Проверка health endpoint:
```bash
curl https://your-domain.vercel.app/api/health
```
Должен вернуть: `"database": { "status": "healthy" }`

### Проверка создания пользователя:
```bash
curl -H "Authorization: Device device_test123" https://your-domain.vercel.app/api/user
```

### Проверка токенов:
```bash
curl -H "Authorization: Device device_test123" https://your-domain.vercel.app/api/tokens
```

### Проверка таблиц в Neon:
1. Откройте Neon Dashboard → SQL Editor
2. Выполните:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Должны быть таблицы:
- `users`
- `user_tokens`
- `token_transactions`
- `generations`
- `subscriptions`
- `payments`
- `usage_logs`

## Если что-то не работает

### Ошибка: "Database configuration missing"
- Убедитесь, что `POSTGRES_URL` добавлен в Vercel
- Проверьте, что переменная добавлена для нужного окружения (Production/Preview)
- Пересоберите проект после добавления переменной

### Ошибка: "Database connection failed"
- Проверьте, что Connection String правильный (начинается с `postgresql://`)
- Убедитесь, что база данных Neon активна
- Попробуйте скопировать Connection String заново из Neon Dashboard

### Ошибка: "relation does not exist"
- Схема БД не инициализирована
- Выполните любой запрос к API (схема создастся автоматически)
- Или используйте `/api/init-db` endpoint

## Полезные ссылки

- [Neon Dashboard](https://console.neon.tech)
- [Neon Documentation](https://neon.tech/docs)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

