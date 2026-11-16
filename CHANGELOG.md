# DevEx 2.0 — журнал перевірок і виправлень

Дата початку: 2026-10-29.

## Правила роботи
- Архів `extension-2.0-main.zip` — недоторканий еталон.
- Будь-які зміни спочатку в окремій робочій копії; зберігати diff/patch та тест.
- Не змінювати архітектуру без підтвердження початкового задуму автора.
- Статуси: **підтверджено тестом**, **локальний патч**, **відкрита проблема**, **гіпотеза**.
- Зелений результат тесту означає, що тест підтвердив очікуване спостереження, не обов'язково що функція працює.

## Зафіксовані локальні патчі (не внесені до оригінального архіву)

### DEVEX-001 — передавання параметрів vanilla
- Файл: `devxtension/src/core/providers/ModuleProvider.ts`.
- Причина: `adaptParams` очікує вкладене `vanilla`, а виклик передає розгорнуті поля.
- Статус: локальний патч `module_provider.patch`; базовий запуск після патчу пройшов у Node-тесті.

### DEVEX-002 — необов'язковий vanilla у reactive-модулях
- Файл: `devxtension/src/core/decorators/ModuleDecorator.ts`.
- Причина: `setup()` читає `vanilla.executors` без перевірки існування vanilla.
- Статус: локальний патч `module_decorator.patch`; базові Node-тести пройшли.

## Відкриті питання (ще НЕ виправлено)

### DEVEX-003 — повторна ініціалізація і DI
- Спостереження: `reSetup()` очищає реєстр DI, після чого нові звернення до сервісів можуть падати.
- Статус: підтверджено ізольованими Node-тестами; потрібна перевірка початкової семантики `reSetup()` перед змінами.

### DEVEX-004 — дублювання зовнішніх підписок
- Спостереження: повторний запуск тестового модуля реєструє ще одну зовнішню підписку.
- Статус: підтверджено на тестовому mock; не доведено як універсальний дефект фреймворку. Потрібно визначити відповідальність за cleanup.

### DEVEX-005 — конфлікти назв сервісів
- Спостереження: два класи сервісів з однаковим `class.name` конфліктують при реєстрації.
- Статус: підтверджено тестом; спосіб виправлення не погоджений.

### DEVEX-006 — URL hostname
- Спостереження: перевірка домену може прийняти чужий hostname.
- Статус: підтверджено source smoke test; патч не підготовлений.

## Обмеження тестів
- Використовувався Node.js + TypeScript transpile/mock, не реальний Chrome.
- React та повний reactive UI не перевірені.
- `dist` може не відповідати актуальному `src`.

## Наступні кроки
1. З'ясувати призначення `reSetup()` за оригінальним кодом і конфігурацією global/URL-модулів.
2. Створити постійну робочу копію, перенести лише перевірені патчі та запускати регресійні тести після кожної зміни.
3. Фіксувати нові зміни тут і в окремих patch-файлах.

## 2026-10-29 — накопичувана робоча копія v0.1

### DEVEX-003 — виправлено локально, 5/5 регресійних тестів
- `devxtension/src/core/coreModule/ExtensionCoreModule.ts`: прибрано виклик `dependencyContainer.reSetup()` з `ExtensionCoreModule.reSetup()`.
- Підстава: декоратори реєструють singleton-сервіси під час оголошення класів, тому очищення DI під час зміни конфігурації маршруту робило ці сервіси недоступними. Зберігаємо поточний контейнер і створюємо нові екземпляри модулів.
- **Компроміс:** стан сервісів залишається між `reSetup()`; це відповідає коментарю в оригінальному контейнері про загальні widgets, але потребує підтвердження на реальному extension lifecycle. Старі зовнішні підписки не прибираються — DEVEX-004 лишається відкритим.
- Регресія: `DevEx2_work/tests/regression.cjs`, результати `results.json`: 5 PASS.
- Патч: `patches/DEVEX-003.patch`.

### Інші зміни робочої копії
- DEVEX-001, DEVEX-002 застосовано до вихідного TypeScript у накопичуваній робочій копії; оригінальний ZIP не змінено.
- DEVEX-004/005/006 залишено без змін: автоматично не вводимо новий lifecycle API, інший DI keying або URL semantics без додаткових перевірок.

## 2026-10-29 — робоча копія v0.2

### DEVEX-004 — необов’язковий cleanup життєвого циклу
- `devxtension/src/core/coreInterfaces.ts`: додано необов’язковий `Module.teardown?(): void`.
- `devxtension/src/core/coreModule/ExtensionCoreModule.ts`: перед заміною модулів у `reSetup()` викликається `module.teardown?.()`.
- Старі модулі без цього методу працюють без змін. Ресурси автоматично не відстежуються: автор модуля має реалізувати cleanup.
- Патч `patches/DEVEX-004.patch` порівняно з v0.1.
- Тести `tests/lifecycle_cleanup.cjs`: 5/5 PASS; попередня регресія `tests/regression.cjs`: 5/5 PASS.
- **Застереження:** cleanup викликається тільки при `ExtensionCoreModule.reSetup()`, а не при вивантаженні вкладки; асинхронний teardown не очікується. У разі винятку teardown повторна конфігурація переривається. Реальний браузер не тестувався.
- **DEVEX-005/006** лишаються відкритими.

## 2026-10-29 — робоча збірка №3

### DEVEX-005 — діагностика конфліктів ключів DI
- `dependencyContainer.ts`: якщо два різні класи мають той самий ключ, тепер явна помилка замість тихого використання першого екземпляра. Повторна реєстрація того самого класу не змінюється.
- Це **не підтримка двох однойменних сервісів**: для неї треба окремо змінювати ідентифікацію сервісів у всіх споживачах DI.
- Патч `patches/DEVEX-005.patch`; нові тести `tests/service_collisions.cjs` — 4/4; регресія 10/10.
- Оригінальний архів не змінено.

## 2026-10-29 — робоча збірка №4

### DEVEX-006 — коректне зіставлення URL
- `devxtension/src/core/commonUtils/checkURL.utils.ts`: замість `currentUrl.includes(...)` використовується розбір URL на протокол, hostname, порт та pathname.
- Збережено приклад `https://meet.google.com/*`, додано коректну обробку завершального `*` у шляху і `*.example.com` для піддоменів.
- Запобігає помилковим збігам на кшталт `meet.google.com.evil.org` та імені домену в query string.
- Тести: `tests/url_routing.cjs` — 13/13 PASS; попередні `regression.cjs`, `lifecycle_cleanup.cjs`, `service_collisions.cjs` — PASS.
- Патч: `patches/DEVEX-006.patch`.
- Обмеження: query/hash не беруть участі в зіставленні; повноцінні довільні glob-шаблони не реалізовано; перевірка в реальному Chrome ще потрібна.

## 2026-10-29 — робоча збірка №5

### DEVEX-007 — прибрано невикористані типи Vue і Svelte
- `devxtension/tsconfig.json`: `compilerOptions.types` змінено з `["react", "svelte", "vue"]` на `["react"]`.
- React збережено, бо використовується в реалізації; Vue та Svelte наразі не імпортуються.
- Це зміна конфігурації, а не реалізації фреймворку.
- Повна TypeScript-компіляція потребує встановлених залежностей і поки не підтверджена.
- Патч: `patches/DEVEX-007.patch`.

## 2026-10-29 — робоча збірка №6

### DEVEX-008 — React компоненти передаються рендереру
- `ReactComponent.ts`: замінено невикористаний результат `createPortal()` на `createRoot(container).render(createElement(component))`. Контейнер, як і раніше, додається до `document.body`; публічний API фабрики не змінюється.
- Відмовилися від випадкового DOM id: React root не потребує його, а випадковий діапазон 1–1000 міг давати колізії.
- Тест `tests/react_mounting.cjs` перевіряє виклики монтування двох компонентів **з моками React**, не підтверджує фактичний браузерний рендеринг.
- **Відкрито:** відсутнє відмонтування React roots під час `reSetup()`; інтеграція з lifecycle потребує окремого аналізу. Повний `tsc` і браузерна перевірка блокуються відсутніми npm-пакетами.
- Патч: `patches/DEVEX-008.patch`. Оригінальний ZIP не змінено.

## 2026-10-29 — робоча збірка №7

### DEVEX-009 — очищення React roots при завершенні модуля
- `ReactComponent.ts` повертає `cleanup()` для всіх змонтованих React roots; викликає `unmount()` та видаляє DOM-контейнери.
- `ReactiveComponentFactory.ts` повертає функцію очищення, якщо адаптер її підтримує.
- `ModuleDecorator.ts` зберігає cleanup та викликає його через наявний `teardown()`; збережено можливість виклику `teardown()` базового класу. Лічильник покоління захищає від запізнілого завершення асинхронного імпорту після teardown.
- Новий тест `tests/react_cleanup.cjs` перевіряє очищення двох roots через моки React. Попередні п'ять наборів тестів проходять.
- Обмеження: справжній React DOM і Chrome ще не перевірені; npm-залежності не встановлені повністю.
- Патч: `patches/DEVEX-009.patch`. Оригінальний ZIP не змінено.

## 2026-10-29 — інтеграційний аудит збірки №7 (без змін вихідного коду)
- Повторно запущено всі шість наявних тестових наборів — PASS.
- `tsc --noEmit` зупиняється на TS2688 (відсутні типи React); це не підтверджує відсутність інших помилок.
- `tests/integration_contract.cjs`: два позитивні сценарії PASS; суміщення `vanilla` та `reactiveScripts` в одному модулі FAIL через явну заборону у валідаторі. Рішення щодо контракту не прийняте, код не змінено.
- Деталі: `reports/INTEGRATION_AUDIT_07.md`.


## DEVEX-010 — TypeScript declaration compatibility (2026-10-29)
- Fixed TS4094 introduced by DEVEX-009: `reactiveCleanup` and `reactiveGeneration` in the decorator-returned class are now public, without changing runtime behavior.
- Patch: `patches/DEVEX-010.patch`.
- Rechecked seven existing test suites: all passed.
- Full TypeScript compilation remains blocked by missing `react` type definitions (TS2688); package folders are empty after incomplete dependency installation.
- Chromium binary is present, but a current Chrome extension build and browser integration test have NOT yet been completed.

## DEVEX-011 — генерація Manifest і background (збірка №9)
Джерело manifest: extensionConfig.json; виправлено URL injection, MV3 navigation listener, перевірки генератора. Деталі: reports/BUILD_PIPELINE_FIX_11.md.

## 2026-10-29 — DEVEX-012–016: перевірений npm → Chrome ланцюжок

### DEVEX-012 — чиста TypeScript-компіляція та публічні експорти
- Прибрано експорти відсутніх типів; усі наявні coreInterfaces доступні з пакета. Відновлено GeneralServiceInterface, який використовують наявні вихідні приклади.
- У tsconfig підключено встановлені типи Node/Chrome; React-фабрика повертає undefined замість void у неактивній гілці.
- Типи Manifest URL приймають звичайні http/https/file/ftp match patterns замість випадкових літеральних regex-рядків. Споживач перевіряє ManifestParams без any.
- Повна компіляція src (включно з src/test), декларації та незалежний typecheck споживача пройшли.

### DEVEX-013 — збірка, npm та CLI
- Clean видаляє лише власний dist і не маскує помилок; prepack збирає поточний код.
- CLI запускає webpack-cli через Node/require.resolve, коректно повертає помилки та невідомі команди.
- Webpack підтримує React TSX, знаходить власні Babel-залежності, допускає відсутність необов'язкових assets; dev watch оновлює manifest/background на кожній компіляції.

### DEVEX-014 — наявні контракти ядра
- Необов'язковий widgets у фабриці, правильний this екземпляра widget, widgets реактивних модулів, виключення constructor зі списку executor-методів.
- Класи mainService беруться з DI, передані екземпляри використовуються без пошуку за відсутнім name.
- getService зберігає підтримку constructor-типів, підтримує тип екземпляра й має коректне значення за замовчуванням для наявних споживачів без generic.
- Взаємовиключність vanilla/reactiveScripts збережена й діагностується явно. Невалідний percent escape URL повертає false.

### DEVEX-015 — Manifest V3 без зміни runtime-семантики
- URL збираються через TypeScript AST із вкладених файлів, включно з локальними константами; непідтримувані вирази завершують збірку явною помилкою.
- Окремий конвертер генерує Chrome patterns, root exclusions та query-варіанти точних шляхів. Runtime-перевірки збережено; background використовує ту саму скомпільовану функцію checkUrl.
- Явні недефолтні порти та неперетворювані шаблони відхиляються; обмеження портів і накладання root exclusions повідомляються через build diagnostics.
- Збережено custom content_scripts/icon; не генеруються null icons. host_permissions не розширюються; webNavigation додається лише для URL updater.

### DEVEX-016 — інтеграція та докази
- Чистий build → npm pack → свіже незалежне встановлення tgz → TypeScript споживача → production Webpack → справжній Chrome for Testing 151.0.7922.34: PASS.
- Перевірено React DOM/unmount, teardown/reSetup, спільний DI, пізній async import, Chrome messaging/storage і SPA navigation. Окремо перевірено Chrome matching згенерованих patterns.
- Тести джерел/React-моки, VM із Chrome API stubs і реальний браузер явно розділені. Старий mock uglify-js прибрано.
- Збережено звіт reports/DEVEX_2_FINAL_VERIFICATION.md, журнали reports/verification/, патч patches/DEVEX-012-016.patch та локальний Git-коміт.
- Оригінальний ZIP не змінено; SHA256: a81bba2f72e384223d17b2cf8b065370cc467cbb48e4f0ed7ffd1c761d4900ef.

## 2026-10-30 — видима демонстрація розширення
- Повторно виконано production build незалежного consumer через devex-scripts build: PASS.
- Додано scripts/open-demo.cjs: локальна демосторінка і видимий Chrome for Testing з окремим профілем, кнопками cleanup/reSetup/SPA та вкладкою extensions.
- Підтверджено React + DI 1 і background messaging ok; журнали та screenshot: reports/verification/visible-demo.*.
- Код фреймворку не змінювався.

## 2026-10-30 — DEVEX-017: завершення авторського API фабрики
- За узгодженням автора збережено curried syntax та автозапуск; додано optional lifecycle controller через наявний Core.
- Global widgets/custom manifest modules: одноразовий setup, optional route reSetup, фінальний teardown. Shared DI widgets мають одного активного initializer і cleanup останнього owner.
- params.manifest тепер використовується для static build і runtime; legacy JSON конфлікти явні, executable manifest data не виконується.
- SPA у живому content context виконує reSetup без tab reload/DI reset; перша ін'єкція має reload fallback.
- Повний незалежний consumer через фабрику, strict TypeScript, fresh npm pack/install, watch та Chromium 151.0.7922.34: PASS.
- Авторські src/test і наявні незбережені зміни не перезаписано. Деталі: reports/factory-api-audit-2026-10-30/FINAL_REPORT.md.

## 2026-10-30 — видима демонстрація повної фабрики
- Додано scripts/open-factory-demo.cjs для вже перевіреного factory-consumer; код фреймворку не змінювався.
- Відкрито видимий Chrome for Testing: widgets, customManifestModules, vanilla, React і DI запускаються через публічну фабрику.
- Панель показує lifecycle та дозволяє вручну перевірити reSetup, teardown, restart і SPA. READY та відсутність pageerror перевірено; screenshot/log збережено.
# 1.1.0 release candidate — 2026-11-16

- Prepare the verified factory integration for the existing GitHub repository, preserving its history and source layout.
- Add PR regression/browser gates and a manual npm OIDC release workflow with post-publication consumer checks.
- Set candidate package version to 1.1.0; preserve public API and dependencies.
- Enforce LF for the CLI shebang so npm installation preserves verified package bytes on Windows.
- Stop tracking stale generated dist; clean build and prepack regenerate npm output.
- Publication remains pending npm trusted publisher configuration, successful checks and approved PR merge.

