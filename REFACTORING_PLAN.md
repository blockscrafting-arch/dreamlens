# План полной перестройки системы аутентификации и токенов

## Проблемы текущей архитектуры

### 1. Race Conditions
- Двойная проверка в `getOrCreateUserByDeviceId` не защищает от race conditions
- Два одновременных запроса могут создать дубликаты пользователей
- Нет использования `INSERT ... ON CONFLICT` для атомарности

### 2. Дублирование логики
- Welcome bonus логика разбросана по 3 местам:
  - `user.service.ts` - при создании пользователя
  - `token.service.ts` - в `getTokenInfo`
  - `user.service.ts` - в `ensureWelcomeBonus`
- Каждое место делает свои проверки и создает свои проблемы

### 3. Неатомарные операции
- Создание пользователя и токенов - это 2 отдельные операции
- Если создание токенов падает, пользователь остается без токенов
- Нет гарантии целостности данных

### 4. Сложная инициализация
- `getTokenInfo` делает слишком много проверок
- Логика инициализации токенов дублируется
- Нет единой точки инициализации

### 5. Нет единой точки входа
- Каждый endpoint делает свою логику аутентификации
- Нет middleware для аутентификации
- Сложно отслеживать проблемы

## Новая архитектура

### Принципы
1. **Database-first подход** - использовать constraints и triggers для гарантии целостности
2. **Атомарность на уровне БД** - все операции через `INSERT ... ON CONFLICT` или CTE
3. **Единая точка входа** - один сервис для аутентификации и получения пользователя
4. **Автоматическая инициализация** - токены создаются автоматически через trigger
5. **Упрощенная логика** - минимум проверок, максимум надежности

### Архитектурная диаграмма

```
┌─────────────────────────────────────────────────────────────┐
│                    API Endpoints                            │
│  /api/tokens, /api/user, /api/generate, etc.                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Auth Middleware / Service                       │
│  - verifyAuth() - проверка токена/device ID                 │
│  - getOrCreateUser() - единая точка получения пользователя  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              User Service (упрощенный)                       │
│  - getOrCreateUserByAuth() - атомарное создание             │
│  - использует INSERT ... ON CONFLICT                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Database Layer                                  │
│  - Users table (UNIQUE constraints)                         │
│  - User_tokens table (UNIQUE constraint)                    │
│  - Trigger: auto-create tokens on user insert              │
│  - Trigger: auto-give welcome bonus on user insert         │
└─────────────────────────────────────────────────────────────┘
```

## План реализации

### Этап 1: Database Triggers (основа)

**Цель**: Автоматическая инициализация токенов и welcome bonus на уровне БД

**Файлы для изменения**:
- `api/repositories/database.ts` - добавить функции и триггеры

**Изменения**:
1. Создать PostgreSQL функцию для автоматического создания токенов
2. Создать PostgreSQL функцию для автоматического выдачи welcome bonus
3. Создать триггеры, которые вызывают эти функции при создании пользователя

**Преимущества**:
- Гарантированная атомарность
- Невозможно создать пользователя без токенов
- Невозможно забыть выдать welcome bonus

### Этап 2: Атомарное создание пользователей

**Цель**: Использовать `INSERT ... ON CONFLICT` для предотвращения race conditions

**Файлы для изменения**:
- `api/repositories/user.repository.ts` - добавить `getOrCreateUser`
- `api/services/user.service.ts` - упростить логику

**Изменения**:
1. Создать функцию `getOrCreateUser` которая использует `INSERT ... ON CONFLICT DO NOTHING RETURNING`
2. Если пользователь уже существует, просто вернуть его
3. Убрать двойную проверку

**Преимущества**:
- Нет race conditions
- Меньше запросов к БД
- Проще код

### Этап 3: Единый сервис аутентификации

**Цель**: Один сервис для всех операций с пользователями

**Файлы для изменения**:
- `api/services/auth.service.ts` - новый файл
- `api/tokens/index.ts` - использовать новый сервис
- `api/user/index.ts` - использовать новый сервис
- Все другие endpoints

**Изменения**:
1. Создать `AuthService.getOrCreateUser(authResult)` - единая точка входа
2. Этот сервис использует `UserRepo.getOrCreateUser`
3. Все endpoints используют этот сервис

**Преимущества**:
- Единая точка входа
- Легче отлаживать
- Легче тестировать

### Этап 4: Упрощение Token Service

**Цель**: Убрать сложную логику инициализации из `getTokenInfo`

**Файлы для изменения**:
- `api/services/token.service.ts` - упростить `getTokenInfo`
- `api/repositories/token.repository.ts` - добавить `getOrCreateTokenBalance`

**Изменения**:
1. `getTokenInfo` просто получает токены (они уже должны существовать благодаря trigger)
2. Если токенов нет (старые пользователи), использовать `getOrCreateTokenBalance` с `INSERT ... ON CONFLICT`
3. Убрать всю логику welcome bonus из `getTokenInfo`

**Преимущества**:
- Проще код
- Меньше проверок
- Быстрее выполнение

### Этап 5: Удаление дублирования

**Цель**: Убрать `ensureWelcomeBonus` и всю дублирующуюся логику

**Файлы для изменения**:
- `api/services/user.service.ts` - удалить `ensureWelcomeBonus`
- `api/services/token.service.ts` - удалить логику welcome bonus

**Изменения**:
1. Удалить `ensureWelcomeBonus` - теперь это делает trigger
2. Удалить проверки welcome bonus из `getTokenInfo`
3. Удалить создание токенов из `getOrCreateUserByDeviceId` и `getOrCreateUserByClerkId`

**Преимущества**:
- Нет дублирования
- Меньше кода
- Меньше багов

## Детальный план реализации

### Шаг 1: Создать database functions и triggers

**Файл**: `api/repositories/database.ts`

Добавить в `initDatabase()`:

```sql
-- Function to auto-create tokens when user is created
CREATE OR REPLACE FUNCTION create_user_tokens()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_tokens (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create tokens
CREATE TRIGGER trigger_create_user_tokens
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_tokens();

-- Function to give welcome bonus
CREATE OR REPLACE FUNCTION give_welcome_bonus()
RETURNS TRIGGER AS $$
DECLARE
  bonus_amount INTEGER;
  bonus_description TEXT;
BEGIN
  -- Determine bonus based on user type
  IF NEW.clerk_id IS NOT NULL THEN
    bonus_amount := 10;
    bonus_description := 'Welcome bonus';
  ELSIF NEW.device_id IS NOT NULL THEN
    bonus_amount := 5;
    bonus_description := 'Welcome Pack (anonymous)';
  ELSE
    RETURN NEW; -- Should not happen due to constraint
  END IF;

  -- Check if bonus already given (for existing users)
  IF NOT EXISTS (
    SELECT 1 FROM token_transactions
    WHERE user_id = NEW.id
      AND type = 'bonus'
      AND description = bonus_description
  ) THEN
    -- Update balance and add transaction atomically
    UPDATE user_tokens
    SET balance = balance + bonus_amount, updated_at = NOW()
    WHERE user_id = NEW.id;

    INSERT INTO token_transactions (user_id, amount, type, description)
    VALUES (NEW.id, bonus_amount, 'bonus', bonus_description);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to give welcome bonus
CREATE TRIGGER trigger_give_welcome_bonus
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION give_welcome_bonus();
```

### Шаг 2: Создать атомарную функцию getOrCreateUser

**Файл**: `api/repositories/user.repository.ts`

Добавить:

```typescript
/**
 * Get or create user atomically using INSERT ... ON CONFLICT
 * This prevents race conditions - if user exists, return it; if not, create it
 */
export async function getOrCreateUser(userData: CreateUserData): Promise<User> {
  // Try to find existing user first
  if (userData.clerk_id) {
    const existing = await findByClerkId(userData.clerk_id);
    if (existing) return existing;
  }
  if (userData.device_id) {
    const existing = await findByDeviceId(userData.device_id);
    if (existing) return existing;
  }

  // Try to insert - if conflict, get existing user
  try {
    const result = await sql<User>`
      INSERT INTO users (clerk_id, device_id, email)
      VALUES (${userData.clerk_id || null}, ${userData.device_id || null}, ${userData.email || null})
      ON CONFLICT (clerk_id) WHERE clerk_id IS NOT NULL
      DO UPDATE SET updated_at = NOW()
      RETURNING *
    `;
    if (result.rows.length > 0) return result.rows[0];
  } catch (error) {
    // If clerk_id conflict, try to get existing
    if (userData.clerk_id) {
      const existing = await findByClerkId(userData.clerk_id);
      if (existing) return existing;
    }
  }

  try {
    const result = await sql<User>`
      INSERT INTO users (clerk_id, device_id, email)
      VALUES (${userData.clerk_id || null}, ${userData.device_id || null}, ${userData.email || null})
      ON CONFLICT (device_id) WHERE device_id IS NOT NULL
      DO UPDATE SET updated_at = NOW()
      RETURNING *
    `;
    if (result.rows.length > 0) return result.rows[0];
  } catch (error) {
    // If device_id conflict, try to get existing
    if (userData.device_id) {
      const existing = await findByDeviceId(userData.device_id);
      if (existing) return existing;
    }
  }

  // If we get here, something went wrong
  throw new Error('Failed to create or get user');
}
```

### Шаг 3: Создать единый Auth Service

**Файл**: `api/services/auth.service.ts` (новый)

```typescript
/**
 * Unified Authentication Service
 * Single point of entry for all user authentication and creation
 */

import { verifyAuth, AuthResult } from '../utils/auth.js';
import * as UserRepo from '../repositories/user.repository.js';
import { logger } from '../utils/logger.js';

export interface AuthenticatedUser {
  user: UserRepo.User;
  authType: 'clerk' | 'device';
}

/**
 * Get or create user from authentication result
 * This is the single point of entry for all user operations
 */
export async function getOrCreateUserFromAuth(
  authResult: AuthResult
): Promise<AuthenticatedUser> {
  if (!authResult.isAuthenticated || !authResult.userId) {
    throw new Error('User not authenticated');
  }

  try {
    let user: UserRepo.User;

    if (authResult.authType === 'clerk') {
      user = await UserRepo.getOrCreateUser({
        clerk_id: authResult.userId,
      });
    } else if (authResult.authType === 'device') {
      user = await UserRepo.getOrCreateUser({
        device_id: authResult.userId,
      });
    } else {
      throw new Error('Invalid auth type');
    }

    // Tokens and welcome bonus are automatically created by database triggers
    // No need to check or create them here

    return {
      user,
      authType: authResult.authType!,
    };
  } catch (error) {
    logger.logApiError('AuthService - getOrCreateUserFromAuth', 
      error instanceof Error ? error : new Error(String(error)), {
      authType: authResult.authType,
      userId: authResult.userId?.substring(0, 8) + '...',
    });
    throw error;
  }
}

/**
 * Middleware helper: Get authenticated user from request
 */
export async function getAuthenticatedUser(
  request: VercelRequest
): Promise<AuthenticatedUser> {
  const authResult = await verifyAuth(request as any);
  return getOrCreateUserFromAuth(authResult);
}
```

### Шаг 4: Упростить Token Service

**Файл**: `api/services/token.service.ts`

Упростить `getTokenInfo`:

```typescript
export async function getTokenInfo(userId: string): Promise<{ balance: number; lastBonusDate: string | null }> {
  try {
    // Tokens should always exist due to database trigger
    // But for backward compatibility with old users, use getOrCreate
    let tokens = await TokenRepo.getTokenBalance(userId);
    
    if (!tokens) {
      // For old users without tokens (shouldn't happen with new trigger)
      tokens = await TokenRepo.getOrCreateTokenBalance(userId);
    }

    return {
      balance: tokens.balance,
      lastBonusDate: tokens.last_bonus_date ? tokens.last_bonus_date.toISOString().split('T')[0] : null,
    };
  } catch (error) {
    logger.logApiError('TokenService - getTokenInfo', error instanceof Error ? error : new Error(String(error)), {
      userId: userId?.substring(0, 8) + '...',
    });
    throw error;
  }
}
```

Добавить в `api/repositories/token.repository.ts`:

```typescript
export async function getOrCreateTokenBalance(userId: string): Promise<UserTokens> {
  const result = await sql<UserTokens>`
    INSERT INTO user_tokens (user_id, balance)
    VALUES (${userId}, 0)
    ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
    RETURNING *
  `;
  return result.rows[0];
}
```

### Шаг 5: Обновить все endpoints

**Файлы**: `api/tokens/index.ts`, `api/user/index.ts`, и все другие

Заменить:
```typescript
const auth = await verifyAuth(request as any);
if (!auth.isAuthenticated || !auth.userId) {
  return response.status(401).json(unauthorizedResponse());
}

let user;
try {
  user = auth.authType === 'device' 
    ? await UserService.getOrCreateUserByDeviceId(auth.userId)
    : await UserService.getOrCreateUserByClerkId(auth.userId);
} catch (error) {
  // ...
}
```

На:
```typescript
let authenticatedUser;
try {
  authenticatedUser = await AuthService.getAuthenticatedUser(request);
} catch (error) {
  return response.status(401).json(unauthorizedResponse());
}

const { user } = authenticatedUser;
```

### Шаг 6: Удалить старый код

**Файлы для очистки**:
- `api/services/user.service.ts` - удалить `ensureWelcomeBonus`, упростить `getOrCreateUserByDeviceId` и `getOrCreateUserByClerkId`
- `api/services/token.service.ts` - удалить логику welcome bonus из `getTokenInfo`

## Миграция существующих данных

### Проблема
Старые пользователи могут не иметь токенов или welcome bonus

### Решение
Создать миграционный скрипт:

```sql
-- Create tokens for users without them
INSERT INTO user_tokens (user_id, balance)
SELECT id, 0
FROM users
WHERE id NOT IN (SELECT user_id FROM user_tokens)
ON CONFLICT (user_id) DO NOTHING;

-- Give welcome bonus to users who didn't receive it
INSERT INTO token_transactions (user_id, amount, type, description)
SELECT 
  u.id,
  CASE 
    WHEN u.clerk_id IS NOT NULL THEN 10
    WHEN u.device_id IS NOT NULL THEN 5
    ELSE 0
  END,
  'bonus',
  CASE 
    WHEN u.clerk_id IS NOT NULL THEN 'Welcome bonus'
    WHEN u.device_id IS NOT NULL THEN 'Welcome Pack (anonymous)'
  END
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM token_transactions t
  WHERE t.user_id = u.id
    AND t.type = 'bonus'
    AND (
      (u.clerk_id IS NOT NULL AND t.description = 'Welcome bonus')
      OR (u.device_id IS NOT NULL AND t.description = 'Welcome Pack (anonymous)')
    )
);

-- Update balances
UPDATE user_tokens ut
SET balance = balance + (
  SELECT COALESCE(SUM(amount), 0)
  FROM token_transactions
  WHERE user_id = ut.user_id
    AND type = 'bonus'
    AND description IN ('Welcome bonus', 'Welcome Pack (anonymous)')
);
```

## Преимущества новой архитектуры

1. **Нет race conditions** - `INSERT ... ON CONFLICT` гарантирует атомарность
2. **Нет дублирования** - логика welcome bonus только в trigger
3. **Атомарность** - создание пользователя и токенов в одной транзакции (trigger)
4. **Простота** - меньше кода, меньше проверок
5. **Надежность** - невозможно создать пользователя без токенов
6. **Единая точка входа** - все через `AuthService.getAuthenticatedUser`

## ⚠️ КРИТИЧЕСКИЕ ПРОБЛЕМЫ И ИСПРАВЛЕНИЯ

### Проблема 1: Порядок выполнения triggers
**Проблема**: Оба trigger выполняются AFTER INSERT, порядок не гарантирован. Welcome bonus trigger может выполниться ДО создания токенов.

**Исправление**: Объединить в один trigger или использовать правильный порядок:
```sql
-- Один trigger который делает все
CREATE OR REPLACE FUNCTION initialize_new_user()
RETURNS TRIGGER AS $$
DECLARE
  bonus_amount INTEGER;
  bonus_description TEXT;
BEGIN
  -- 1. Создать токены
  INSERT INTO user_tokens (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- 2. Определить bonus
  IF NEW.clerk_id IS NOT NULL THEN
    bonus_amount := 10;
    bonus_description := 'Welcome bonus';
  ELSIF NEW.device_id IS NOT NULL THEN
    bonus_amount := 5;
    bonus_description := 'Welcome Pack (anonymous)';
  ELSE
    RETURN NEW;
  END IF;

  -- 3. Выдать bonus (только если еще не выдан)
  IF NOT EXISTS (
    SELECT 1 FROM token_transactions
    WHERE user_id = NEW.id
      AND type = 'bonus'
      AND description = bonus_description
  ) THEN
    UPDATE user_tokens
    SET balance = balance + bonus_amount, updated_at = NOW()
    WHERE user_id = NEW.id;

    INSERT INTO token_transactions (user_id, amount, type, description)
    VALUES (NEW.id, bonus_amount, 'bonus', bonus_description);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_initialize_new_user
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_new_user();
```

### Проблема 2: getOrCreateUser с двумя INSERT
**Проблема**: Код в плане использует два отдельных INSERT с try-catch - это не атомарно и не правильно.

**Исправление**: Один запрос с правильным ON CONFLICT:
```typescript
export async function getOrCreateUser(userData: CreateUserData): Promise<User> {
  // Используем один запрос с правильной обработкой конфликтов
  const result = await sql<User>`
    INSERT INTO users (clerk_id, device_id, email)
    VALUES (${userData.clerk_id || null}, ${userData.device_id || null}, ${userData.email || null})
    ON CONFLICT (clerk_id) WHERE clerk_id IS NOT NULL
    DO UPDATE SET updated_at = NOW()
    RETURNING *
  `;
  
  if (result.rows.length > 0) {
    return result.rows[0];
  }

  // Если clerk_id конфликт не сработал, пробуем device_id
  const result2 = await sql<User>`
    INSERT INTO users (clerk_id, device_id, email)
    VALUES (${userData.clerk_id || null}, ${userData.device_id || null}, ${userData.email || null})
    ON CONFLICT (device_id) WHERE device_id IS NOT NULL
    DO UPDATE SET updated_at = NOW()
    RETURNING *
  `;
  
  if (result2.rows.length > 0) {
    return result2.rows[0];
  }

  // Если оба конфликта не сработали, пользователь должен существовать
  // Пробуем найти его
  if (userData.clerk_id) {
    const existing = await findByClerkId(userData.clerk_id);
    if (existing) return existing;
  }
  if (userData.device_id) {
    const existing = await findByDeviceId(userData.device_id);
    if (existing) return existing;
  }

  throw new Error('Failed to create or get user');
}
```

### Проблема 3: Миграция должна быть ДО создания triggers
**Проблема**: Если запустить triggers до миграции, старые пользователи не получат токены.

**Исправление**: Изменить порядок:
1. Сначала запустить миграцию для существующих пользователей
2. Потом создать triggers (они будут работать только для новых пользователей)

### Проблема 4: Обратная совместимость со старыми пользователями
**Проблема**: Старые пользователи могут не иметь токенов, trigger не сработает для них.

**Исправление**: В `getTokenInfo` оставить fallback для старых пользователей:
```typescript
export async function getTokenInfo(userId: string): Promise<{ balance: number; lastBonusDate: string | null }> {
  let tokens = await TokenRepo.getTokenBalance(userId);
  
  if (!tokens) {
    // Для старых пользователей без токенов (до миграции)
    tokens = await TokenRepo.getOrCreateTokenBalance(userId);
    
    // Проверить и выдать welcome bonus если нужно
    const user = await UserRepo.findById(userId);
    if (user) {
      // Логика для старых пользователей...
    }
  }
  
  return {
    balance: tokens.balance,
    lastBonusDate: tokens.last_bonus_date ? tokens.last_bonus_date.toISOString().split('T')[0] : null,
  };
}
```

## Риски и митигация

### Риск 1: Проблемы с triggers в serverless
**Митигация**: ✅ Triggers работают на уровне БД, не зависят от serverless окружения. В проекте уже используются triggers (update_updated_at_column).

### Риск 2: Старые пользователи без токенов
**Митигация**: ✅ Миграционный скрипт создаст токены для всех существующих пользователей ДО создания triggers. Fallback в `getTokenInfo` для старых пользователей.

### Риск 3: Двойной welcome bonus
**Митигация**: ✅ Trigger проверяет существование транзакции перед выдачей. ON CONFLICT в миграции предотвращает дубликаты.

### Риск 4: Порядок выполнения triggers
**Митигация**: ✅ Используем один trigger вместо двух, гарантируя правильный порядок операций.

## Порядок выполнения (ИСПРАВЛЕННЫЙ)

1. **Сначала миграция** - создать токены для существующих пользователей
2. **Потом triggers** - создать database functions и triggers
3. Создать `getOrCreateUser` в user.repository (с исправленным кодом)
4. Создать AuthService
5. Обновить один endpoint для тестирования
6. **Тщательно протестировать**:
   - Создание нового пользователя (device ID)
   - Создание нового пользователя (Clerk)
   - Получение существующего пользователя
   - Проверка токенов и welcome bonus
   - Race conditions (параллельные запросы)
7. Обновить все остальные endpoints
8. Удалить старый код

## ✅ Чеклист проверки работоспособности

### Перед деплоем проверить:

- [ ] **Triggers работают**: Создать тестового пользователя, проверить что токены созданы автоматически
- [ ] **Welcome bonus выдается**: Проверить что новый пользователь получает правильный bonus (10 для Clerk, 5 для device)
- [ ] **Нет дубликатов**: Создать пользователя дважды параллельно - должен быть один пользователь
- [ ] **Старые пользователи работают**: Проверить что существующие пользователи могут получить токены
- [ ] **Миграция выполнена**: Все существующие пользователи имеют токены
- [ ] **Нет двойного bonus**: Проверить что welcome bonus выдается только один раз
- [ ] **Все endpoints работают**: `/api/tokens`, `/api/user`, `/api/generate` и т.д.
- [ ] **Обработка ошибок**: Проверить что ошибки обрабатываются корректно
- [ ] **Логирование**: Проверить что все операции логируются

### Потенциальные проблемы и решения:

1. **Если trigger не создается**: Проверить права доступа к БД, использовать `CREATE OR REPLACE FUNCTION`
2. **Если токены не создаются**: Проверить что trigger выполняется, проверить логи БД
3. **Если welcome bonus не выдается**: Проверить логику в trigger, проверить что транзакция создается
4. **Если race condition все еще есть**: Проверить что `ON CONFLICT` работает правильно
5. **Если старые пользователи не работают**: Запустить миграцию вручную, проверить fallback в `getTokenInfo`

## Оценка времени

- Этап 1 (Database triggers): 1-2 часа
- Этап 2 (Атомарное создание): 1 час
- Этап 3 (Auth Service): 1-2 часа
- Этап 4 (Упрощение Token Service): 1 час
- Этап 5 (Обновление endpoints): 2-3 часа
- Этап 6 (Удаление старого кода): 1 час
- Тестирование: 2-3 часа

**Итого**: 9-13 часов работы

