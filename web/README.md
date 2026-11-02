# Daily — действующий frontend

Единая PWA для iOS, Android, macOS и Windows с приоритетом iPhone и Mac.
Адаптивность, Safari/Chrome/Edge, touch/мышь/клавиатура, установка и различия
платформ — требования ../PLATFORMS.md. Фактические проверки — ../TESTING.md.

Vanilla JavaScript, HTML и CSS. React, Next.js, Cloudflare, D1, ChatGPT Auth
и их npm-зависимости вынесены из проекта. Собственный Node.js-сервер
для пользователей не требуется; backend — ../backend/Code.gs.

## Локальная работа

Нужен Node.js >=22.13.0. Сторонних npm-пакетов нет; npm ci необязателен.
Из этой папки:

```sh
npm run build
npm run check
npm test
npm run dev
```

Preview: http://127.0.0.1:8801 (другой порт: npm run dev -- --port 8802).
Сервер отдаёт только app-shell из pages/, не исходники, Git или секреты.
CSP блокирует внешние соединения, включая рабочую синхронизацию. Использовать
только синтетические данные и отдельный localhost-origin. Обычный localhost
не регистрирует Service Worker; его логика отдельно проверяется тестом
с опубликованной Pages-оболочкой. Не включать sync на локальном preview.

check проверяет синтаксис JS/GAS, локальные импорты и manifest. Старый
typecheck относился к удалённому TypeScript/Next.js, теперь его нет.
test сначала собирает pages/, затем запускает тесты без внешних API.

## Состав

public/daily.js — UI и действия; model.js — модель и merge полей; store.js —
IndexedDB и очередь изменений; cloud.js — авторизованный GAS transport;
server-config.js — публичный адрес сервера без ключей; wish-input.js — быстрый
ввод без ИИ; pickers.js/motion.js — выбор значений и анимации; updater.js —
безопасное обновление открытой PWA.

scripts/build-pages.mjs копирует актуальные ресурсы и генерирует index.html,
manifest.webmanifest и sw.js в pages/. Это единственная действующая сборка.

## Данные

Данные сохраняются в IndexedDB daily-independent-v1. Каждое поле имеет
логические часы и actor; изменения отправляются в GAS и объединяются по полям.
Приглашение/подключение — личный ключ и короткий одноразовый код устройства.
Реальные ключи и резервные копии находятся в ../private/, не во frontend.
Изменения схемы и хранения описывать в ../backend/MIGRATIONS.md.

## Публикация

Единый Git находится в корне daily и связан с parfenovmik-hue/daily.
web/pages — результат сборки, отдельного Git здесь больше нет. GitHub Actions
из main выполняет проверки и публикует только web/pages на прежний URL.
Backend публикуется отдельно по ../backend/.clasp.json, только clasp --user daily.
Перед выпуском менять VERSION/CACHE и проверять SW update. Секреты не коммитить.
