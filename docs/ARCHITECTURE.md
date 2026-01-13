# DreamLens AI — Архитектура

## Обзор

DreamLens AI построен на основе многослойной архитектуры с чётким разделением ответственности.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           КЛИЕНТСКИЙ СЛОЙ                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │
│  │     Web App      │  │  Telegram Mini   │  │   Общие компоненты   │   │
│  │    (Browser)     │  │       App        │  │                      │   │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘   │
│           │                     │                       │               │
│           └─────────────────────┴───────────────────────┘               │
│                                 │                                       │
│                          ┌──────▼──────┐                                │
│                          │   Context   │  WizardContext, TokenContext   │
│                          │   Providers │  ToastContext                  │
│                          └──────┬──────┘                                │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │
                           HTTP/HTTPS
                                  │
┌─────────────────────────────────┼───────────────────────────────────────┐
│                           API СЛОЙ                                       │
│                          ┌──────▼──────┐                                │
│                          │   Express   │  CORS, JSON parsing            │
│                          │  Middleware │  Auth, Rate Limiting           │
│                          └──────┬──────┘                                │
│                                 │                                       │
│  ┌──────────────────────────────┼──────────────────────────────────┐   │
│  │                         РОУТЫ                                    │   │
│  │  /generate/image    /tokens    /user    /payments    /health    │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼───────────────────────────────────────┐
│                          СЕРВИСНЫЙ СЛОЙ                                  │
│                                 │                                       │
│  ┌──────────────────────────────┼──────────────────────────────────┐   │
│  │  AuthService    TokenService    GenerationService    Bonus...   │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼───────────────────────────────────────┐
│                        РЕПОЗИТОРНЫЙ СЛОЙ                                 │
│                                 │                                       │
│  ┌──────────────────────────────┼──────────────────────────────────┐   │
│  │  UserRepository  TokenRepository  GenerationRepository  ...      │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
        ┌─────▼─────┐       ┌─────▼─────┐       ┌─────▼─────┐
        │ PostgreSQL│       │  Gemini   │       │  Telegram │
        │   (Neon)  │       │    API    │       │    API    │
        └───────────┘       └───────────┘       └───────────┘
```

---

## Слои приложения

### 1. Клиентский слой (Frontend)

**Технологии:** React 19, TypeScript, Tailwind CSS

```
components/
├── wizard/           # Шаги визарда генерации
│   ├── UploadStep    # Загрузка фото
│   ├── TrendStep     # Выбор стиля
│   ├── ConfigStep    # Настройки
│   └── GenerationStep# Результат
├── telegram/         # Telegram-специфичные компоненты
│   ├── TelegramLayout
│   ├── CreateTab
│   └── ProfileTab
├── tokens/           # Токены и бонусы
├── payments/         # Платежи и тарифы
└── ui/               # Переиспользуемые UI компоненты
```

**Управление состоянием:**
- `WizardContext` — состояние визарда генерации
- `TokenContext` — баланс токенов
- `ToastContext` — уведомления
- `SubscriptionContext` — подписки

---

### 2. API слой

**Технологии:** Express.js, Vercel Functions

```
api/
├── generate/         # Эндпоинты генерации
│   ├── image.ts      # POST /api/generate/image
│   ├── idea.ts       # POST /api/generate/idea
│   └── status.ts     # GET /api/generate/status/:id
├── tokens/           # Управление токенами
├── user/             # Профиль пользователя
├── payments/         # Платежи
├── generations/      # История генераций
└── health/           # Health check
```

**Middleware:**
```typescript
// Цепочка обработки запроса
Request → CORS → Auth → Rate Limit → Validation → Handler → Response
```

---

### 3. Сервисный слой

**Назначение:** Бизнес-логика, изолированная от HTTP

```typescript
// services/auth.service.ts
export async function getAuthenticatedUser(request): Promise<AuthenticatedUser>

// services/token.service.ts
export async function getTokenInfo(userId: string): Promise<TokenInfo>
export async function spendTokens(userId: string, amount: number): Promise<boolean>
export async function addTokens(userId: string, amount: number, type: string): Promise<void>

// services/generation.service.ts
export function prepareImages(images: UserImage[]): PreparedImage[]
export function buildGenerationPrompt(config: GenerationConfig): PromptData
export function calculateTokenCost(quality: string): number

// services/subscription.service.ts
export async function getUserSubscription(userId: string): Promise<Subscription>
export function getSubscriptionLimits(plan: string): SubscriptionLimits
```

---

### 4. Репозиторный слой

**Назначение:** Абстракция доступа к данным

```typescript
// repositories/user.repository.ts
export async function getOrCreateUser(data: UserData): Promise<User>
export async function findByTelegramId(telegramId: string): Promise<User | null>
export async function findByDeviceId(deviceId: string): Promise<User | null>

// repositories/token.repository.ts
export async function getBalance(userId: string): Promise<number>
export async function updateBalance(userId: string, delta: number): Promise<void>
export async function recordTransaction(data: TransactionData): Promise<void>

// repositories/generation.repository.ts
export async function create(data: GenerationData): Promise<Generation>
export async function updateStatus(id: string, status: string): Promise<void>
export async function getByUserId(userId: string, limit: number): Promise<Generation[]>
```

---

## Потоки данных

### Генерация изображения

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Upload  │────▶│ Select  │────▶│ Config  │────▶│Generate │────▶│ Result  │
│  Step   │     │  Style  │     │  Step   │     │  Step   │     │         │
└─────────┘     └─────────┘     └─────────┘     └────┬────┘     └─────────┘
                                                     │
                                              POST /api/generate/image
                                                     │
                                                     ▼
                                            ┌────────────────┐
                                            │  Auth Check    │
                                            └───────┬────────┘
                                                    │
                                            ┌───────▼────────┐
                                            │  Rate Limit    │
                                            └───────┬────────┘
                                                    │
                                            ┌───────▼────────┐
                                            │ Token Balance  │
                                            └───────┬────────┘
                                                    │
                                            ┌───────▼────────┐
                                            │ Prepare Images │
                                            └───────┬────────┘
                                                    │
                                            ┌───────▼────────┐
                                            │  Build Prompt  │
                                            └───────┬────────┘
                                                    │
                                            ┌───────▼────────┐
                                            │  Gemini API    │
                                            └───────┬────────┘
                                                    │
                                            ┌───────▼────────┐
                                            │ Save to DB     │
                                            └───────┬────────┘
                                                    │
                                            ┌───────▼────────┐
                                            │ Spend Tokens   │
                                            └───────┬────────┘
                                                    │
                                                    ▼
                                              Return Image
```

### Аутентификация

```
┌─────────────────────────────────────────────────────────────┐
│                    Request arrives                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ Extract Auth Header     │
              │ Authorization: X ...    │
              └────────────┬───────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  Telegram   │ │   Device    │ │   None      │
    │  initData   │ │     ID      │ │             │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐        │
    │   Verify    │ │   Accept    │        │
    │  Signature  │ │   as-is     │        │
    └──────┬──────┘ └──────┬──────┘        │
           │               │               │
           └───────┬───────┘               │
                   │                       │
           ┌───────▼───────┐        ┌──────▼──────┐
           │ Get/Create    │        │    401      │
           │    User       │        │ Unauthorized│
           └───────┬───────┘        └─────────────┘
                   │
           ┌───────▼───────┐
           │   Continue    │
           │   to Handler  │
           └───────────────┘
```

---

## Паттерны и практики

### Repository Pattern

Изоляция логики доступа к данным:

```typescript
// Репозиторий не знает о HTTP
class UserRepository {
  async findById(id: string): Promise<User | null> {
    return await db.query.users.findFirst({
      where: eq(users.id, id)
    });
  }
}

// Сервис использует репозиторий
class UserService {
  constructor(private repo: UserRepository) {}
  
  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return this.mapToProfile(user);
  }
}
```

### Service Layer Pattern

Бизнес-логика инкапсулирована в сервисах:

```typescript
// Сервис содержит бизнес-правила
class TokenService {
  async spendTokens(userId: string, amount: number, reason: string): Promise<boolean> {
    // 1. Проверить баланс
    const balance = await this.tokenRepo.getBalance(userId);
    if (balance < amount) return false;
    
    // 2. Списать токены
    await this.tokenRepo.updateBalance(userId, -amount);
    
    // 3. Записать транзакцию
    await this.tokenRepo.recordTransaction({
      userId,
      amount: -amount,
      type: 'spend',
      description: reason
    });
    
    return true;
  }
}
```

### Error Handling

Централизованная обработка ошибок:

```typescript
// Кастомные ошибки
class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class InsufficientTokensError extends AppError {
  constructor(required: number, available: number) {
    super(`Insufficient tokens: ${required} required, ${available} available`, 402, 'INSUFFICIENT_TOKENS');
  }
}

// Обработчик в роуте
try {
  await handler(req, res);
} catch (error) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
  // Unexpected error
  logger.error('Unhandled error', error);
  return res.status(500).json({ error: 'Internal server error' });
}
```

---

## Масштабирование

### Горизонтальное масштабирование

```
                    ┌─────────────┐
                    │   Load      │
                    │  Balancer   │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
  ┌─────▼─────┐      ┌─────▼─────┐      ┌─────▼─────┐
  │  Server   │      │  Server   │      │  Server   │
  │    #1     │      │    #2     │      │    #3     │
  └─────┬─────┘      └─────┬─────┘      └─────┬─────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │  PostgreSQL │
                    │   (Neon)    │
                    └─────────────┘
```

### Кэширование

```typescript
// Redis для кэширования (при необходимости)
const cache = new RedisCache();

async function getTokenInfo(userId: string): Promise<TokenInfo> {
  // Try cache first
  const cached = await cache.get(`tokens:${userId}`);
  if (cached) return JSON.parse(cached);
  
  // Fetch from DB
  const info = await tokenRepo.getInfo(userId);
  
  // Cache for 60 seconds
  await cache.set(`tokens:${userId}`, JSON.stringify(info), 60);
  
  return info;
}
```

### Rate Limiting Strategy

```typescript
// Многоуровневый rate limiting
const rateLimitConfig = {
  // По пользователю
  user: {
    'generation': { limit: 10, window: 60000 },
    'tokens': { limit: 100, window: 60000 },
  },
  // По IP (защита от abuse)
  ip: {
    'generation': { limit: 50, window: 60000 },
  },
  // Глобальный (защита API)
  global: {
    'gemini': { limit: 100, window: 60000 },
  }
};
```

---

## Безопасность

### Defense in Depth

```
┌──────────────────────────────────────────────────────────┐
│                        CLOUDFLARE                         │
│                     DDoS Protection                       │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│                         CORS                              │
│                 Origin Validation                         │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│                    RATE LIMITING                          │
│               Per User + Per IP + Global                  │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│                   AUTHENTICATION                          │
│              Telegram Signature / Device ID               │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│                   INPUT VALIDATION                        │
│                    Zod Schemas                            │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────┐
│                   BUSINESS LOGIC                          │
│                 Token/Balance Checks                      │
└──────────────────────────────────────────────────────────┘
```

---

## Мониторинг

### Метрики

```typescript
// Ключевые метрики
const metrics = {
  // Бизнес-метрики
  'generations.total': Counter,
  'generations.success': Counter,
  'generations.failed': Counter,
  'tokens.spent': Counter,
  'tokens.purchased': Counter,
  
  // Технические метрики
  'api.latency': Histogram,
  'api.errors': Counter,
  'db.query.duration': Histogram,
  'gemini.api.latency': Histogram,
};
```

### Алерты

```yaml
# Примерные правила алертинга
alerts:
  - name: HighErrorRate
    condition: error_rate > 5%
    duration: 5m
    
  - name: HighLatency
    condition: p95_latency > 5s
    duration: 5m
    
  - name: GeminiAPIDown
    condition: gemini_success_rate < 50%
    duration: 2m
```
