# DreamLens AI — API Reference

> Краткий справочник по API эндпоинтам

## Базовый URL

```
Production: https://dreamlens.ai/api
Development: http://localhost:3000/api
```

## Аутентификация

Все запросы требуют заголовок `Authorization`:

```http
# Для Telegram
Authorization: Telegram <initData>

# Для анонимных пользователей
Authorization: Device <device_id>
```

---

## Endpoints

### Генерация

#### `POST /generate/image`
Генерация AI-изображения

**Headers:**
```http
Content-Type: application/json
Authorization: Device <device_id>
```

**Body:**
```json
{
  "userImages": [
    {
      "base64": "data:image/jpeg;base64,...",
      "qualityScore": 85
    }
  ],
  "config": {
    "trend": "MAGAZINE",
    "ratio": "3:4",
    "quality": "2K",
    "dominantColor": "#ff5500",
    "userPrompt": "добавить закат",
    "refinementText": "сделать теплее"
  }
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "imageUrl": "data:image/png;base64,...",
    "generationId": "uuid",
    "tokens": {
      "spent": 2,
      "remaining": 8
    }
  }
}
```

**Errors:**
- `400` — Невалидные данные / Safety Filter
- `401` — Не авторизован
- `402` — Недостаточно токенов
- `429` — Rate limit

---

#### `POST /generate/idea`
Получить креативную идею для фотосессии

**Response 200:**
```json
{
  "success": true,
  "data": {
    "idea": "Портрет в лучах закатного солнца, модель в шелковом платье..."
  }
}
```

---

### Токены

#### `GET /tokens`
Получить информацию о токенах

**Response 200:**
```json
{
  "success": true,
  "data": {
    "balance": 15,
    "lastBonusDate": "2026-01-12",
    "canClaimBonus": true,
    "serverDate": "2026-01-13",
    "freeGenerations": {
      "remaining": 3,
      "total": 5,
      "maxQuality": "1K"
    },
    "plan": "free"
  }
}
```

---

#### `POST /tokens`
Получить ежедневный бонус

**Response 200:**
```json
{
  "success": true,
  "data": {
    "tokensAwarded": 3,
    "newBalance": 18
  }
}
```

**Response 400:**
```json
{
  "success": false,
  "error": "Бонус уже получен сегодня"
}
```

---

### Пользователь

#### `GET /user`
Получить профиль пользователя

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "telegramId": "123456789",
    "firstName": "Иван",
    "lastName": "Иванов",
    "username": "ivanov",
    "photoUrl": "https://...",
    "createdAt": "2026-01-01T00:00:00Z"
  }
}
```

---

### История генераций

#### `GET /generations`
Получить историю генераций

**Query:**
- `limit` — Количество (default: 20, max: 100)
- `offset` — Смещение (default: 0)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "generations": [
      {
        "id": "uuid",
        "imageUrl": "data:image/png;base64,...",
        "trend": "MAGAZINE",
        "quality": "2K",
        "status": "completed",
        "createdAt": "2026-01-13T10:30:00Z"
      }
    ],
    "total": 42
  }
}
```

---

### Платежи

#### `POST /payments/telegram-stars`
Создать платёж через Telegram Stars

**Body:**
```json
{
  "package": "popular"
}
```

**Packages:**
| ID | Токены | Stars |
|----|--------|-------|
| `starter` | 10 | 50 |
| `popular` | 30 | 100 |
| `best_value` | 100 | 250 |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "invoiceLink": "https://t.me/$..."
  }
}
```

---

### Служебные

#### `GET /health`
Проверка состояния сервера

**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-13T12:00:00Z",
  "database": "connected"
}
```

---

## Типы данных

### TrendType
```
MAGAZINE, PROFESSIONAL, COUPLE, RETRO_2K17, DARK_ACADEMIA,
OLD_MONEY, MOB_WIFE, A_LA_RUSSE, OFFICE_SIREN, COQUETTE,
CLEAN_GIRL, CYBER_ANGEL, NEON_CYBER, SPORT_CHIC, Y2K_POP,
COTTAGECORE, ETHEREAL, MINIMALIST, TOMATO_GIRL, COASTAL_COWGIRL,
QUIET_LUXURY, BALLETCORE, GRUNGE_REVIVAL, SOFT_GOTH, CUSTOM
```

### AspectRatio
```
1:1, 3:4, 4:3, 9:16, 16:9
```

### ImageQuality
```
1K, 2K, 4K
```

### Plan
```
free, pro, premium
```

---

## Rate Limits

| Endpoint | Лимит | Окно |
|----------|-------|------|
| `/generate/image` | 10 | 60 сек |
| `/generate/idea` | 20 | 60 сек |
| `/tokens` (POST) | 1 | 24 часа |
| Остальные | 100 | 60 сек |

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 400 | Bad Request — невалидные данные |
| 401 | Unauthorized — требуется авторизация |
| 402 | Payment Required — недостаточно токенов |
| 404 | Not Found — ресурс не найден |
| 413 | Payload Too Large — слишком большие файлы |
| 429 | Too Many Requests — rate limit |
| 500 | Internal Server Error |

---

## Примеры cURL

### Генерация изображения
```bash
curl -X POST https://dreamlens.ai/api/generate/image \
  -H "Content-Type: application/json" \
  -H "Authorization: Device abc123" \
  -d '{
    "userImages": [
      {"base64": "...", "qualityScore": 90},
      {"base64": "...", "qualityScore": 85},
      {"base64": "...", "qualityScore": 80}
    ],
    "config": {
      "trend": "MAGAZINE",
      "ratio": "3:4",
      "quality": "1K"
    }
  }'
```

### Получить баланс токенов
```bash
curl https://dreamlens.ai/api/tokens \
  -H "Authorization: Device abc123"
```

### Получить ежедневный бонус
```bash
curl -X POST https://dreamlens.ai/api/tokens \
  -H "Authorization: Device abc123"
```
