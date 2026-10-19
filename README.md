# geo_man — GeoServer Manager

Веб-менеджер GeoServer: управление подключениями, общая информация о сервере,
слои и стили через REST API GeoServer. Стек — как у брата-проекта
[db_man](https://github.com/gloryvictory/db_man): Express + TypeScript (сервер)
и React 18 + Vite + Tailwind + Zustand (клиент), единый origin.

## Возможности

- **Подключения** — `name, host, port, username, password` (по умолчанию логин
  `admin`, пароль `geoserver`, порт `8080`). Всё сохраняется в SQLite
  (`connections` + `connection_secrets`). При создании выполняется тест
  доступности (`GET /rest/about/version.json`). Подключения привязаны к
  пользователю: каждый видит только свои, администратор — все.
- **Общая информация** — версия GeoServer, дата сборки, Git-ревизия, модули
  (GeoTools, GeoWebCache и др.), счётчики рабочих областей/слоёв/стилей, список
  рабочих областей и распределение слоёв по типу (VECTOR/RASTER/…). Счётчик
  «Рабочие области» — ссылка на отдельную вкладку.
- **Рабочие области** — отдельная вкладка: таблица (имя, изолированность, даты
  создания/изменения) с поиском, обновлением и экспортом в Excel/CSV; клик
  открывает детали (даты, хранилища данных).
- **Хранилища** — таблица хранилищ (data/coverage/wms) по всем рабочим областям:
  имя, рабочая область, вид, формат (PostGIS/Shapefile/…), включено; поиск,
  обновление, экспорт; клик открывает детали (описание, даты).
- **Группы слоёв** — таблица групп слоёв: имя, рабочая область, режим, число
  слоёв; поиск, обновление, экспорт; клик открывает состав группы (слои и стили).
- **Слои** — таблица всех слоёв (имя, рабочая область, тип, стиль по умолчанию,
  ресурс, число доступных стилей) с поиском и экспортом в Excel/CSV; клик по
  строке открывает детали слоя (тип, стиль по умолчанию, доступные стили,
  класс/имя ресурса).
- **Стили** — таблица стилей (имя, рабочая область, формат, версия, файл) с
  поиском и экспортом; включает глобальные стили и стили каждой рабочей области;
  клик открывает окно стиля с кнопкой «Скачать» и закладками «SLD» / «Легенда»
  (превью легенды через WMS GetLegendGraphic); иконка «Скачать» в строке —
  отдельный стиль (.sld), кнопка «Скачать все стили» — все стили одним
  zip-архивом.
- **Темы** — светлая и тёмная, переключение кнопкой в правом верхнем углу
  (выбор сохраняется в `localStorage`).
- **Автоподключение** — при открытии приложение подключается к последней
  использованной конфигурации.
- **Пользователи и роли** — вход по логину/паролю (сессия в HttpOnly-cookie),
  саморегистрация (ФИО, логин, пароль); роли `admin` и `user`; администратор
  управляет пользователями в «Админке» (создание, смена ФИО/пароля/роли,
  удаление; нельзя удалить/понизить последнего администратора).

## Пользователи и доступ

При первом запуске создаётся администратор по умолчанию: **логин `admin`,
пароль `admin`** (ФИО «Администратор»). Смените пароль сразу после входа
(Админка → «Изменить»).

- Пароли пользователей приложения — scrypt-хэш (соль + хэш), сессии — серверные
  с TTL 7 дней.
- Все API-маршруты (кроме `/api/health` и `/api/auth/*`) требуют входа.

## Безопасность

- Пароль подключения GeoServer хранится в SQLite (`connection_secrets`) и
  **никогда не возвращается** через API — только признак `hasPassword`.
- Запросы к GeoServer идут через `server/src/geoserver.ts` (Basic Auth);
  имена слоёв/стилей из URL экранируются `encodeURIComponent`.

## Стек

**Сервер** (`server/`, Express + TypeScript): `express`, `node:sqlite`,
`cors`, `dotenv`, `tsx`; REST-клиент GeoServer на глобальном `fetch`.

**Клиент** (`client/`, React + Vite): `zustand`, `lucide-react`,
`react-hot-toast`, `react-router-dom`, `xlsx` (экспорт), `tailwindcss`,
собственные компоненты (`components/ui.tsx`).

## Запуск

Требуется Node.js ≥ 22.13 (для `node:sqlite`).

```bash
npm install
npm run dev        # сервер :3002 + клиент :5174
```

Откройте http://localhost:5174, добавьте подключение
(host / port / username / password). По умолчанию GeoServer слушает `8080`,
логин `admin`, пароль `geoserver`.

## Конфигурация

`config.json` в корне:

```json
{
  "server": { "host": "127.0.0.1", "port": 3002, "sqlitePath": "./data/geoman.db" },
  "client": { "host": "127.0.0.1", "port": 5174, "apiProxy": "http://127.0.0.1:3002" }
}
```

Переменные окружения (`HOST`, `PORT`, `SQLITE_PATH` — шаблон в
`server/.env.example`) переопределяют значения из `config.json`.

## Структура

```
geo_man/
├── AGENTS.md            # правила работы с репозиторием
├── package.json         # workspaces: server + client
├── config.json
├── server/
│   └── src/
│       ├── index.ts     # точка входа (Express)
│       ├── config.ts
│       ├── sqlite.ts    # node:sqlite (пользователи, сессии, подключения, аудит)
│       ├── auth.ts      # scrypt + cookie-сессия, requireAuth/requireAdmin
│       ├── geoserver.ts # REST-клиент GeoServer (Basic Auth)
│       └── routes/      # connections, info, layers, styles, auth, users
└── client/
    └── src/
        ├── store.ts     # zustand
        ├── api.ts
        ├── types.ts
        ├── components/  # Topbar, LoginScreen, ConnectionModal, AdminPanel, ui
        └── pages/       # Overview, Workspaces, Stores, LayerGroups, Layers, Styles
```

## API

| Метод | Путь | Назначение |
|-------|------|------------|
| POST | `/api/auth/login` | вход (`{login, password}`) → сессионная cookie |
| POST | `/api/auth/register` | саморегистрация (`{fio, login, password}`) |
| POST | `/api/auth/logout` | выход |
| GET | `/api/auth/me` | текущий пользователь |
| GET | `/api/users` | список пользователей (админ) |
| POST | `/api/users` | создать пользователя (админ) |
| PUT | `/api/users/:id` | изменить пользователя (админ) |
| DELETE | `/api/users/:id` | удалить пользователя (админ) |
| GET | `/api/connections` | список подключений |
| POST | `/api/connections` | создать (+тест доступности) |
| PUT | `/api/connections/:id` | изменить подключение |
| DELETE | `/api/connections/:id` | удалить подключение |
| POST | `/api/connections/:id/test` | проверить доступность |
| GET | `/api/connections/:id/info` | общая информация о GeoServer |
| GET | `/api/connections/:id/layers` | список слоёв (с деталями) |
| GET | `/api/connections/:id/layers/analytics` | аналитика по слоям (проекция, хранилище, хост/порт/БД/схема/пользователь, нативный SRS) |
| GET | `/api/connections/:id/layers/:name` | детали слоя |
| GET | `/api/connections/:id/styles` | список стилей (с деталями, глобальные + по рабочим областям) |
| GET | `/api/connections/:id/styles/:name` | детали стиля + SLD (`name` может быть `workspace:name`) |
| GET | `/api/connections/:id/styles/export` | zip всех стилей (глобальные + по рабочим областям) |
| GET | `/api/connections/:id/styles/:name/legend` | легенда стиля (PNG, WMS GetLegendGraphic) |
| GET | `/api/connections/:id/workspaces` | список рабочих областей (с деталями) |
| GET | `/api/connections/:id/workspaces/:name` | детали рабочей области + хранилища данных |
| GET | `/api/connections/:id/stores` | список хранилищ (data/coverage/wms) с деталями |
| GET | `/api/connections/:id/layergroups` | список групп слоёв (режим, слои, стили) |
