# DreamLens AI — Руководство для разработчиков

## Быстрый старт

### Требования

- Node.js 20+
- npm 9+
- PostgreSQL (локально или Neon)
- Gemini API ключ

### Установка

```bash
# 1. Клонируйте репозиторий
git clone <repo-url>
cd dreamlens-ai

# 2. Установите зависимости
npm install --legacy-peer-deps

# 3. Создайте .env.local
cp .env.example .env.local

# 4. Заполните переменные окружения
# DATABASE_URL=postgresql://...
# GEMINI_API_KEY=AIzaSy...

# 5. Запустите базу данных (если локально)
npm run db:push

# 6. Запустите dev сервер
npm run dev
```

Приложение будет доступно на `http://localhost:5173` (Vite) и API на `http://localhost:3000`.

---

## Структура команд

### Разработка

```bash
npm run dev          # Запуск Vite dev server
npm start            # Запуск production server
```

### Сборка

```bash
npm run build        # Полная сборка (client + server)
npm run build:server # Только сборка сервера
```

### Качество кода

```bash
npm run lint         # Проверка ESLint
npm run lint:fix     # Автоисправление ESLint
npm run format       # Форматирование Prettier
npm run format:check # Проверка форматирования
npm run type-check   # Проверка типов TypeScript
```

### Тестирование

```bash
npm test             # Запуск тестов (Vitest)
npm run test:ui      # Тесты с UI
npm run test:coverage # Покрытие кода
npm run test:e2e     # E2E тесты (Playwright)
npm run test:e2e:ui  # E2E с UI
```

### База данных

```bash
npm run db:generate  # Генерация миграций
npm run db:migrate   # Применение миграций
npm run db:push      # Push схемы в БД
npm run db:studio    # Drizzle Studio (GUI)
```

---

## Архитектура проекта

### Frontend (React)

```
src/
├── App.tsx              # Главный компонент
├── components/          # Компоненты
│   ├── wizard/         # Шаги генерации
│   ├── telegram/       # Telegram-специфичные
│   ├── tokens/         # Токены и бонусы
│   └── ui/             # Переиспользуемые
├── context/            # React Context
├── hooks/              # Кастомные хуки
├── lib/                # Утилиты клиента
└── types.ts            # Типы
```

### Backend (Express + Vercel)

```
api/
├── generate/           # Генерация изображений
├── tokens/             # Управление токенами
├── user/               # Профиль пользователя
├── payments/           # Платежи
├── services/           # Бизнес-логика
├── repositories/       # Доступ к данным
└── utils/              # Утилиты
```

---

## Добавление нового стиля (Trend)

### 1. Добавьте тип в enum

```typescript
// types.ts
export enum TrendType {
  // ... существующие
  NEW_STYLE = 'NEW_STYLE',
}
```

### 2. Создайте промпт

```typescript
// prompts/trendPrompts.ts
case TrendType.NEW_STYLE:
  trendSystem = `${baseInstruction}
BRIEF: Описание стиля для AI
PHOTOGRAPHER REFERENCE: Референсы фотографов`;
  specificPrompt = `
CONCEPT: "Название концепции" - Описание

STYLING:
- Garment: Описание одежды
- Accessories: Аксессуары

LIGHTING SETUP:
- Key: Основной свет
- Fill: Заполняющий свет

COMPOSITION:
- Framing: Кадрирование
- Pose: Поза
- Expression: Выражение

MOOD: Настроение
${colorInstruction}`;
  break;
```

### 3. Добавьте UI

```typescript
// components/wizard/TrendStep.tsx
const trends = [
  // ... существующие
  {
    type: TrendType.NEW_STYLE,
    name: 'Новый Стиль',
    description: 'Описание для пользователя',
    icon: '✨',
    category: 'Категория',
  },
];
```

---

## Добавление нового API эндпоинта

### 1. Создайте файл хендлера

```typescript
// api/example/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as AuthService from '../services/auth.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { setCorsHeaders } from '../utils/cors.js';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const requestOrigin = request.headers.origin as string | undefined;
  setCorsHeaders(response, requestOrigin);

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  try {
    // Authenticate
    const { user } = await AuthService.getAuthenticatedUser(request);

    if (request.method === 'GET') {
      // Handle GET
      return response.status(200).json(
        successResponse({ data: 'example' }, undefined, requestOrigin)
      );
    }

    return response.status(405).json(
      errorResponse('Method not allowed', 405, undefined, requestOrigin)
    );
  } catch (error) {
    return response.status(500).json(
      errorResponse('Internal error', 500, undefined, requestOrigin)
    );
  }
}
```

### 2. Добавьте роут в server.ts

```typescript
// server.ts
import exampleHandler from './api/example/index.js';

app.all('/api/example', adaptHandler(exampleHandler));
```

### 3. Добавьте в Vercel конфиг (если используется)

```json
// vercel.json
{
  "routes": [
    { "src": "/api/example", "dest": "/api/example/index.ts" }
  ]
}
```

---

## Работа с базой данных

### Добавление таблицы

```typescript
// api/db/schema.ts
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const examples = pgTable('examples', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Генерация и применение миграций

```bash
# Генерация миграции
npm run db:generate

# Применение миграции
npm run db:migrate

# Или напрямую в dev
npm run db:push
```

### Создание репозитория

```typescript
// api/repositories/example.repository.ts
import { sql } from './database.js';

export interface Example {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
}

export async function create(data: Omit<Example, 'id' | 'createdAt'>): Promise<Example> {
  const result = await sql<Example>`
    INSERT INTO examples (user_id, name)
    VALUES (${data.userId}, ${data.name})
    RETURNING *
  `;
  return result.rows[0];
}

export async function findByUserId(userId: string): Promise<Example[]> {
  const result = await sql<Example>`
    SELECT * FROM examples WHERE user_id = ${userId}
  `;
  return result.rows;
}
```

---

## Тестирование

### Unit тесты (Vitest)

```typescript
// tests/utils/example.test.ts
import { describe, it, expect } from 'vitest';
import { calculateTokenCost } from '../../api/services/generation.service';

describe('calculateTokenCost', () => {
  it('should return 1 for 1K quality', () => {
    expect(calculateTokenCost('1K')).toBe(1);
  });

  it('should return 2 for 2K quality', () => {
    expect(calculateTokenCost('2K')).toBe(2);
  });

  it('should return 3 for 4K quality', () => {
    expect(calculateTokenCost('4K')).toBe(3);
  });
});
```

### E2E тесты (Playwright)

```typescript
// tests/e2e/generation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Generation Flow', () => {
  test('should complete wizard steps', async ({ page }) => {
    await page.goto('/');
    
    // Upload images
    await page.setInputFiles('input[type="file"]', [
      'tests/fixtures/photo1.jpg',
      'tests/fixtures/photo2.jpg',
      'tests/fixtures/photo3.jpg',
    ]);
    
    // Select style
    await page.click('text=Magazine');
    
    // Start generation
    await page.click('text=Сгенерировать');
    
    // Wait for result
    await expect(page.locator('img[alt="Generated"]')).toBeVisible({
      timeout: 60000
    });
  });
});
```

---

## Отладка

### Логирование

```typescript
import { logger } from '../utils/logger.js';

// Info log
logger.info('Operation completed', { userId: user.id });

// Error log
logger.error('Operation failed', error, { context: 'generation' });

// API-specific
logger.logApiInfo('Request received', { endpoint: '/generate' });
logger.logApiError('Generation failed', error, { userId: '...' });
```

### Debug режим

```bash
# Включить debug логи
DEBUG=dreamlens:* npm run dev

# Только API логи
DEBUG=dreamlens:api npm run dev
```

### Drizzle Studio

```bash
# Запуск GUI для БД
npm run db:studio
```

Откроется на `https://local.drizzle.studio`

---

## Деплой

### Railway

```bash
# Установка CLI
npm install -g @railway/cli

# Логин
railway login

# Линковка проекта
railway link

# Деплой
railway up

# Логи
railway logs
```

### Vercel

```bash
# Установка CLI
npm install -g vercel

# Деплой
vercel

# Production деплой
vercel --prod
```

---

## Переменные окружения

### Обязательные

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `GEMINI_API_KEY` | Google Gemini API ключ(и) |

### Опциональные

| Переменная | Описание | Default |
|------------|----------|---------|
| `NODE_ENV` | Окружение | development |
| `PORT` | Порт сервера | 3000 |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram бота | - |
| `SENTRY_DSN` | DSN для Sentry | - |
| `GA_MEASUREMENT_ID` | Google Analytics ID | - |

---

## Типичные проблемы

### Ошибка зависимостей React 19

```bash
# Используйте --legacy-peer-deps
npm install --legacy-peer-deps
```

### Ошибка CORS

Проверьте, что origin добавлен в список разрешённых в `api/utils/cors.ts`.

### Ошибка Gemini API

1. Проверьте ключ: `AIzaSy...` (39 символов)
2. Проверьте квоту в Google AI Studio
3. Попробуйте добавить запасные ключи через запятую

### Ошибка базы данных

```bash
# Проверьте подключение
npm run db:studio

# Сбросьте схему (осторожно!)
npm run db:push --force
```

---

## Полезные ссылки

- [Gemini API Docs](https://ai.google.dev/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team/docs)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
- [Vitest Docs](https://vitest.dev/)
- [Playwright Docs](https://playwright.dev/)
