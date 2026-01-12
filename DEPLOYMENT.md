# Инструкции по деплою DreamLens AI

## Подготовка к деплою на Vercel

### 1. Настройка базы данных (Vercel Postgres или Neon)

#### Вариант A: Vercel Postgres

1. В Vercel Dashboard перейдите в Storage → Create Database → Postgres
2. Создайте базу данных
3. Скопируйте переменные окружения:
   - `POSTGRES_URL`
   - `POSTGRES_PRISMA_URL`
   - `POSTGRES_URL_NON_POOLING`

#### Вариант B: Neon Database

1. Создайте проект на [neon.tech](https://neon.tech)
2. Скопируйте connection string
3. Добавьте переменные окружения в Vercel:
   - `POSTGRES_URL` (pooling URL)
   - `POSTGRES_URL_NON_POOLING` (non-pooling URL, опционально)

#### Инициализация схемы базы данных

**Автоматическая инициализация (рекомендуется):**

Схема базы данных инициализируется автоматически при первом подключении к Neon базе данных. Приложение проверяет наличие таблиц и создает их при необходимости.

**Ручная инициализация через API endpoint:**

1. Установите переменную окружения `DB_INIT_SECRET` в Vercel Dashboard (Settings → Environment Variables)
   - Используйте надежный случайный секрет (например, сгенерированный через `openssl rand -hex 32`)

2. Вызовите endpoint для инициализации:
   ```bash
   # Через query параметр
   curl "https://your-domain.vercel.app/api/init-db?secret=YOUR_SECRET"
   
   # Или через заголовок
   curl -H "X-DB-Init-Secret: YOUR_SECRET" https://your-domain.vercel.app/api/init-db
   ```

3. Проверьте ответ - должен вернуться `{"success": true, "message": "Database schema initialized successfully"}`

**Альтернативный способ (через SQL):**

```bash
# Подключитесь к базе через Vercel CLI или используйте SQL редактор
psql $POSTGRES_URL -f database/schema.sql
```

**Примечание:** Для Neon базы данных автоматическая инициализация происходит при первом запросе к API. Для Vercel Postgres рекомендуется использовать ручную инициализацию через SQL или API endpoint.

### 2. Настройка Clerk

1. Создайте приложение на [clerk.com](https://clerk.com)
2. Скопируйте ключи:
   - `Publishable Key` → `VITE_CLERK_PUBLISHABLE_KEY` (для клиента)
   - **`Secret Key` → `CLERK_SECRET_KEY` (для сервера) - ОБЯЗАТЕЛЬНО!**
     - **Без этого ключа все запросы с Clerk токенами будут возвращать 401 Unauthorized**
     - Получите ключ в Clerk Dashboard → API Keys → Secret Keys

3. **КРИТИЧЕСКИ ВАЖНО: Соответствие Test/Live ключей**
   
   Clerk использует два типа ключей:
   - **Test ключи** (для разработки): начинаются с `pk_test_` / `sk_test_`
   - **Live ключи** (для продакшена): начинаются с `pk_live_` / `sk_live_`
   
   **Правило соответствия:**
   - Если `VITE_CLERK_PUBLISHABLE_KEY` начинается с `pk_test_`, то `CLERK_SECRET_KEY` **обязательно** должен начинаться с `sk_test_`
   - Если `VITE_CLERK_PUBLISHABLE_KEY` начинается с `pk_live_`, то `CLERK_SECRET_KEY` **обязательно** должен начинаться с `sk_live_`
   
   **Что произойдет при несоответствии:**
   - Все запросы с Clerk токенами будут возвращать `401 Unauthorized`
   - В логах будет ошибка "Token verification failed" или "Invalid token"
   - Пользователи не смогут авторизоваться через Clerk
   
   **Примеры правильной конфигурации:**
   ```
   ✅ Правильно (Test режим):
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_abc123...
   CLERK_SECRET_KEY=sk_test_xyz789...
   
   ✅ Правильно (Production режим):
   VITE_CLERK_PUBLISHABLE_KEY=pk_live_abc123...
   CLERK_SECRET_KEY=sk_live_xyz789...
   
   ❌ НЕПРАВИЛЬНО (несоответствие):
   VITE_CLERK_PUBLISHABLE_KEY=pk_live_abc123...
   CLERK_SECRET_KEY=sk_test_xyz789...  ← Это вызовет 401 ошибки!
   ```

4. Настройте OAuth провайдеры (опционально)
5. Добавьте callback URLs:
   - `https://your-domain.vercel.app`
   - `http://localhost:3000` (для разработки)

### 3. Настройка ЮKassa

1. Зарегистрируйтесь на [yookassa.ru](https://yookassa.ru)
2. Получите Shop ID и Secret Key
3. Добавьте в переменные окружения:
   - `YOOKASSA_SHOP_ID`
   - `YOOKASSA_SECRET_KEY`
4. Настройте webhook URL в личном кабинете ЮKassa:
   - `https://your-domain.vercel.app/api/payments/webhook`

### 4. Настройка CDN (опционально)

#### Вариант A: Vercel Blob Storage

1. В Vercel Dashboard → Storage → Create → Blob
2. Скопируйте `BLOB_READ_WRITE_TOKEN`
3. Установите `VITE_STORAGE_TYPE=vercel-blob`

#### Вариант B: Cloudflare R2

1. Создайте R2 bucket в Cloudflare
2. Получите credentials:
   - Account ID
   - Access Key ID
   - Secret Access Key
3. Настройте публичный доступ к bucket
4. Добавьте переменные окружения
5. Установите `VITE_STORAGE_TYPE=cloudflare-r2`

### 5. Настройка аналитики

#### Google Analytics 4

1. Создайте GA4 property
2. Получите Measurement ID (формат: `G-XXXXXXXXXX`)
3. Добавьте `VITE_GA_MEASUREMENT_ID`

#### Sentry

1. Создайте проект на [sentry.io](https://sentry.io)
2. Получите DSN
3. Добавьте `VITE_SENTRY_DSN`

### 6. Деплой на Vercel

```bash
# Установите Vercel CLI
npm i -g vercel

# Войдите в аккаунт
vercel login

# Деплой
vercel --prod
```

Или подключите репозиторий через веб-интерфейс Vercel.

### 7. Настройка переменных окружения в Vercel

Добавьте все переменные из `.env.example` в Vercel Dashboard:
- Settings → Environment Variables

**Обязательные переменные:**
- `POSTGRES_URL` - Connection string к базе данных
- `GEMINI_API_KEY` - API ключ Google Gemini
- `CLERK_SECRET_KEY` - **ОБЯЗАТЕЛЬНО для Clerk аутентификации!** Без него будет 401 Unauthorized
- `VITE_CLERK_PUBLISHABLE_KEY` - Publishable ключ Clerk (для клиента)

**Опциональные переменные:**
- `POSTGRES_URL_NON_POOLING` - Non-pooling URL (рекомендуется для Neon)
- `DB_INIT_SECRET` - Секретный ключ для ручной инициализации БД через API
- `ALLOWED_ORIGINS` - Разрешенные origins для CORS (опционально, в dev разрешены все)

**Важно:** 
- `VITE_*` переменные доступны на клиенте
- Остальные переменные доступны только на сервере
- `CLERK_SECRET_KEY` **критически важен** - без него Clerk токены не будут верифицироваться
- `DB_INIT_SECRET` должен быть надежным случайным значением

### 8. Проверка после деплоя

1. Проверьте работу аутентификации
2. Протестируйте создание генерации
3. Проверьте webhook ЮKassa (используйте test платежи)
4. Убедитесь, что аналитика работает
5. Проверьте мониторинг ошибок в Sentry

## Мониторинг и поддержка

### Логи

- Vercel Dashboard → Functions → Logs
- Sentry Dashboard для ошибок

### Метрики

- Vercel Analytics (встроено)
- Google Analytics 4
- Sentry Performance Monitoring

### База данных

- Vercel Dashboard → Storage → Postgres → Data
- Используйте SQL редактор для запросов

## Troubleshooting

### Проблемы с базой данных

**Ошибка "relation does not exist":**

Это означает, что схема базы данных не инициализирована. Решения:

1. **Автоматическая инициализация (для Neon):**
   - Просто выполните любой запрос к API - схема создастся автоматически
   - Или подождите несколько секунд после первого деплоя

2. **Ручная инициализация через API:**
   ```bash
   # Убедитесь, что DB_INIT_SECRET установлен в Vercel
   curl "https://your-domain.vercel.app/api/init-db?secret=YOUR_SECRET"
   ```

3. **Ручная инициализация через SQL:**
   ```bash
   # Проверьте подключение
   vercel env pull
   psql $POSTGRES_URL -c "SELECT 1"
   
   # Выполните схему
   psql $POSTGRES_URL -f database/schema.sql
   ```

**Проверка существования таблиц:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### Проблемы с Clerk

**Ошибка 401 Unauthorized после логина:**

1. **Проверьте наличие `CLERK_SECRET_KEY`:**
   - Убедитесь, что переменная установлена в Vercel Dashboard
   - Проверьте логи на наличие сообщения "CLERK_SECRET_KEY is missing"

2. **Проверьте соответствие Test/Live ключей:**
   - Если `VITE_CLERK_PUBLISHABLE_KEY` начинается с `pk_test_`, то `CLERK_SECRET_KEY` должен начинаться с `sk_test_`
   - Если `VITE_CLERK_PUBLISHABLE_KEY` начинается с `pk_live_`, то `CLERK_SECRET_KEY` должен начинаться с `sk_live_`
   - **Несоответствие ключей - самая частая причина 401 ошибок!**

3. **Проверьте логи в Vercel Dashboard:**
   - Ищите предупреждения "Clerk key mismatch detected"
   - Ищите ошибки "Token verification failed" с деталями

4. **Другие проверки:**
   - Проверьте callback URLs в настройках Clerk
   - Убедитесь, что `VITE_CLERK_PUBLISHABLE_KEY` установлен

### Проблемы с платежами

- Используйте test режим ЮKassa для проверки
- Проверьте webhook URL в настройках ЮKassa
- Проверьте логи в Vercel Functions

### Проблемы с CDN

- Убедитесь, что токены доступа правильные
- Проверьте права доступа к bucket/storage
- Проверьте CORS настройки (для R2)


