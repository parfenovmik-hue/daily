# Daily

Кроссплатформенная PWA для iOS, Android, macOS и Windows. Приоритет — iPhone
и Mac. Vanilla JS/HTML/CSS, IndexedDB, Service Worker; GAS + Google Sheets
для синхронизации. Supabase — будущий этап.

Приложение: https://parfenovmik-hue.github.io/daily/
Репозиторий: https://github.com/parfenovmik-hue/daily

## Работа из корня
Нужен Node.js >=22.13. Frontend не требует сторонних npm-пакетов.
Отдельный экспериментальный браузерный сервис использует Playwright.

```sh
npm run dev
npm run check
npm test
npm run build
```

Preview: http://127.0.0.1:8801, без внешней синхронизации. Тесты — только
синтетические. Подробности web/README.md.

## Структура
- web/public/ — действующий frontend.
- web/scripts/ и web/tests/ — сборка и проверки.
- web/pages/ — генерируемая оболочка, не редактировать и не коммитить.
- backend/ — GAS и планы миграций; локальные секреты исключены из Git.
- private/ — закрытые ключи, backups и архив выведенного из работы Notes.
- AGENTS.md — общие правила разработчика и Design Lead.
- DESIGN.md — единый утверждённый дизайн, PRODUCT.md — продукт.
- PLATFORMS.md, ARCHITECTURE.md, TESTING.md, BACKLOG.md — общие документы.

Обе постоянные сессии открывают эту папку в Local и работают по очереди.
При старте проверять Git и документы; при передаче фиксировать результат.
Папка самостоятельна, зависимости от прежнего каталога Notes нет.

## Публикация
В main хранятся исходники и документация; workflow .github/workflows/pages.yml
проверяет проект и публикует только web/pages. GAS обновляется отдельно по
существующей локальной привязке, только clasp --user daily и по заданию.
Ключи, реальные данные и резервные копии не публикуются.

## Локальный загрузчик товаров
Необязательный прототип в services/browser-loader; инструкции и результаты —
[services/browser-loader/README.md](services/browser-loader/README.md).
Не подключён к рабочим данным или PWA; требует отдельного Node.js процесса.
