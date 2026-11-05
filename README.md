# Трекер финансов

Мобильное приложение для учёта денег: активы (карты, наличные, накопления), пополнения и расходы — у каждого типа свой набор категорий, — общий бюджет, история и разбивка по категориям.

- `backend/` — API на Go, данные в SQLite (без внешних сервисов).
- `mobile/` — приложение на React Native (Expo, Expo Router).
- Дизайн: [Figma «Трекер финансов»](https://www.figma.com/design/j1p3HtRLwAXDcsnT8rGpyK).

## Что нужно установить

```bash
brew install go node
```

На iPhone — приложение **Expo Go** из App Store (телефон и Mac в одной Wi‑Fi сети).
Для iOS‑симулятора дополнительно нужен Xcode.

## Запуск

Бэкенд (слушает порт 8080, база — файл `backend/guap.db`):

```bash
cd backend && go run ./cmd/server
```

Приложение (в другом терминале):

```bash
cd mobile && npm install && npx expo start
```

Отсканируйте QR‑код камерой iPhone — откроется Expo Go. Приложение само обращается к порту 8080 на том Mac, где запущен Expo. Другой адрес API можно задать переменной `EXPO_PUBLIC_API_URL`.

## Тесты

```bash
cd backend && go test ./...
cd mobile && npx tsc --noEmit
```

## API

Все суммы — целые числа в копейках. Даты — RFC 3339.

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/api/summary?from=&to=` | Общий бюджет, число активов, пополнения и расходы за период |
| GET | `/api/assets` | Активы с балансами |
| POST | `/api/assets` | Создать актив: `name`, `icon`, `color`, `initial_balance` |
| GET | `/api/assets/{id}` | Один актив |
| DELETE | `/api/assets/{id}` | Удалить актив вместе с его операциями |
| GET | `/api/transactions?asset_id=&type=&category=&from=&to=&limit=&offset=` | История, новые сверху |
| POST | `/api/transactions` | Добавить операцию: `asset_id`, `type` (`income`/`expense`), `amount`, `category` (обязательна; категория того же типа, что и операция), `comment`, `occurred_at` |
| DELETE | `/api/transactions/{id}` | Удалить операцию |
| GET | `/api/stats/categories?type=expense\|income&from=&to=` | Расходы или пополнения по категориям за период (по умолчанию расходы) |
| GET | `/api/categories?type=` | Категории расходов и пополнений с числом операций |
| POST | `/api/categories` | Создать категорию: `type`, `name`, `icon`, `color` |
| PUT | `/api/categories/{id}` | Изменить название, иконку и цвет (тип менять нельзя) |
| DELETE | `/api/categories/{id}` | Удалить категорию; её операции остаются без категории |

Начальный баланс актива записывается в историю как пополнение с `is_initial: true`; в сумму пополнений за месяц он не входит.

Категории хранятся в базе и редактируются пользователем; при создании базы добавляются стандартные. Схема базы обновляется автоматически при запуске сервера (миграции в `backend/internal/store/store.go`, версия хранится в `PRAGMA user_version`).
