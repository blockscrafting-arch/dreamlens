# Анализ ошибки NeonDbError: out of memory

## Исходные данные
- Лог файл: `d:\Downloads\logs_result (28).json`
- Ошибка: `NeonDbError: out of memory`
- Stack trace указывает на цепочку вызовов:
  1. `api/tokens/index.ts` (handler)
  2. `api/services/user.service.ts` (`getOrCreateUserByDeviceId`)
  3. `api/services/user.service.ts` (`ensureWelcomeBonus`)
  4. `api/repositories/token.repository.ts` (`ensureWelcomeBonusAtomic`)
  5. `api/utils/metrics.ts`
  6. `api/utils/retry.ts`
  7. `api/repositories/database.ts` (`execute`)

## Гипотезы
1. **Тяжелый запрос**: `ensureWelcomeBonusAtomic` может выполнять запрос, который вытягивает слишком много данных или требует слишком много памяти для выполнения на стороне БД (сортировка, join больших таблиц).
2. **Утечка соединений**: Возможно, соединения не закрываются корректно, хотя serverless драйвер neon обычно это обрабатывает.
3. **Бесконечный цикл/рекурсия**: В логике retry или самом сервисе.
4. **Проблема с транзакциями**: Блокировки или слишком долгие транзакции, накапливающие память.

## Следующие шаги
- Изучить код `api/repositories/token.repository.ts`, особенно метод `ensureWelcomeBonusAtomic`.
- Изучить код `api/services/user.service.ts`.
- Проверить конфигурацию подключения к БД в `api/repositories/database.ts`.

