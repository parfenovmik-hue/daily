# Daily browser-loader: передача для Linux

Статус: подготовлено, НЕ развёрнуто и НЕ проверено на Linux.
Исходная инструкция прочитана: server-operations/DAILY_SERVER_HANDOFF.md общего серверного чата.
Рабочий frontend остаётся GitHub Pages, адрес не меняется; собственный домен не нужен.
Существующие GAS/Sheets и данные не меняются. Supabase/OpenAI — отдельные этапы.

## Согласуемые параметры (пока шаблон)

- Отдельный непривилегированный пользователь/группа daily-browser.
- Только файлы этого сервиса из services/browser-loader → /opt/daily-browser.
- Состояние /var/lib/daily-browser, кэш Chromium /var/cache/daily-browser/ms-playwright.
- Порт-кандидат 127.0.0.1:8841, занятность проверяет серверный чат.
- Node.js >=22.13 (рекомендуется поддерживаемая 24 LTS); npm ci, Playwright 1.64.1 из lockfile.
- Linux с поддержкой данной версии Playwright; ориентир Ubuntu 24.04 x86_64/arm64.
- Chromium без root, sandbox обязателен, одна задача одновременно, 2 GiB RAM, CPUQuota=100% (одно ядро), TasksMax=256 — предварительные лимиты.
- Диска 2–3 GiB для runtime/браузера с запасом, артефакты отдельно ограничены 20 PNG.
- SSH-ключ, пути, unit и права выдаёт общий серверный чат. Ничего не установлено автоматически.

## Установка: выполнять только после выделения ресурсов

Команды описывают действия администратора, не являются просьбой запускать их сейчас.
В /opt/daily-browser размещается содержимое каталога browser-loader, НЕ весь Daily и НЕ private/ с Mac.
Код и node_modules после установки должны быть недоступны на запись runtime-пользователю.
Перед любыми изменениями общий чат делает свой backup; не трогает другие проекты.

1. Проверить ОС/архитектуру, Node, свободные RAM/диск/порт; подготовить каталог и пользователя.
2. В каталоге сервиса `npm ci`. Системные библиотеки браузера ставит администратор через
   `./node_modules/.bin/playwright install-deps chromium` после проверки списка изменений apt.
3. От имени daily-browser скачать только Chromium:
   `PLAYWRIGHT_BROWSERS_PATH=/var/cache/daily-browser/ms-playwright ./node_modules/.bin/playwright install chromium --no-shell`.
   Linux использует channel=chromium (новый headless), а не личный Chrome/профиль Mac.
4. Создать /etc/daily-browser/service.env по service.env.example; файл не должен быть изменяем runtime-пользователем.
   Секрет связи: криптографические 32 случайных байта в hex, отдельный файл /etc/daily-browser/token,
   владелец root:daily-browser, права 0640, родительский каталог 0750.
   НЕ печатать секрет, не вставлять в чат, не копировать существующий runtime-токен с Mac.
5. Проверить template daily-browser.service: путь Node, пользователя, порты и лимиты.
   unit-файл принадлежит root, runtime-пользователь его не редактирует.
   Проверить `systemd-analyze verify` перед установкой/запуском.
6. Проверить doctor от имени пользователя с теми же переменными, затем unit в тестовом режиме.
   На некоторых Linux/AppArmor нужно отдельно разрешить user namespaces именно Chromium;
   не отключать sandbox, AppArmor глобально или NoNewPrivileges ради запуска.

## Проверки и критерии приёмки

Сначала синтетика (не использует API, базу, аккаунты или внешний магазин):

```sh
npm test
npm run doctor
```

doctor действительно запускает браузер с chromiumSandbox=true, создаёт DOM и закрывает браузер.
Тесты HTTP запускают отдельный localhost процесс/временное состояние и удаляют только его файлы.
Проверяют 401 без токена, 403 чужому Origin, 415 не-JSON, 400 ошибочному JSON/локальным URL,
413 слишком большому телу, 429 конкурентному запросу, SIGTERM и удаление runtime-конфига.

После старта systemd от имени daily-browser с DAILY_READER_STATE_DIR=/var/lib/daily-browser:

```sh
npm run smoke
npm run smoke -- 'https://market.yandex.ru/card/3d-videopleyer-videoshar-s-khrustalnym-sharom-video-zvukom-diametr-7-sm/4745854146'
npm run smoke -- 'https://www.lamoda.ru/p/rtlafm604901/clothes-adidasoriginals-bryuki-sportivnye/'
```

smoke читает runtime-конфиг, не печатает токен/тексты пользователя. По умолчанию проверяет
контрольную книгу A Light in the Attic: title/image/price. Любой blocked/unrecognized/unavailable
или недостающее поле даёт ненулевой exit. Успешное чтение не гарантирует корректную цену:
нужно смотреть PNG, источник и условия (Пэй/подписка/регион). Не выдавать HTTP200 API за успех товара.
Сделать 3 последовательных прогона и проверить отсутствие оставшихся процессов после остановки,
RSS/CPU/systemd MemoryPeak, освобождение браузера после 60с простоя, рестарт и повторный smoke.
HTTP /shutdown на Linux отключён: останавливать только своей службой systemd.
Предел задачи 40с; при зависании процесс завершается с ошибкой, systemd должен убрать cgroup и перезапустить.

## Граница безопасности: до чтения произвольных сайтов

DNS/URL policy проверяет каждый перехваченный запрос и redirect, запрещает private/metadata/literal IP,
нестандартные порты, сервис-worker, WebSocket, downloads. Это НЕ полноценная сетево-изолированная среда:
между DNS-проверкой Node и соединением Chromium возможен DNS rebinding, у браузера есть другие
сетевые механизмы. Нельзя заявлять полноценную SSRF-защиту по unit-тестам.

До доступа к произвольным URL общий чат должен обеспечить ограничение egress для выделенной службы
(сетевой namespace/фильтр пользователя/cgroup или проверяющий proxy): запрет loopback/private/link-local,
metadata, IPv6 служебных/туннельных диапазонов и собственных публичных адресов VPS в исходящих
соединениях браузера. DNS — только доверенный resolver, пользовательский трафик к публичным HTTPS.
Правила не должны затронуть ботов/Finance. Отдельно проверить redirects, subresources и DNS rebinding
в этой реальной изоляции. Пока этого нет — только согласованные контрольные сайты и синтетика.
DAILY_READER_PROXY_DNS=1 на Linux запрещён кодом, никаких исключений 240/4 на VPS.

Сервис слушает исключительно localhost. Не публиковать /extract, /shutdown, токен, CDP или Playwright
server в Интернет. Нужен отдельный backend/gateway: проверка пользователя, квоты, HTTPS, анонимный
доступ запрещён. Этот этап пока не реализован. Endpoint и способ HTTPS определяет общий чат;
покупка собственного домена/перенос frontend НЕ предполагаются. CORS не расширять под браузер PWA.

## Эксплуатация и откат

Секрет задаётся файлом, переживает restart; runtime connection.json обновляется и имеет 0600.
В backup включать код/lockfile, unit/env и секрет по правилам общего чата; PNG/browser cache исключать.
Журнал не должен содержать Bearer/полный запрос пользователя. Есть только локальный /health,
это liveness Node, не доказательство готовности Chromium: для readiness использовать doctor/smoke.
Нет очереди с сохранением: занятый сервис возвращает 429, повтором управляет будущий обработчик.
Откат — остановка только daily-browser.service и возврат его предыдущей версии; боты/GAS не трогать.
Сначала не включать автозапуск, пока проверки и rollback не выполнены.

Источники установки: https://playwright.dev/docs/browsers ; sandbox: https://playwright.dev/docs/docker .
