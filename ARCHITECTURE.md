# Daily: текущая архитектура

Целевая платформа — единая кроссплатформенная PWA для iOS, Android, macOS
и Windows, Safari/Chrome/Edge. Приоритет iPhone и Mac не допускает критической
привязки к Apple API. Интерфейс адаптивен по требованиям для телефона, планшета
и desktop, поддерживает touch, мышь и клавиатуру. Реализация и проверка отдельных
платформ могут отставать от цели; статус — TESTING.md. Правила — PLATFORMS.md.

Frontend: статическая PWA на vanilla JavaScript/HTML/CSS. Хостинг GitHub Pages.
Build/test/dev — Node.js без сторонних зависимостей; runtime Node.js, SSR
и собственные /api-маршруты не нужны.

На устройстве: IndexedDB, локальные настройки и ключ подключения в localStorage.
Офлайн-оболочка — Service Worker + Cache Storage, генерируемые сборкой Pages.
Обновление ждёт закрытия редактора. Это существующая офлайн-основа; её
межплатформенную совместимость ещё нужно подтвердить матрицей проверок.
Установка описывается Web App Manifest; способ установки зависит от платформы.

Специфичные API подключать через проверки доступности и отдельные адаптеры.
Отмена кнопкой/клавиатурой доступна независимо от поддержки встряхивания.
Будущий push предусмотреть через стандартные веб-API и серверную отправку;
отсутствие поддержки или разрешения не блокирует основную работу.

Сервер: GAS V8, аутентификация личными ключами, одноразовое подключение
устройств, Sheets по листу на пользователя, merge по полям, очистка удалённого
после 48 часов и часовой триггер. Реализация и миграции в backend/.

Данные → DailyStore → CloudSync → GAS → Sheets. Интерфейс обращается к
локальному хранилищу; отправка ожидает сеть. Модель и ID сохраняются при merge.

Возможный следующий этап (не реализован): Supabase Auth + PostgreSQL/RLS
и RPC/Edge Functions вместо GAS. Сохранить офлайн-очередь, merge и маркеры
удаления. Решение владельца от 7 ноября: адрес GitHub Pages сохраняется, домен не покупаем.
При возможном будущем переносе помнить: перенос хостинга с тем же origin не меняет установленную
PWA, смена origin требует отдельного переноса/повторной установки и синхронизации.

Один Git-репозиторий в корне daily: frontend в web/, backend и общие документы
отслеживаются вместе. История прежних исходников сохранена. web/pages —
игнорируемый результат сборки; GitHub Actions публикует его без секретов.
Прежнее Notes и устаревшая инфраструктура сохранены только в закрытом private/
как резервная копия; runtime/build-зависимостей от них нет.


## Локальные транзакции и UI-проекции · 6 ноября 2026

persistence.js — тонкая общая очередь для локальных мутаций и применения
ответа sync. atomicStoreMutation делает snapshot records/dirty/Undo/erased
до синхронного mutate, ждёт persist и откатывает при ошибке. Ссылку массива
Undo сохраняет; clock/sequence не перематывает назад. Запрос сети выполняется
вне очереди, применение merge/purge/ack — внутри; перед подготовкой отправки
sync ждёт durable barrier. Это предотвращает rollback поверх более нового merge.
DailyStore, схема/ID/протокол Lamport и backend не менялись. Callback mutate
должен оставаться синхронным; не выполнять сетевые await внутри транзакции.

UI save-handlers закрываются/очищают draft только после успешного результата.
Черновики — account-scoped prefs.uiDrafts, whitelist пользовательских форм,
не более32 последних. Их ключ закреплён за DOM-формой до смены экрана;
неизменённые значения не сохраняются как несохранённые. На delete/purge
черновики соответствующего ID очищаются. Cloud credentials в whitelist нет.

ui-view.js содержит только представления taskScheduleDate/taskCounts,
безопасные HTTPS-ссылки, общий локальный поиск и проверенные акценты.
Наследование даты используется для UI/счётчиков, не переписывает task.date.
Сущности и списки индексируются на один render; между событиями читается
актуальный store. Оба модуля включены в build copy и offline SHELL.
PNG «Хочу» создаётся Canvas локально, без загрузки или отправки данных серверу.

## Данные товаров в «Хочу»
Авторизованный action wish-card принимает только URL, а не личные пометки.
Сервер получает HTML/JSON-LD/OpenGraph, вызывает Anthropic с ограниченным
выводом save_product, проверяет поля и MIME изображения. При недоступном HTML
доступны один web_fetch и один поиск точного артикула. Другой товар не подставляется. Изображение
должно происходить из данных страницы, неизвестные поля остаются пустыми.
API не пишет пользовательские записи: клиент применяет метаданные отдельно,
проверяя актуальность ссылки и отсутствие новых ручных правок.
Ключ DAILY_ANTHROPIC_KEY — только Script Properties; модель можно задать
DAILY_ANTHROPIC_MODEL. Кэш 6ч отдельно для пользователя/URL; максимум 20 новых
запросов в день на пользователя. Ключи аккаунтов и личный текст в Anthropic
не передаются. Ошибка получения данных не мешает локальному добавлению.

## Отдельный браузерный прототип · 6 ноября 2026
services/browser-loader — Node.js + Playwright, loopback HTTP с локальным токеном,
одна страница Chrome за раз. Не включён в статическую сборку и service worker,
не меняет backend и schema. Node runtime нужен только этому экспериментальному
сервису, а не установленной PWA. Интеграции и VPS-развёртывания пока нет.
Описание ограничений и локальной proxy-DNS опции — в README сервиса.

## Linux browser-loader · 7 ноября 2026
Подготовлены deploy/LINUX.md и root-owned шаблон systemd, внешние state/token
каталоги, CLI doctor/smoke. Это подготовка: SSH/deploy и Linux-прогоны не выполнялись.
Loopback API предназначен только будущему backend, не прямому вызову PWA.
Перед произвольными URL нужны отдельные egress-ограничения: URL/DNS policy
в приложении сама по себе не закрывает DNS rebinding/весь трафик браузера.

## Linux deployment report accepted: 2026-11-07
Shared server chat deployed browser-loader 2b382b6 in isolated Linux service.
Active, loopback-only, autostart disabled. Control extraction works; Market/Lamoda
return 403. No frontend/GAS/Supabase/OpenAI integration yet. Project SSH identity
and active/disabled states verified without server changes. See deploy/LINUX.md
in services/browser-loader for actual deployment differences and QA boundaries.

## Supabase foundation - 2026-11-07
Project xvowdgupwymfukhuzkqm now has invite-only Auth configuration, approved
membership, owner-scoped Lamport records and transactional sync RPC. Private
image storage uses per-owner path RLS. Retention hourly; original48h behavior
preserved. Only requested owner provisioned, no real records imported.
Published client still uses GAS/Sheets. Supabase transport/login/cutover remain
separate pending work; browser service is still unconnected to the PWA.
Local SQL tests and staged migration instructions live in backend/supabase/.
