# Стратегия миграций базы данных

## Текущий подход

В настоящее время используется автоматическая инициализация через `CREATE TABLE IF NOT EXISTS` в функции `initDatabase()`. Это работает хорошо для начальной настройки, но не подходит для изменений существующей схемы.

## Рекомендуемая стратегия миграций

### 1. Версионирование схемы

**Добавить таблицу для отслеживания версий**:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW(),
  description TEXT
);
```

### 2. Структура миграций

**Рекомендуемая структура папок**:

```
database/
  ├── schema.sql              # Текущая полная схема
  ├── migrations/
  │   ├── 001_initial_schema.sql
  │   ├── 002_add_user_preferences.sql
  │   ├── 003_add_generation_metadata.sql
  │   └── ...
  └── MIGRATIONS.md           # Этот файл
```

### 3. Формат миграций

**Именование**: `{номер}_{описание}.sql`

**Пример миграции**:

```sql
-- Migration: 002_add_user_preferences
-- Description: Добавляет таблицу user_preferences для хранения настроек пользователей
-- Date: 2024-01-15

-- Создание таблицы
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preference_key VARCHAR(100) NOT NULL,
  preference_value TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT user_preferences_user_key_unique UNIQUE (user_id, preference_key)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id 
  ON user_preferences(user_id);

-- Обновление версии схемы
INSERT INTO schema_migrations (version, description)
VALUES ('002', 'Add user_preferences table')
ON CONFLICT (version) DO NOTHING;
```

### 4. Механизм применения миграций

**Вариант A: API Endpoint (рекомендуется для serverless)**

Создать `/api/migrate` endpoint:

```typescript
// api/migrate/index.ts
import { sql } from '../repositories/database.js';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

export default async function handler(req, res) {
  // Проверка секрета
  const secret = req.query.secret || req.headers['x-migration-secret'];
  if (secret !== process.env.DB_MIGRATION_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Получение списка миграций
  const migrationsDir = join(process.cwd(), 'database', 'migrations');
  const files = await readdir(migrationsDir);
  const migrationFiles = files
    .filter(f => f.endsWith('.sql'))
    .sort();

  // Проверка примененных миграций
  const applied = await sql<{ version: string }>`
    SELECT version FROM schema_migrations
  `;
  const appliedVersions = new Set(applied.rows.map(r => r.version));

  // Применение новых миграций
  const results = [];
  for (const file of migrationFiles) {
    const version = file.split('_')[0];
    if (appliedVersions.has(version)) {
      continue; // Уже применена
    }

    const migrationSQL = await readFile(
      join(migrationsDir, file),
      'utf-8'
    );

    try {
      await sql.unsafe(migrationSQL);
      results.push({ version, file, status: 'applied' });
    } catch (error) {
      results.push({ version, file, status: 'failed', error: error.message });
      break; // Останавливаемся при ошибке
    }
  }

  return res.json({ results });
}
```

**Вариант B: CLI скрипт**

```typescript
// scripts/migrate.ts
import { sql } from '../api/repositories/database.js';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

async function migrate() {
  const migrationsDir = join(process.cwd(), 'database', 'migrations');
  const files = await readdir(migrationsDir);
  // ... аналогичная логика
}

migrate().catch(console.error);
```

### 5. Обратные миграции (Rollback)

**Рекомендация**: Для serverless окружения rollback миграции не критичны, так как:
- Можно создать новую миграцию для отката изменений
- Vercel позволяет откатить деплой к предыдущей версии

**Если нужны rollback миграции**:

```
database/
  migrations/
    ├── 002_add_user_preferences.sql
    ├── 002_add_user_preferences.rollback.sql
    └── ...
```

### 6. Best Practices

#### ✅ Делать

1. **Идемпотентность**: Все миграции должны быть безопасны для повторного выполнения
   ```sql
   CREATE TABLE IF NOT EXISTS ...
   CREATE INDEX IF NOT EXISTS ...
   ```

2. **Транзакции**: Обертывать миграции в транзакции (если возможно)
   ```sql
   BEGIN;
   -- миграция
   COMMIT;
   ```

3. **Версионирование**: Всегда обновлять `schema_migrations` после применения

4. **Тестирование**: Тестировать миграции на dev окружении перед продакшеном

5. **Резервное копирование**: Делать backup перед применением миграций в продакшене

#### ❌ Не делать

1. **Не удалять данные без необходимости**
   ```sql
   -- ❌ Опасно
   DELETE FROM users WHERE ...
   
   -- ✅ Безопаснее
   ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;
   UPDATE users SET deleted_at = NOW() WHERE ...;
   ```

2. **Не делать breaking changes без предупреждения**
   - Сначала добавить новое поле
   - Мигрировать данные
   - Потом удалить старое поле (в отдельной миграции)

3. **Не применять миграции напрямую в продакшене**
   - Всегда через API endpoint или CI/CD pipeline

### 7. Интеграция с текущей системой

**Обновление `initDatabase()`**:

```typescript
export async function initDatabase(): Promise<void> {
  // ... существующая логика создания таблиц ...
  
  // Создание таблицы для миграций
  await vercelSql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW(),
      description TEXT
    );
  `;
  
  // Применение миграций (если есть)
  await applyMigrations();
}
```

**Функция применения миграций**:

```typescript
async function applyMigrations(): Promise<void> {
  // Логика применения миграций из папки migrations/
  // (аналогично примеру выше)
}
```

### 8. Автоматизация через CI/CD

**GitHub Actions пример**:

```yaml
name: Database Migrations

on:
  push:
    branches: [main]
    paths:
      - 'database/migrations/**'

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Apply migrations
        run: |
          curl -X GET \
            "https://your-domain.vercel.app/api/migrate?secret=${{ secrets.DB_MIGRATION_SECRET }}"
```

## План внедрения

### Этап 1: Подготовка (текущий)

- [x] Документирование текущей схемы
- [x] Создание стратегии миграций
- [ ] Создание таблицы `schema_migrations`

### Этап 2: Базовая инфраструктура

- [ ] Создание папки `database/migrations/`
- [ ] Создание API endpoint `/api/migrate`
- [ ] Обновление `initDatabase()` для поддержки миграций
- [ ] Тестирование на dev окружении

### Этап 3: Первая миграция

- [ ] Создание миграции для существующей схемы (001_initial_schema.sql)
- [ ] Применение миграции
- [ ] Проверка работоспособности

### Этап 4: Автоматизация

- [ ] Настройка CI/CD для автоматического применения миграций
- [ ] Документирование процесса для команды
- [ ] Создание скриптов для разработчиков

## Альтернативные подходы

### Использование готовых инструментов

**Prisma Migrate**:
- Полнофункциональная система миграций
- Требует изменения на Prisma ORM
- Избыточно для текущего проекта

**Knex.js Migrations**:
- Легковесный подход
- Требует установки дополнительной зависимости
- Хорошо подходит для SQL-first подхода

**Рекомендация**: Для текущего проекта лучше использовать собственный подход, так как:
- Минимальные изменения в существующем коде
- Полный контроль над процессом
- Простота для serverless окружения

## Заключение

Текущая система автоматической инициализации хорошо работает для начальной настройки. Для будущих изменений схемы рекомендуется внедрить систему миграций с версионированием. Это обеспечит:

- Контролируемые изменения схемы
- Возможность отслеживания примененных изменений
- Безопасность при обновлениях
- Простоту отката при необходимости

