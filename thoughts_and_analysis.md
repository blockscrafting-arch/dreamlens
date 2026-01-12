# Анализ проблемы NeonDbError: out of memory

## Симптомы
В логах наблюдается множество ошибок `NeonDbError: out of memory` на эндпоинте `/api/tokens`.
Стек вызовов указывает на цепочку:
`GET /api/tokens` -> `UserService.getOrCreateUser...` -> `ensureWelcomeBonus` -> `ensureWelcomeBonusAtomic` -> `sql execution`.

## Причина (Root Cause)
Архитектура эндпоинта `GET /api/tokens` (который должен быть легковесным и "read-only") выполняет **три тяжелые операции записи** (или попытки записи) на каждый запрос:

1.  **`UserRepo.getOrCreateUser`**:
    Выполняет `INSERT ... ON CONFLICT DO UPDATE SET updated_at = NOW()`.
    Это означает, что **каждый** просмотр баланса обновляет строку пользователя в БД. Это вызывает блокировки строк и генерирует WAL-трафик.

2.  **`TokenRepo.getOrCreateTokenBalance`** (внутри `ensureWelcomeBonusAtomic`):
    Выполняет `INSERT ... ON CONFLICT DO UPDATE SET updated_at = NOW()`.
    Аналогично, каждый запрос обновляет таблицу `user_tokens`.

3.  **`TokenRepo.ensureWelcomeBonusAtomic`** (CTE query):
    Выполняет сложный запрос с `WITH ... UPDATE ... INSERT ...`.
    Хотя он имеет проверки `EXISTS`, сам факт запуска такого запроса (особенно после двух предыдущих апдейтов) создает нагрузку на планировщик и память Postgres, так как это транзакционная логика.

При частом опросе этого эндпоинта (polling) или большом количестве пользователей, база данных перегружается операциями записи и блокировками, что приводит к исчерпанию памяти (OOM) в Neon (Serverless Postgres).

## План решения

Нужно перевести логику с "Always Write" на "Read First, Write Later".

### 1. Оптимизация `UserRepo.getOrCreateUser`
Вместо безусловного `INSERT ... ON CONFLICT DO UPDATE`:
1. Сначала сделать простой `SELECT`.
2. Если пользователь найден - вернуть его (не обновлять `updated_at` просто так).
3. Только если не найден - делать `INSERT`.

### 2. Оптимизация `TokenRepo.ensureWelcomeBonusAtomic`
Сейчас этот метод вызывается всегда. Нужно добавить "быстрые проверки" перед тяжелой артиллерией:
1.  **Проверка токенов**: Вызвать `getTokenBalance(userId)` (который кэшируется!). Если баланс есть, значит запись в `user_tokens` существует. Пропускаем `getOrCreateTokenBalance`.
2.  **Проверка бонуса**: Вызвать `hasReceivedWelcomeBonus(userId)` (простой SELECT). Если `true`, сразу возвращаем успех и не запускаем тяжелый CTE запрос.

### 3. Оптимизация `UserService`
В методах `getOrCreateUserBy...` использовать оптимизированные версии репозиториев.

Эти изменения превратят 99% запросов к `/api/tokens` в чистые операции чтения (SELECT), которые к тому же частично кэшируются. Запись будет происходить только один раз при регистрации нового пользователя.

