# Архитектура базы данных DreamLens AI

## Обзор

База данных DreamLens AI использует PostgreSQL через Vercel Postgres или Neon, оптимизирована для serverless окружения и автоматически инициализируется при первом запросе.

## Технологический стек

- **База данных**: PostgreSQL (через Vercel Postgres или Neon)
- **Клиент**: `@vercel/postgres` - serverless-оптимизированный клиент
- **Паттерн доступа**: Repository Pattern (слой репозиториев для работы с БД)

## Архитектура слоев

```
┌─────────────────────────────────────┐
│      API Endpoints                  │
│  /api/tokens, /api/user, etc.       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Services                       │
│  (бизнес-логика)                    │
│  - user.service.ts                   │
│  - token.service.ts                  │
│  - generation.service.ts             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Repositories                   │
│  (доступ к данным)                   │
│  - user.repository.ts                │
│  - token.repository.ts                │
│  - generation.repository.ts           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      database.ts                    │
│  - sql() функция                     │
│  - initDatabase()                    │
│  - Автоматическая инициализация      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      @vercel/postgres               │
│  (serverless клиент)                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL                     │
│  (Vercel Postgres / Neon)            │
└─────────────────────────────────────┘
```

## Механизмы работы БД

### 1. Автоматическая инициализация

**Файл**: `api/repositories/database.ts`

База данных инициализируется автоматически при первом запросе:

1. **Ленивая инициализация**: При ошибке "relation does not exist" автоматически вызывается `initDatabase()`
2. **Защита от race conditions**: Используется mutex для предотвращения параллельной инициализации
3. **Идемпотентность**: Безопасно вызывать несколько раз - проверяется наличие таблиц перед созданием

**Процесс инициализации**:

```typescript
// Функция sql() перехватывает ошибки
export async function sql<T>(...) {
  return withRetry(async () => {
    // Выполнение запроса
  }).catch(async (error) => {
    // Если ошибка "relation does not exist" и БД не инициализирована
    if (isRelationNotExistError(error) && !autoInitAttempted) {
      await initDatabase(); // Автоматическая инициализация
      // Повтор оригинального запроса
    }
  });
}
```

**Ручная инициализация** (опционально):

```bash
# Через API endpoint
curl "https://your-domain.vercel.app/api/init-db?secret=YOUR_SECRET"

# Или через SQL
psql $POSTGRES_URL -f database/schema.sql
```

### 2. Схема базы данных

#### Таблицы

- **`users`** - пользователи (поддержка Clerk ID и Device ID для анонимных пользователей)
- **`subscriptions`** - подписки пользователей (free, pro, premium)
- **`generations`** - сгенерированные изображения
- **`usage_logs`** - логи использования (генерации, скачивания) для rate limiting
- **`payments`** - платежи через ЮKassa
- **`user_tokens`** - баланс токенов пользователей
- **`token_transactions`** - история транзакций токенов (покупка, бонусы, расход)

#### Database Triggers

**`trigger_initialize_new_user`** - автоматически:
1. Создает запись в `user_tokens` при создании нового пользователя
2. Начисляет welcome bonus:
   - 10 токенов для пользователей с Clerk ID
   - 5 токенов для анонимных пользователей (device_id)

**Функция триггера**: `initialize_new_user()`

```sql
CREATE OR REPLACE FUNCTION initialize_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Создание записи токенов
  INSERT INTO user_tokens (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Начисление welcome bonus
  -- (логика в функции)
END;
$$ LANGUAGE plpgsql;
```

### 3. Паттерны работы с данными

#### Атомарные операции

**INSERT ... ON CONFLICT** - для предотвращения race conditions:

```typescript
// Пример из user.repository.ts
const result = await sql<User>`
  INSERT INTO users (clerk_id, device_id, email)
  VALUES (${clerkId}, ${deviceId}, ${email})
  ON CONFLICT (clerk_id) 
  DO UPDATE SET updated_at = NOW()
  RETURNING *
`;
```

**CTE (Common Table Expressions)** - для сложных атомарных операций:

```typescript
// Пример из token.repository.ts - обновление баланса и добавление транзакции
const result = await sql<{ new_balance: number }>`
  WITH updated_balance AS (
    UPDATE user_tokens
    SET balance = balance + ${amount}, updated_at = NOW()
    WHERE user_id = ${userId}
    RETURNING balance as new_balance
  ),
  inserted_transaction AS (
    INSERT INTO token_transactions (user_id, amount, type, description)
    SELECT ${userId}, ${amount}, ${type}, ${description}
    WHERE EXISTS (SELECT 1 FROM updated_balance)
    RETURNING id
  )
  SELECT new_balance FROM updated_balance
`;
```

#### Кэширование

**Файл**: `api/repositories/token.repository.ts`

- Баланс токенов кэшируется на 30 секунд
- Кэш инвалидируется при обновлении баланса
- Используется для снижения нагрузки на БД

```typescript
// Получение баланса с кэшированием
export async function getTokenBalance(userId: string) {
  const cache = getCache();
  const cacheKeyStr = cacheKey('token_balance', userId);
  
  const cached = cache.get<UserTokens | null>(cacheKeyStr);
  if (cached !== null) return cached;
  
  // Запрос к БД...
  // Кэширование результата на 30 секунд
  cache.set(cacheKeyStr, balance, 30000);
}
```

#### Retry механизм

**Файл**: `api/repositories/database.ts`

- Автоматический retry для сетевых ошибок (connection, timeout)
- Не ретраится для ошибок "relation does not exist" (обрабатывается отдельно)
- Максимум 3 попытки с экспоненциальной задержкой

```typescript
return withRetry(
  async () => {
    // Выполнение запроса
  },
  {
    maxAttempts: 3,
    initialDelayMs: 100,
    retryable: (error) => {
      // Retry только для сетевых ошибок
      return errorMessage.includes('connection') || 
             errorMessage.includes('timeout');
    }
  }
);
```

### 4. Безопасность и валидация

#### Валидация конфигурации

- Проверка наличия `POSTGRES_URL` или `DATABASE_URL` перед подключением
- Валидация при инициализации БД

```typescript
function validateDatabaseConfig(): void {
  const postgresUrl = process.env.POSTGRES_URL;
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!postgresUrl && !databaseUrl) {
    throw new Error('Database configuration missing');
  }
}
```

#### SQL Injection защита

- Использование template literals с параметризованными запросами через `sql` функцию
- Автоматическая сериализация значений через `serializeSqlValue()`

```typescript
// ✅ Правильно - параметризованный запрос
await sql`SELECT * FROM users WHERE id = ${userId}`;

// ❌ Неправильно - прямая конкатенация строк
await sql(`SELECT * FROM users WHERE id = '${userId}'`);
```

### 5. Мониторинг и метрики

**Метрики выполнения**:

- Трекинг времени выполнения запросов через `trackExecutionTime()`
- Логирование всех операций через `logger`

```typescript
export async function sql<T>(...) {
  return trackExecutionTime('db.query', async () => {
    // Выполнение запроса
  }, { operation: 'sql' });
}
```

## Рекомендации по использованию

### ✅ Правильно

1. **Использовать функцию `sql()` для всех запросов**:
   ```typescript
   const result = await sql<User>`SELECT * FROM users WHERE id = ${userId}`;
   ```

2. **Использовать атомарные операции**:
   - `INSERT ... ON CONFLICT` для get-or-create паттернов
   - CTE для сложных операций с несколькими шагами

3. **Инвалидировать кэш при изменениях**:
   ```typescript
   cache.delete(cacheKey('token_balance', userId));
   ```

4. **Использовать типизацию**:
   ```typescript
   const result = await sql<User>`SELECT * FROM users WHERE id = ${userId}`;
   // result.rows имеет тип User[]
   ```

### ❌ Неправильно

1. **Не использовать прямой `vercelSql`** (кроме `initDatabase()`)
   ```typescript
   // ❌ Неправильно
   import { sql as vercelSql } from '@vercel/postgres';
   await vercelSql`SELECT * FROM users`;
   
   // ✅ Правильно
   import { sql } from './database.js';
   await sql`SELECT * FROM users`;
   ```

2. **Не делать несколько отдельных запросов для атомарных операций**
   ```typescript
   // ❌ Неправильно - не атомарно
   await updateBalance(userId, newBalance);
   await addTransaction(userId, amount, type, description);
   
   // ✅ Правильно - атомарно через CTE
   await updateBalanceAndAddTransaction(userId, amount, type, description);
   ```

3. **Не забывать инвалидировать кэш при обновлениях**
   ```typescript
   // ❌ Неправильно - кэш не обновлен
   await updateBalance(userId, newBalance);
   
   // ✅ Правильно - кэш инвалидирован
   await updateBalance(userId, newBalance);
   cache.delete(cacheKey('token_balance', userId));
   ```

## Производительность

### Оптимизации

- **Индексы** на часто используемых полях:
  - `user_id` - для всех связанных таблиц
  - `clerk_id`, `device_id` - для быстрого поиска пользователей
  - `created_at` - для сортировки и фильтрации по дате
  - Частичные индексы для специфичных случаев (например, только активные подписки)

- **Кэширование** балансов токенов на 30 секунд

- **Connection pooling** через Vercel Postgres (автоматически)

### Мониторинг

- Отслеживание времени выполнения запросов
- Логирование медленных запросов (>100ms)
- Метрики через `trackExecutionTime()`

## Переменные окружения

**Обязательные**:
- `POSTGRES_URL` - Connection string к базе данных (pooling URL)
- `POSTGRES_URL_NON_POOLING` - Non-pooling URL (опционально, рекомендуется для Neon)

**Опциональные**:
- `DATABASE_URL` - Альтернатива POSTGRES_URL
- `DB_INIT_SECRET` - Секретный ключ для ручной инициализации БД через API

## Troubleshooting

### Ошибка "relation does not exist"

**Причина**: База данных не инициализирована

**Решение**:
1. Автоматическая инициализация произойдет при следующем запросе
2. Или вызовите `/api/init-db?secret=YOUR_SECRET`
3. Или выполните `psql $POSTGRES_URL -f database/schema.sql`

### Медленные запросы

**Причина**: Отсутствие индексов или неоптимальные запросы

**Решение**:
1. Проверьте наличие индексов на используемых полях
2. Используйте `EXPLAIN ANALYZE` для анализа запросов
3. Рассмотрите добавление составных индексов для частых запросов

### Проблемы с кэшем

**Причина**: Кэш не инвалидируется при обновлениях

**Решение**:
- Убедитесь, что все функции обновления данных инвалидируют соответствующий кэш
- Проверьте время жизни кэша (TTL)

## Связанные файлы

- `api/repositories/database.ts` - Основной файл работы с БД
- `api/repositories/user.repository.ts` - Репозиторий пользователей
- `api/repositories/token.repository.ts` - Репозиторий токенов
- `api/repositories/generation.repository.ts` - Репозиторий генераций
- `database/schema.sql` - SQL схема базы данных
- `api/init-db/index.ts` - API endpoint для ручной инициализации

