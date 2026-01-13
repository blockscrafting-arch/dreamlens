# DreamLens AI — Техническая документация

> **Версия:** 1.0.0  
> **Дата обновления:** Январь 2026  
> **Стек:** React 19 + TypeScript + Express + PostgreSQL + Gemini API

---

## 📖 Содержание

1. [Обзор проекта](#-обзор-проекта)
2. [Архитектура](#-архитектура)
3. [Технологический стек](#-технологический-стек)
4. [Структура проекта](#-структура-проекта)
5. [База данных](#-база-данных)
6. [API Reference](#-api-reference)
7. [Аутентификация](#-аутентификация)
8. [Система токенов](#-система-токенов)
9. [Генерация изображений](#-генерация-изображений)
10. [Telegram Mini App](#-telegram-mini-app)
11. [Платежная система](#-платежная-система)
12. [Безопасность](#-безопасность)
13. [Развёртывание](#-развёртывание)
14. [Конфигурация](#-конфигурация)
15. [Разработка](#-разработка)

---

## 🎯 Обзор проекта

**DreamLens AI** — это персональный AI-фотограф, который создаёт профессиональные фотосессии уровня Vogue и Dazed из обычных селфи. 

### Основные возможности

- 🎨 **24+ стиля генерации** — от Magazine до Cyber Angel
- 📸 **Качество до 4K** — три уровня качества (1K, 2K, 4K)
- 🔄 **Множественные соотношения сторон** — 1:1, 3:4, 4:3, 9:16, 16:9
- 💎 **Токенная система** — гибкая монетизация
- 📱 **Telegram Mini App** — полноценная интеграция
- 💳 **Telegram Stars** — нативные платежи в Telegram

### Бизнес-модель

| План | Цена | Генераций/день | Качество |
|------|------|----------------|----------|
| Free | Бесплатно | 5 | 1K |
| Pro | ₽499/мес | 50 | 2K |
| Premium | ₽999/мес | ∞ | 4K |

---

## 🏗 Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                        КЛИЕНТ                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Web App   │  │ Telegram    │  │     Общие компоненты    │ │
│  │   (React)   │  │ Mini App    │  │  (Context, Hooks, UI)   │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
└─────────┼────────────────┼──────────────────────┼───────────────┘
          │                │                      │
          └────────────────┴──────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   API Layer │
                    │  (Express)  │
                    └──────┬──────┘
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
┌───▼───┐           ┌──────▼──────┐        ┌─────▼─────┐
│ Auth  │           │  Services   │        │ External  │
│Service│           │   Layer     │        │   APIs    │
└───┬───┘           └──────┬──────┘        └─────┬─────┘
    │                      │                     │
    │               ┌──────▼──────┐              │
    │               │ Repositories│              │
    │               └──────┬──────┘              │
    │                      │                     │
    │               ┌──────▼──────┐       ┌──────▼──────┐
    │               │  PostgreSQL │       │ Gemini API  │
    │               │   (Neon)    │       │  (Google)   │
    │               └─────────────┘       └─────────────┘
    │
    └──────────────────────────────────────────────────
```

### Слои приложения

1. **Presentation Layer** — React компоненты, UI, хуки
2. **API Layer** — Express роуты, middleware
3. **Service Layer** — бизнес-логика
4. **Repository Layer** — работа с БД
5. **External APIs** — Gemini, Telegram, YooKassa

---

## 💻 Технологический стек

### Frontend

| Технология | Версия | Назначение |
|------------|--------|------------|
| React | 19.2.3 | UI фреймворк |
| TypeScript | 5.9.3 | Типизация |
| Vite | 7.3.0 | Сборка |
| Tailwind CSS | 3.4.14 | Стилизация |
| @twa-dev/sdk | 8.0.2 | Telegram SDK |
| Zod | 4.3.5 | Валидация |

### Backend

| Технология | Версия | Назначение |
|------------|--------|------------|
| Express | 4.21.0 | HTTP сервер |
| Drizzle ORM | 0.45.1 | ORM |
| PostgreSQL | - | База данных |
| @google/genai | 1.34.0 | AI генерация |
| @vercel/node | 2.3.0 | Serverless |

### Инфраструктура

| Сервис | Назначение |
|--------|------------|
| Railway / Vercel | Хостинг |
| Neon | PostgreSQL |
| Sentry | Мониторинг ошибок |
| Google Analytics | Аналитика |

---

## 📁 Структура проекта

```
dreamlens-ai/
├── api/                      # Backend API
│   ├── db/                   # Database setup
│   │   ├── index.ts         # DB connection
│   │   └── schema.ts        # Drizzle schema
│   ├── generate/            # Generation endpoints
│   │   ├── image.ts         # POST /api/generate/image
│   │   ├── idea.ts          # POST /api/generate/idea
│   │   └── status.ts        # GET /api/generate/status
│   ├── payments/            # Payment endpoints
│   │   ├── telegram-stars.ts
│   │   └── telegram-webhook.ts
│   ├── repositories/        # Data access layer
│   │   ├── database.ts
│   │   ├── user.repository.ts
│   │   ├── token.repository.ts
│   │   ├── generation.repository.ts
│   │   └── subscription.repository.ts
│   ├── services/            # Business logic
│   │   ├── auth.service.ts
│   │   ├── token.service.ts
│   │   ├── generation.service.ts
│   │   ├── subscription.service.ts
│   │   └── bonus.service.ts
│   ├── tokens/              # Token endpoints
│   │   └── index.ts
│   ├── user/                # User endpoints
│   │   └── index.ts
│   └── utils/               # Utilities
│       ├── auth.ts          # Auth verification
│       ├── cors.ts          # CORS config
│       ├── logger.ts        # Logging
│       ├── rateLimit.ts     # Rate limiting
│       ├── validation.ts    # Input validation
│       └── geminiKeys.ts    # API key rotation
│
├── components/              # React components
│   ├── wizard/             # Wizard steps
│   │   ├── UploadStep.tsx
│   │   ├── TrendStep.tsx
│   │   ├── ConfigStep.tsx
│   │   └── GenerationStep.tsx
│   ├── telegram/           # Telegram-specific UI
│   │   ├── TelegramLayout.tsx
│   │   ├── CreateTab.tsx
│   │   ├── ProfileTab.tsx
│   │   └── BottomNav.tsx
│   ├── tokens/             # Token components
│   │   ├── TokenBalance.tsx
│   │   ├── DailyWheel.tsx
│   │   └── DailyBonus.tsx
│   ├── payments/           # Payment pages
│   │   ├── PricingPage.tsx
│   │   └── PaymentSuccess.tsx
│   └── ui/                 # Reusable UI
│       ├── Button.tsx
│       ├── LegalModal.tsx
│       └── MobileMenu.tsx
│
├── context/                # React Context
│   ├── WizardContext.tsx   # Wizard state
│   ├── TokenContext.tsx    # Token management
│   ├── ToastContext.tsx    # Notifications
│   └── SubscriptionContext.tsx
│
├── lib/                    # Client utilities
│   ├── api.ts             # API client
│   ├── auth.ts            # Auth helpers
│   ├── telegram.ts        # Telegram SDK
│   ├── analytics.ts       # GA4
│   └── sentry.ts          # Error tracking
│
├── hooks/                  # Custom hooks
│   ├── useTelegram.ts     # Telegram hooks
│   ├── usePathname.ts     # Routing
│   └── useImageWorker.ts  # Image processing
│
├── prompts/               # AI prompts
│   └── trendPrompts.ts    # Style prompts (24+ styles)
│
├── shared/                # Shared code
│   └── constants.ts       # Token costs, etc
│
├── database/              # DB migrations
│   ├── migrations/
│   └── schema.sql
│
├── types.ts               # TypeScript types
├── App.tsx               # Main app component
├── server.ts             # Express server
└── package.json
```

---

## 🗄 База данных

### Схема (Drizzle ORM)

```typescript
// Пользователи
users {
  id: uuid (PK)
  clerk_id: varchar(255)      // Clerk auth
  device_id: varchar(255)     // Anonymous auth
  telegram_id: varchar(255)   // Telegram auth
  email: varchar(255)
  first_name: varchar(255)
  last_name: varchar(255)
  username: varchar(255)
  photo_url: text
  language_code: varchar(10)
  created_at: timestamp
  updated_at: timestamp
}

// Токены пользователей
user_tokens {
  id: uuid (PK)
  user_id: uuid (FK → users)
  balance: integer DEFAULT 0
  last_bonus_date: date
  created_at: timestamp
  updated_at: timestamp
}

// Транзакции токенов
token_transactions {
  id: uuid (PK)
  user_id: uuid (FK → users)
  amount: integer
  type: varchar(50)           // purchase, bonus, spend, refund
  description: text
  created_at: timestamp
}

// Подписки
subscriptions {
  id: uuid (PK)
  user_id: uuid (FK → users)
  plan: varchar(50)           // free, pro, premium
  status: varchar(50)         // active, cancelled, expired
  current_period_start: timestamp
  current_period_end: timestamp
  yookassa_subscription_id: varchar(255)
  created_at: timestamp
}

// Генерации
generations {
  id: uuid (PK)
  user_id: uuid (FK → users)
  image_url: text
  prompt_used: text
  trend: varchar(50)
  quality: varchar(10)        // 1K, 2K, 4K
  status: varchar(20)         // pending, processing, completed, failed
  error_message: text
  created_at: timestamp
}

// Платежи
payments {
  id: uuid (PK)
  user_id: uuid (FK → users)
  yookassa_payment_id: varchar(255)
  amount: decimal(10,2)
  currency: varchar(10)
  status: varchar(50)
  token_package: varchar(50)
  tokens_amount: integer
  created_at: timestamp
}

// Логи использования (Rate Limiting)
usage_logs {
  id: uuid (PK)
  user_id: uuid (FK → users)
  action: varchar(50)
  ip_address: varchar(45)
  created_at: timestamp
}
```

### Индексы

```sql
-- Users
CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_device_id ON users(device_id);
CREATE INDEX idx_users_telegram_id ON users(telegram_id);

-- Tokens
CREATE UNIQUE INDEX user_tokens_user_id_unique ON user_tokens(user_id);

-- Generations
CREATE INDEX idx_generations_user_id ON generations(user_id);
CREATE INDEX idx_generations_created_at ON generations(created_at);

-- Usage Logs
CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
```

### Триггеры

```sql
-- Автоматическое создание токенов при регистрации
CREATE OR REPLACE FUNCTION create_user_tokens()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_tokens (user_id, balance)
  VALUES (NEW.id, 10)  -- Welcome bonus: 10 tokens
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Record welcome bonus transaction
  INSERT INTO token_transactions (user_id, amount, type, description)
  VALUES (NEW.id, 10, 'bonus', 'Welcome bonus');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_created
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_user_tokens();
```

---

## 🔌 API Reference

### Аутентификация

Все запросы должны содержать заголовок `Authorization`:

```
Authorization: Device <device_id>      # Анонимные пользователи
Authorization: Telegram <initData>     # Telegram Mini App
```

### Endpoints

#### `POST /api/generate/image`

Генерация изображения с использованием Gemini API.

**Request:**
```typescript
{
  userImages: Array<{
    base64: string;        // Base64 изображения
    qualityScore: number;  // Оценка качества (0-100)
  }>;
  config: {
    trend: TrendType;      // Стиль генерации
    ratio: AspectRatio;    // Соотношение сторон
    quality: ImageQuality; // Качество (1K/2K/4K)
    dominantColor?: string;
    userPrompt?: string;
    referenceImage?: string;
    refinementText?: string;
  };
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    imageUrl: string;      // Data URL изображения
    generationId: string;
    tokens: {
      spent: number;
      remaining: number;
    };
  }
}
```

**Коды ответов:**
- `200` — Успешная генерация
- `400` — Ошибка валидации / Safety Filter
- `401` — Не авторизован
- `402` — Недостаточно токенов
- `429` — Rate limit превышен
- `500` — Внутренняя ошибка сервера

---

#### `POST /api/generate/idea`

Генерация креативной идеи для фотосессии.

**Request:** Нет тела запроса

**Response:**
```typescript
{
  success: true,
  data: {
    idea: string;  // Описание идеи на русском
  }
}
```

---

#### `GET /api/tokens`

Получение информации о токенах пользователя.

**Response:**
```typescript
{
  success: true,
  data: {
    balance: number;
    lastBonusDate: string | null;
    canClaimBonus: boolean;
    serverDate: string;
    freeGenerations: {
      remaining: number;
      total: number;
      maxQuality: string;
    };
    plan: string;
  }
}
```

---

#### `POST /api/tokens`

Получение ежедневного бонуса.

**Response:**
```typescript
{
  success: true,
  data: {
    tokensAwarded: number;
    newBalance: number;
  }
}
```

---

#### `GET /api/user`

Получение профиля пользователя.

**Response:**
```typescript
{
  success: true,
  data: {
    id: string;
    email: string | null;
    telegramId: string | null;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    photoUrl: string | null;
    createdAt: string;
  }
}
```

---

#### `GET /api/generations`

История генераций пользователя.

**Query Parameters:**
- `limit` — Количество записей (default: 20)
- `offset` — Смещение для пагинации

**Response:**
```typescript
{
  success: true,
  data: {
    generations: Array<{
      id: string;
      imageUrl: string;
      trend: string;
      quality: string;
      status: string;
      createdAt: string;
    }>;
    total: number;
  }
}
```

---

#### `POST /api/payments/telegram-stars`

Создание платежа через Telegram Stars.

**Request:**
```typescript
{
  package: 'starter' | 'popular' | 'best_value';
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    invoiceLink: string;  // Ссылка на Telegram Invoice
  }
}
```

---

#### `POST /api/payments/telegram-webhook`

Webhook для обработки платежей Telegram.

---

#### `GET /api/health`

Проверка состояния сервера.

**Response:**
```typescript
{
  status: 'ok',
  timestamp: string,
  database: 'connected' | 'disconnected'
}
```

---

## 🔐 Аутентификация

### Поддерживаемые методы

1. **Device ID** — Для анонимных пользователей
   - Генерируется на клиенте через FingerprintJS
   - Хранится в localStorage
   - Формат заголовка: `Authorization: Device <device_id>`

2. **Telegram WebApp** — Для пользователей Telegram
   - Использует initData от Telegram
   - Автоматическая верификация на сервере
   - Формат заголовка: `Authorization: Telegram <initData>`

### Процесс аутентификации

```typescript
// lib/auth.ts
export async function getAuthHeaders(): Promise<HeadersInit> {
  // 1. Проверяем Telegram
  const initData = getTelegramInitData();
  if (initData) {
    return { 'Authorization': `Telegram ${initData}` };
  }
  
  // 2. Fallback на Device ID
  const deviceId = await getDeviceId();
  return { 'Authorization': `Device ${deviceId}` };
}
```

### Верификация на сервере

```typescript
// api/utils/auth.ts
export async function verifyAuth(request: VercelRequest): Promise<AuthResult> {
  const authHeader = request.headers.authorization;
  
  if (authHeader?.startsWith('Telegram ')) {
    // Верификация Telegram initData
    return verifyTelegramAuth(authHeader.slice(9));
  }
  
  if (authHeader?.startsWith('Device ')) {
    // Device ID не требует верификации
    return {
      isAuthenticated: true,
      userId: authHeader.slice(7),
      authType: 'device'
    };
  }
  
  return { isAuthenticated: false };
}
```

---

## 🪙 Система токенов

### Стоимость операций

| Качество | Токены | Описание |
|----------|--------|----------|
| 1K (STD) | 1 | Стандартное качество |
| 2K (HD) | 2 | Высокое качество |
| 4K (UHD) | 3 | Ультра качество |

### Начисление токенов

| Тип | Количество | Условие |
|-----|------------|---------|
| Welcome Bonus | 10 | При регистрации |
| Daily Bonus | 1-5 | Ежедневно (колесо удачи) |
| Purchase | 10-100 | Покупка |
| Refund | varies | При ошибке генерации |

### Пакеты для покупки

| Пакет | Токены | Цена (Stars) | Цена (RUB) |
|-------|--------|--------------|------------|
| Starter | 10 | 50 | ₽99 |
| Popular | 30 | 100 | ₽249 |
| Best Value | 100 | 250 | ₽599 |

---

## 🖼 Генерация изображений

### Стили (TrendType)

```typescript
enum TrendType {
  // Editorial & High Fashion
  MAGAZINE = 'MAGAZINE',
  PROFESSIONAL = 'PROFESSIONAL',
  
  // Cinema & Atmosphere
  COUPLE = 'COUPLE',
  RETRO_2K17 = 'RETRO_2K17',
  DARK_ACADEMIA = 'DARK_ACADEMIA',
  
  // Luxury & Status
  OLD_MONEY = 'OLD_MONEY',
  MOB_WIFE = 'MOB_WIFE',
  A_LA_RUSSE = 'A_LA_RUSSE',
  
  // Modern Feminine
  OFFICE_SIREN = 'OFFICE_SIREN',
  COQUETTE = 'COQUETTE',
  CLEAN_GIRL = 'CLEAN_GIRL',
  
  // Digital & Futuristic
  CYBER_ANGEL = 'CYBER_ANGEL',
  NEON_CYBER = 'NEON_CYBER',
  
  // Lifestyle & Vibe
  SPORT_CHIC = 'SPORT_CHIC',
  Y2K_POP = 'Y2K_POP',
  COTTAGECORE = 'COTTAGECORE',
  
  // Art & Fantasy
  ETHEREAL = 'ETHEREAL',
  MINIMALIST = 'MINIMALIST',
  
  // 2025 Trends
  TOMATO_GIRL = 'TOMATO_GIRL',
  COASTAL_COWGIRL = 'COASTAL_COWGIRL',
  QUIET_LUXURY = 'QUIET_LUXURY',
  BALLETCORE = 'BALLETCORE',
  GRUNGE_REVIVAL = 'GRUNGE_REVIVAL',
  SOFT_GOTH = 'SOFT_GOTH',
  
  CUSTOM = 'CUSTOM',
}
```

### Соотношения сторон

```typescript
enum AspectRatio {
  SQUARE = '1:1',
  PORTRAIT = '3:4',
  LANDSCAPE = '4:3',
  STORY = '9:16',
  CINEMATIC = '16:9'
}
```

### Процесс генерации

```
1. Валидация входных данных
   ├── Минимум 3 фото
   ├── Проверка формата (JPEG, PNG, WebP)
   └── Проверка размера (< 10MB)

2. Проверка токенов
   ├── Бесплатные генерации (по плану)
   └── Платные токены

3. Rate Limiting
   └── 10 запросов / минута

4. Подготовка изображений
   ├── Сортировка по качеству
   ├── Выбор топ-5 лучших
   └── Конвертация в base64

5. Построение промпта
   ├── System Instruction
   ├── Identity Preservation
   └── Style-specific prompt

6. Вызов Gemini API
   ├── gemini-3-pro-image-preview
   ├── Ротация ключей при ошибках
   └── Safety Settings

7. Обработка результата
   ├── Сохранение в БД
   ├── Списание токенов
   └── Возврат при ошибке
```

### Пример промпта

```typescript
const systemInstruction = `
You are a world-class fashion photographer...

IDENTITY PRESERVATION (NON-NEGOTIABLE):
1. FACE SOURCE: The first uploaded images contain the SUBJECT.
2. LIKENESS: The generated face MUST be immediately recognizable.
3. SKIN: Maintain realistic skin texture with visible pores.
...
`;

const mainPrompt = `
CONCEPT: "The New Guard" - Avant-garde editorial.

STYLING:
- Garment: Architectural piece...

LIGHTING SETUP:
- Key: Harsh beauty dish at 45°...

COMPOSITION:
- Framing: Unconventional crop...
`;
```

---

## 📱 Telegram Mini App

### Инициализация

```typescript
// lib/telegram.ts
export function initTelegramWebApp(): void {
  if (window.Telegram?.WebApp) {
    const webApp = window.Telegram.WebApp;
    webApp.expand();
    webApp.enableClosingConfirmation();
    webApp.ready();
  }
}
```

### Компоненты

```typescript
// Telegram-specific layout
<TelegramLayout activeTab={activeTab} onTabChange={setActiveTab}>
  {activeTab === 'create' ? <CreateTab /> : <ProfileTab />}
</TelegramLayout>

// Bottom Navigation
<BottomNav 
  activeTab={activeTab} 
  onTabChange={setActiveTab}
/>
```

### Хуки

```typescript
// hooks/useTelegram.ts
export function useTelegramBackButton() {
  const show = (callback: () => void) => {
    WebApp.BackButton.show();
    WebApp.BackButton.onClick(callback);
  };
  
  const hide = () => {
    WebApp.BackButton.hide();
  };
  
  return { show, hide };
}

export function useTelegramHaptics() {
  const impactOccurred = (style: 'light' | 'medium' | 'heavy') => {
    WebApp.HapticFeedback.impactOccurred(style);
  };
  
  return { impactOccurred };
}
```

### Платежи через Stars

```typescript
// На клиенте
const response = await apiRequest('/api/payments/telegram-stars', {
  method: 'POST',
  body: JSON.stringify({ package: 'popular' })
});
const { invoiceLink } = await response.json();
WebApp.openInvoice(invoiceLink, (status) => {
  if (status === 'paid') {
    // Обновить баланс токенов
  }
});

// На сервере
const invoice = await bot.createInvoiceLink({
  title: 'DreamLens Tokens',
  description: '30 токенов для генерации',
  payload: JSON.stringify({ userId, package: 'popular' }),
  currency: 'XTR',  // Telegram Stars
  prices: [{ label: '30 Tokens', amount: 100 }],
});
```

---

## 💳 Платежная система

### Telegram Stars

```typescript
// Пакеты
const PACKAGES = {
  starter: { tokens: 10, stars: 50 },
  popular: { tokens: 30, stars: 100 },
  best_value: { tokens: 100, stars: 250 },
};

// Webhook обработка
app.post('/api/payments/telegram-webhook', async (req, res) => {
  const update = req.body;
  
  if (update.pre_checkout_query) {
    // Подтверждение платежа
    await bot.answerPreCheckoutQuery(
      update.pre_checkout_query.id, 
      { ok: true }
    );
  }
  
  if (update.message?.successful_payment) {
    // Начисление токенов
    const { userId, package } = JSON.parse(
      update.message.successful_payment.invoice_payload
    );
    await TokenService.addTokens(
      userId, 
      PACKAGES[package].tokens,
      'purchase'
    );
  }
});
```

### ЮKassa (для веба)

Интеграция с ЮKassa для веб-платежей настраивается отдельно через переменные окружения.

---

## 🔒 Безопасность

### Rate Limiting

```typescript
// api/utils/rateLimit.ts
export async function checkRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowMs: number,
  ipAddress?: string
): Promise<{ allowed: boolean; resetTime: number }> {
  // Проверка по userId + IP
  const count = await getUsageCount(userId, action, windowMs, ipAddress);
  return {
    allowed: count < limit,
    resetTime: Date.now() + windowMs
  };
}
```

### Валидация входных данных

```typescript
// Zod схемы
const imageGenerationSchema = z.object({
  userImages: z.array(z.object({
    base64: z.string().max(10_000_000),
    qualityScore: z.number().min(0).max(100),
  })).min(3).max(20),
  config: z.object({
    trend: z.nativeEnum(TrendType),
    ratio: z.nativeEnum(AspectRatio),
    quality: z.nativeEnum(ImageQuality),
  }),
});
```

### CORS

```typescript
const ALLOWED_ORIGINS = [
  'https://dreamlens.ai',
  'https://*.vercel.app',
  'https://web.telegram.org',
];
```

### Gemini API Keys Rotation

```typescript
// api/utils/geminiKeys.ts
export async function tryWithFallback<T>(
  operation: (apiKey: string) => Promise<T>,
  context: object
): Promise<T> {
  const keys = getGeminiApiKeys();
  
  for (const key of keys) {
    try {
      return await operation(key);
    } catch (error) {
      if (isRetryableError(error)) {
        continue; // Try next key
      }
      throw error;
    }
  }
  
  throw new Error('All API keys exhausted');
}
```

---

## 🚀 Развёртывание

### Railway

```bash
# Установка Railway CLI
npm install -g @railway/cli

# Деплой
railway login
railway link
railway up
```

**railway.json:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### Vercel

```bash
# Установка Vercel CLI
npm install -g vercel

# Деплой
vercel
```

**vercel.json:**
```json
{
  "version": 2,
  "builds": [
    { "src": "dist/**", "use": "@vercel/static" },
    { "src": "api/**/*.ts", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/$1" },
    { "src": "/(.*)", "dest": "/dist/$1" }
  ]
}
```

### Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY dist-server/ ./dist-server/

EXPOSE 3000

CMD ["node", "dist-server/server.js"]
```

---

## ⚙️ Конфигурация

### Переменные окружения

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Gemini API (поддерживает несколько ключей через запятую)
GEMINI_API_KEY=AIza...,AIza...

# Telegram Bot
TELEGRAM_BOT_TOKEN=123456:ABC...

# YooKassa (опционально)
YOOKASSA_SHOP_ID=123456
YOOKASSA_SECRET_KEY=live_...

# Sentry (опционально)
SENTRY_DSN=https://...@sentry.io/...

# Analytics (опционально)
GA_MEASUREMENT_ID=G-...

# Environment
NODE_ENV=production
PORT=3000
```

### Локальная разработка

```bash
# .env.local
DATABASE_URL=postgresql://localhost:5432/dreamlens_dev
GEMINI_API_KEY=AIzaSy...
NODE_ENV=development
```

---

## 🛠 Разработка

### Установка

```bash
# Клонирование
git clone <repo-url>
cd dreamlens-ai

# Установка зависимостей
npm install --legacy-peer-deps

# Запуск dev сервера
npm run dev
```

### Доступные команды

```bash
# Разработка
npm run dev              # Vite dev server

# Сборка
npm run build            # Build client + server
npm run build:server     # Build server only

# Запуск
npm start                # Production server

# Качество кода
npm run lint             # ESLint
npm run lint:fix         # ESLint fix
npm run format           # Prettier
npm run type-check       # TypeScript

# Тесты
npm test                 # Vitest
npm run test:ui          # Vitest UI
npm run test:coverage    # Coverage report
npm run test:e2e         # Playwright

# База данных
npm run db:generate      # Generate migrations
npm run db:migrate       # Run migrations
npm run db:push          # Push schema changes
npm run db:studio        # Drizzle Studio
```

### Структура тестов

```
tests/
├── api/                  # API integration tests
├── e2e/                  # End-to-end tests (Playwright)
├── utils/                # Unit tests
└── setup.ts              # Test configuration
```

### Git Workflow

```bash
# Feature branch
git checkout -b feature/new-style

# Коммит
git add .
git commit -m "feat: add new style X"

# Push
git push origin feature/new-style

# PR → main → автодеплой
```

---

## 📊 Мониторинг

### Sentry

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

### Логирование

```typescript
// api/utils/logger.ts
export const logger = {
  info: (message: string, context?: object) => {
    console.log(JSON.stringify({ level: 'info', message, ...context }));
  },
  error: (message: string, error: Error, context?: object) => {
    console.error(JSON.stringify({ 
      level: 'error', 
      message, 
      error: error.message,
      stack: error.stack,
      ...context 
    }));
  },
  logApiError: (endpoint: string, error: Error, context?: object) => {
    // Structured logging for API errors
  },
};
```

---

## 📞 Поддержка

- **Telegram:** @dreamlens_support
- **Email:** support@dreamlens.ai
- **GitHub Issues:** [repository]/issues

---

## 📄 Лицензия

Проприетарное ПО. Все права защищены.

---

*Документация актуальна на январь 2026*
