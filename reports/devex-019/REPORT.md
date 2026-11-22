# DEVEX-019 · Chromium CI та готовність до релізу

База — `main@72cc4d750030a784338d4ebb8e7e653613147f74`. Зміна виконується у браузерному тесті мінімального прикладу. Архітектурний інвентар і спостереження щодо DisableFeatures наведені в [окремому звіті](COVERAGE.md).

## Причина та межі доказів

У [Windows CI на main](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45030047363) збірка публічного прикладу пройшла. Тест прочитав очікуваний текст із DOM, отримав порожній список живих worker і на рядку 38 витратив 30 секунд в очікуванні нової події serviceworker. До history.pushState він не дійшов. Той журнал не містить історії реєстрації worker, тому встановити його точний стан на тому runner неможливо.

Відтворена помилка у передумові тесту: наявність інжектованого модуля не гарантує живого background worker або завершеної реєстрації. Manifest прикладу вказує background.js. Його слухач onHistoryStateUpdated надсилає повідомлення content script, який запускає reSetup. Звичайна інжекція цього повідомлення не надсилає. У фабричному браузерному тесті стартовий probe додатково використовує chrome.runtime.sendMessage, тому його умови відрізняються.

- **Неактивний worker.** Запустили Chromium без підключеного дебагера, простежили появу та зникнення extension worker через список CDP targets, підключили Playwright і відкрили приклад. Content script відобразив DOM при нульовій кількості видимих worker. Пасивне очікування відтворило початковий timeout за 30 014 мс. Один pushState у тому ж документі розбудив worker, замінив DOM-вузол і дав доступ до реального слухача. Це відповідає [життєвому циклу MV3 у Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).
- **Перше встановлення.** На холодному профілі CDP фіксував переходи new → installing → installed → activating → activated, причому ізольований контекст content script уже існував на стадії installing. Експериментальний патч, який лише пересунув перевірку worker після pushState, пройшов п’ять запусків зі збереженим профілем, але впав на очікуванні заміни DOM при холодному старті.
- **Негативний контроль.** У тимчасовій копії розширення залишили manifest і runner, замінили лише background.js порожнім скриптом. Фінальний тест провалився саме на заміні DOM після pushState. Така перевірка виявляє втрату справжньої доставки повідомлення.
- **Межа висновку.** Експерименти зі штучною зупинкою через внутрішній UI та примусовим закриттям CDP target не дали чистого еквівалента звичайного сну. Причинний доказ вище отримано з природною зупинкою. Даних про дефект tarball, runtime чи збій запуску процесу Chromium в цьому інциденті немає.

## Виправлення

[Тест мінімального прикладу](../../tests/minimal-example-browser.cjs) підписується на стани версії до увімкнення CDP ServiceWorker. Він чекає activated для скрипта з Manifest завантаженого розширення, від’єднує сесію, виконує один вимірюваний pushState та перевіряє заміну вузла, кількість елементів і збереження документа. Потім перевіряє слухач у worker за URL тієї самої реєстрації. Межі очікування — 30 секунд. Повтору навігації, штучного пробудження, sleep чи retry у CI-тесті немає. Змін у framework, package, CI workflow та публічному API немає.

## Відтворення та локальні результати

Windows, Node 24.18.0, npm 11.16.0, Playwright 1.56.1 та Chromium 141.0.7390.37 (1194). Документ example.com надає Playwright route. Розширення, інжекція, Chrome API, worker та навігація справжні.

| Перевірка | Результат |
| --- | --- |
| factory-product | 18/18 етапів, зокрема clean build, tsc --noEmit, регресії, lifecycle/DI, React mount/cleanup, URL і Manifest, npm pack, незалежне встановлення, публічні типи та Webpack. 9/9 factory-lifecycle і 15/15 factory-manifest усередині цього прогону. |
| packaging-cleanup | PASS, 59 файлів кандидата, whitelist, відносні source maps, CLI через npm, README та LICENSE. |
| factory-watch | PASS, оновлення inline Manifest, очікувана помилка при конфлікті legacy JSON, відновлена production-збірка, VM-перевірка background. |
| factory-browser | 9/9 у Chromium, включно з реальними повідомленнями, React, DI, cleanup та SPA. |
| npm ci, typecheck і production build у examples/minimal | PASS із публічним devxtension@1.1.0. Це окрема інсталяція від локального tarball у factory-consumer. |
| Початковий тест | 5/5 запусків з однією директорією профілю, 12/12 з новими профілями при звичайному старті. Для надійного відтворення потрібен стан worker, описаний вище. |
| Фінальний тест | 15/15 нових тимчасових профілів (із додатковим знімком CDP targets), 5/5 зі збереженим профілем. Окремо підключили фінальні assertions до Chromium із уже сплячим worker, PASS. Негативний контроль упав як очікувалось. |
| Діагностика та Feature | [idle-worker.cjs](idle-worker.cjs) пройшов з і без --passive-first. [feature-observations.cjs](feature-observations.cjs) пройшов у незалежному процесі Node. |

Відтворення з чистого checkout, PowerShell, послідовність відповідає [verify.yml](../../.github/workflows/verify.yml). Для factory-browser потрібний доступний 127.0.0.2:80.

```powershell
npm ci --prefix devxtension --no-audit --no-fund
node tests/factory-product.cjs
node tests/packaging-cleanup.cjs
node tests/factory-watch.cjs
npm install --prefix .verification/tools --no-audit --no-fund playwright@1.56.1
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PWD '.verification/browser-binaries'
node .verification/tools/node_modules/playwright/cli.js install chromium
node tests/factory-browser.cjs
Copy-Item examples/minimal/.env.example examples/minimal/.env
npm ci --prefix examples/minimal --no-audit --no-fund
npm --prefix examples/minimal run typecheck
npm --prefix examples/minimal run build
node tests/minimal-example-browser.cjs
node reports/devex-019/idle-worker.cjs --passive-first
node reports/devex-019/idle-worker.cjs
node reports/devex-019/feature-observations.cjs
```

Для серії холодних стартів запустити браузерний тест з новою директорією профілю щоразу або з порожнім рядком як userDataDir у локальній діагностичній копії. Для теплої серії повторити тест зі штатною директорією. Діагностика простою використовує окремі профілі під ignored .verification/browser-profile. GitHub Actions виконує штатний тест на свіжому Windows runner.

## Готовність PR #2

[PR #2](https://github.com/Kiril-Hr/extension-2.0/pull/2) відкритий як draft, head `5c7e6d4`. [CI цього head](https://github.com/Kiril-Hr/extension-2.0/actions/runs/43960874760) успішний на попередній базі. Перевірка `git merge-tree --write-tree --name-only 72cc4d7 5c7e6d4` виявила конфлікт у CHANGELOG.md. tests/factory-browser.cjs автомержиться. Обидві гілки залишилися без змін від цієї перевірки.

У PR точна версія перевіряється через npm view перед незалежним npm install. E404/ETARGET дозволяють повторну перевірку, інші помилки завершують її. Номінальний дедлайн — 5 хвилин, окремий запит має timeout 30 секунд, інтервал — 10 секунд. Перевірка часу лише після невдачі дозволяє останній запит за межами номінального дедлайну. Додаткові шляхи до consumer/tarball дозволяють окремо запустити на них браузерну перевірку. Сам verify-published перевіряє інсталяцію, типи, Webpack та Manifest. Доказ доступності вже опублікованої 1.1.0 не перевіряє майбутній реальний перехід від E404 до доступної версії.

**До merge не готовий.** Оновити draft від актуального main, зберегти обидва записи CHANGELOG, перевірити затриману доступність, негайну фатальну помилку та вичерпання часу без нової публікації. Після цього повторити CI на оновленій базі та подати PR на окремий розгляд.

## Межі готовності

Локальний ланцюжок від вихідного коду до Chromium пройдено. Для прийняття зміни звіряти обидва незалежні виконання Windows CI на тому самому SHA. Злиття гілки, перевірка main після злиття та рішення про наступний npm-реліз є окремими кроками. Покриття авторського Meet-прикладу й семантика відновлення ознак лишаються відкритими.
