# Twenty Forkop UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Execution update: the user's acceleration instruction authorized isolated parallel
Task 5/6 file ownership and one integrated final gate. Task 7's scoped quality
check and the whole-branch review use one final whole-branch review; repeat only
checks affected by a new fix or failure. Individual workers retain their assigned
scope and do not publish, merge or deploy.

**Goal:** Deliver all 20 approved research improvements with Extended preserved and verified UI/build.

**Architecture:** Extend the existing native section model with direct task adapters and shared trustworthy results. Add narrow, secret-free read APIs only for authoritative previews and capability evidence; keep existing writes transactional.

**Tech Stack:** TypeScript, native DOM/LuCI forms, ucode, Vitest/happy-dom, shell/Python fixtures.

**Spec:** docs/superpowers/specs/2026-10-25-twenty-ux-improvements.md

## Global Constraints

- Preserve all six sources: links, subscriptions, VPN interfaces, JSON, URLTest and Priority; preserve cascade, local proxy, Extended, DNS, TLS, IPv6, secret handling, native IDs and UCI compatibility.
- Use existing TypeScript/native LuCI/ucode, local assets and current light/dark tokens. No new framework or remote assets.
- Navigation never changes routes or starts probes. Unknown, stale, failed and verified are distinct; evidence names its captured context.
- Native drafts survive navigation and immediate actions; do not silently reload them away. Show saved versus applied meaning.
- API projections and previews omit credentials. Reuse authoritative backend resolvers for Extended preview. Do not approximate unsupported rules as confirmed.
- Behavioral TDD: observe RED, implement GREEN, record commands/results in docs/tdd. Do not fabricate unavailable router, Linux packaging or screen-reader checks.
- Implementation workers develop and verify local source only. The user later authorized root to merge, release 1.2.0 and install it on the router after all twenty improvements and final debug/review/gates pass. Public artifacts exclude private infrastructure/account/endpoint facts; public dependency support, checksums, licensing and provenance remain intact.

## Review Focus

- A native staged DNS/rule draft followed by an immediate device action must be preserved or resolved before backend mutation (Task1).
- Late read/probe responses must not supersede the currently selected target or a newer read (Tasks1/3).
- Malformed/truncated diagnostics must never be described as safely masked raw text (Task2).
- URL paste normalization must not damage regex/full/keyword formats or reinterpret proxy source URLs (Task3).
- Extended draft preview and actual generation must share filtering and ordering, including empty groups and fallback (Task5).

---

### Task 1: Trustworthy evidence, native drafts and interrupted recovery

**Items:** F01, F02, F03

**Files and interfaces:** Modify next/compatibility.ts, advanced.ts, configReload.ts, api.ts and native forkop/forkop.js; add focused regression tests. Produce captured-context invalidation, non-destructive immediate mutation refresh, native pending-state guidance and separate recover action. Preserve exported signatures and profile digests. Root owns cross-task docs/API updates after interface agreement. Recover joins the configuration-change allowlist. The adapter must synchronize UCI state without silently overwriting staged data; if conflict cannot be merged, prevent mutation before it happens with a clear resolution path, not after backend success.

**F01 target:** Показывать цель, выбранное подключение, источник запроса, время и актуальность. При релевантной правке менять статус на «Параметры изменены — проверьте снова». Запоздавший ответ не должен подтверждать новый ввод.

**F01 acceptance:** Успех → изменить узел/домен/JSON → старый успех снят. Запустить A, затем B; ответ A приходит последним и не заменяет результат B. Проверка с роутера явно отличается от проверки с клиентского устройства.

**F02 target:** Единая компактная полоса неприменённых изменений. Точные подписи «Сохранить изменения» и «Применить сейчас». Перед немедленным действием сохранять/согласовывать черновик; по возможности обновлять данные без полной перезагрузки.

**F02 acceptance:** Изменить DNS, перейти к устройствам и назначить маршрут: черновик DNS сохранён либо пользователь явно решил его судьбу. Переключение разделов само по себе его не теряет.

**F03 target:** Явный сценарий «Применение было прервано → восстановить → результат». Возврат предыдущей конфигурации оставить самостоятельным действием для стабильного состояния.

**F03 acceptance:** Fixture recovery_pending предлагает recover; успех обновляет состояние; отказ оставляет причину и следующий шаг. Обычный rollback не подменяет восстановление транзакции.

- [ ] Write behavior regressions against real components/native fixtures and observe the expected RED before production changes.
- [ ] Implement the smallest complete change, preserving global constraints; record shared interface decisions.
- [ ] Run focused tests GREEN, full frontend suite, format/type checks as applicable; self-review.
- [ ] Record RED/GREEN commands, limitations and file ownership in docs/tdd/twenty-ux-task-1.md, commit only own files, then independent task review.

### Task 2: Safe diagnostics, honest feedback and bounded polling

**Items:** F07, F11, F12, F13

**Files and interfaces:** Modify maskDiagnostics.ts, renderModal.ts, showToast.ts, copyToClipboard.ts and native settings.js validators; own their new tests. For F11 compatibility update result routing, coordinate with Task1 output and add a regression. Pause hidden log reads, expose failure/last success, retain one request in flight. Define TTL and BadWAN zero/range semantics from backend before changing validators. Keep raw secret-bearing exports explicitly distinguished. Do not add new runtime dependencies.

**F07 target:** При неудаче маскирования показать явную ошибку и не выдавать сырой текст за обезличенный. Копирование безопасной версии отключать, пока безопасный результат не получен; сырой просмотр обозначать отдельно.

**F07 acceptance:** Обрезанный JSON, вложенные секреты, не-JSON: ни один ответ не маркируется обезличенным, если это не выполнено. Тесты используют только синтетические секреты.

**F11 target:** У каждой операции своя область результата, loading/error/retry. Успех копирования только после подтверждённой операции; сохранить фокус и дать ручное выделение. Для статуса — role=status/aria-live, для срочной ошибки — подходящий alert.

**F11 acceptance:** Отказы сети и clipboard дают ошибку рядом с действием; нет вечной загрузки и ложного успеха. Изменения проверены экранным диктором, а не только наличием атрибутов.

**F12 target:** Явный целый формат, единицы, диапазон и смысл нуля. Единый UI/backend-контракт; ошибка рядом с полем, без молчаливого обрезания строки.

**F12 acceptance:** Граничные значения, пробелы, дроби, отрицательные и мусорный суффикс проверены. Каждый разрешённый ввод имеет однозначное значение.

**F13 target:** Приостановить polling скрытой вкладки/закрытого диалога, использовать адаптивный интервал или инкрементальное чтение. Каркас и локальные переходы не ждут сетевых тестов. Обновлять только изменившийся блок, сохранять прокрутку и ввод.

**F13 acceptance:** В скрытой вкладке нет фонового polling; после возврата одно актуальное чтение. Ошибка показывает последнюю удачу и повтор. Производительность измеряется отдельно на роутере, при холодном/тёплом входе и плохой связи.

- [ ] Write behavior regressions against real components/native fixtures and observe the expected RED before production changes.
- [ ] Implement the smallest complete change, preserving global constraints; record shared interface decisions.
- [ ] Run focused tests GREEN, full frontend suite, format/type checks as applicable; self-review.
- [ ] Record RED/GREEN commands, limitations and file ownership in docs/tdd/twenty-ux-task-2.md, commit only own files, then independent task review.

### Task 3: Direct connection/site/device workflows and scope-aware choices

**Items:** F04, F05, F06, F09, F10, F19

**Files and interfaces:** Modify native section.js/dashboard.js/local_devices.js adapters and next/tools.ts as required, plus shared safe workflow helpers. Produce targeted native create/edit navigation, add-site normalization with visible domain/subdomain preview and no source duplication, row edit/reset device actions, DHCP/IPv4 picker, explicit game scope, capability-aware tool choices, generation-safe reads. Preserve all six native source editors and dependency/parse lifecycle. For advanced.ts option filtering coordinate through an exported shared eligibility helper and apply only the selector portion. Add new backend safe read fields only if existing native data is insufficient, documenting contracts. No independently approximated route algorithm.

**F04 target:** Прямой путь «Добавить подключение»: ссылка/подписка первыми, остальные типы доступны явно; импорт → результат разбора → куда направлять трафик → применение → выбор узла. В первом этапе можно адресно открыть существующий редактор.

**F04 acceptance:** Начав в «Серверах», вставить подписку и вернуться к нужной группе без поиска строки в общей таблице; пропуски и неподдержанные элементы объяснены.

**F05 target:** В контексте правила/подключения: «Добавить сайт» → вставить адрес → показать извлечённый домен и охват поддоменов → показать изменяемое правило и приоритет → применить. В полном редакторе оставить full/keyword/regex и подробные условия.

**F05 acceptance:** URL преобразуется в домен с видимым предварительным результатом; regex и специальные префиксы не портятся. Ошибка называет поле, неверный фрагмент и способ исправления. Создание не дублирует подписку.

**F06 target:** Строка «Устройство — текущая политика — Изменить». Три ясных режима: «По общим правилам», «Всегда напрямую», «Через выбранное подключение». Выбор по имени и IPv4 с ручным вводом; DHCP-подсказку не называть онлайн-статусом.

**F06 acceptance:** Назначить маршрут, затем вернуть общие правила прямо в «Устройствах». Проверка маршрута для этого IP снова учитывает обычные условия. IPv6 ограничение объясняется до отправки.

**F09 target:** Сохранять capability в модели выбора. Показывать подходящие цели либо недоступный пункт с причиной и точным переходом к настройке.

**F09 acceptance:** Смешанный набор DNS, Zapret, connection с прокси и без него: каждый инструмент предлагает валидные варианты; причина недоступности понятна до запуска.

**F10 target:** Generation guard или single-flight для чтений; последнее актуальное состояние, время обновления и локальная ошибка вместо очистки рабочего списка.

**F10 acceptance:** Переставить порядок завершения запросов: побеждает актуальное поколение. Ошибка refresh сохраняет предыдущие данные с пометкой давности.

**F19 target:** Явный выбор «Все устройства / выбранное устройство» и предварительная фраза «Этот пресет затронет …». Выбор устройства переиспользует общий picker.

**F19 acceptance:** Пустое значение никогда молча не расширяет охват; перед применением видны устройства и маршрут. Ошибка адреса объясняется до отправки.

- [ ] Write behavior regressions against real components/native fixtures and observe the expected RED before production changes.
- [ ] Implement the smallest complete change, preserving global constraints; record shared interface decisions.
- [ ] Run focused tests GREEN, full frontend suite, format/type checks as applicable; self-review.
- [ ] Record RED/GREEN commands, limitations and file ownership in docs/tdd/twenty-ux-task-3.md, commit only own files, then independent task review.

### Task 4: Mobile hierarchy, accessible rule ordering and connection-first home

**Items:** F14, F15

**Files and interfaces:** Modify workspace/render.ts/styles.ts/rules.ts, next/render.ts/styles.ts and native rule-table adapter. A narrow-screen single menu exposes all six destinations without horizontal hiding; desktop keeps existing structure. Place selected connection before full probe form; move workspace theme control to settings/preferences while standalone renderer retains it. Remove redundant headings. Add accessible names and above/below order buttons with persisted native priority semantics; drag remains optional. Preserve drafts and hidden-pane lifecycle.

**F14 target:** Сохранить шесть привычных разделов на широком экране. На узком проверить вариант с одним меню разделов и ясным названием текущего; главная: состояние и активное подключение → два главных действия → детали. Тему перенести в предпочтения; подробную форму проверки раскрывать.

**F14 acceptance:** На 320/390/430 CSS px все разделы доступны без поиска за горизонтальным краем; основное действие видно в первом рабочем экране. 200% zoom, длинные русские названия и error состояния не ломают доступ.

**F15 target:** Имя «Включить правило …», явный фокус; действия «Выше/Ниже» или выбор позиции с подтверждаемым результатом. Drag оставить дополнительным. Для обычных касаний стремиться к 44 px при сохранении плотности.

**F15 acceptance:** Клавиатурой и одиночными касаниями изменить приоритет и услышать результат. AA минимум цели — 24×24 с исключениями, 44×44 — enhanced/удобная цель; 42 px кнопка сама по себе не является доказанным нарушением.

- [ ] Write behavior regressions against real components/native fixtures and observe the expected RED before production changes.
- [ ] Implement the smallest complete change, preserving global constraints; record shared interface decisions.
- [ ] Run focused tests GREEN, full frontend suite, format/type checks as applicable; self-review.
- [ ] Record RED/GREEN commands, limitations and file ownership in docs/tdd/twenty-ux-task-4.md, commit only own files, then independent task review.

### Task 5: Large subscriptions and authoritative Extended draft preview

**Items:** F16, F18

**Files and interfaces:** Modify dashboard rendering/controller for local temporary search with selected node pinned and clear counts, source update/import outcome where backed by actual evidence. Add Extended URLTest/Priority draft preview through a documented secret-free backend read contract reusing generator resolver/filter logic. Output member names/counts, empty/overlapping levels, fallback and reasons without secrets; label draft vs runtime. Do not reimplement the resolver in JS. Test at 200 synthetic nodes and backend fixtures for include/exclude/mixed/priority/fallback. Preserve every existing filter, source and cascade behavior. If unsupported evidence exists, show explicit unavailable rather than an invented result.

**F16 target:** Локальный поиск по имени/стране/типу, закреплённый активный узел, найдено N/всего. Источник: последняя удача, последняя попытка, причина ошибки, где используется. Импорт: добавлено/пропущено/дубликаты/неподдержано; следующий шаг «Назначить трафик».

**F16 acceptance:** На synthetic 200 узлах найти нужный клавиатурой; поиск не меняет UCI и состав URLTest. Ошибка подписки сохраняет последний рабочий набор; статус обновления не обещает успешное соединение.

**F18 target:** Preview: состав каждого уровня, почему узел включён/исключён, пустые уровни и последовательность fallback. Ясно разделить «черновик» и «работает сейчас». Сохранить все фильтры, каскад и поведение прерывания.

**F18 acceptance:** Эксперт предсказывает состав и резерв до активации. Preview и реальная генерация используют один resolver и contract tests, без второго несовпадающего алгоритма в браузере.

- [ ] Write behavior regressions against real components/native fixtures and observe the expected RED before production changes.
- [ ] Implement the smallest complete change, preserving global constraints; record shared interface decisions.
- [ ] Run focused tests GREEN, full frontend suite, format/type checks as applicable; self-review.
- [ ] Record RED/GREEN commands, limitations and file ownership in docs/tdd/twenty-ux-task-5.md, commit only own files, then independent task review.

### Task 6: Precise route diagnosis and human impact before changes

**Items:** F08, F17, F20

**Files and interfaces:** Modify next/advanced.ts, compatibility.ts as needed, diagnostic UI and updates rendering/controller. Route form exposes protocol/port, configured basis, captured target and exact winning-rule editor navigation; separate live probe. Add symptom-led diagnostic entry points using existing bounded checks, no automatic probe on navigation. Profile semantic impact summary retains both digests and excludes secrets. Component current-to-target/variant/capability preview uses actual admitted runtime evidence, never version-only compatibility; explicit action then existing guarded job. Keep all install variants/custom sources/rollback checks. Add safe backend semantic/capability read projection if needed and contract tests.

**F08 target:** Видимый контекст: устройство → домен/IP → протокол/порт → активная или сохранённая конфигурация. По умолчанию подписать HTTPS/TCP/443, дополнительные параметры раскрываются. Результат: победившее правило, причина, переход «Открыть правило», отдельная реальная проверка.

**F08 acceptance:** Проверить UDP/443 и TCP/8443. Неизвестные условия дают «Не подтверждено», а не угадывание. Сетевой тест отдельно сообщает источник, цель и время.

**F17 target:** Профиль: безопасная смысловая сводка правил/устройств/DNS без значений секретов. Компонент: установленное → целевое, источник, возможности текущих подключений, ожидаемый перезапуск и реальный путь восстановления. После обновления — применённая версия, состояние службы и отдельный сетевой результат.

**F17 acceptance:** До запуска понятно влияние на текущие задачи. Оба digest сохраняются. Наличие свежего Xray/3x-ui не маркируется доказанной совместимостью; нужны сопоставление параметров и реальный тест.

**F20 target:** Пять входов: «Не работает всё», «Один сайт», «Одно устройство», «Не обновляется подписка», «Не запускается служба». Сценарий собирает точный контекст, показывает один результат и следующий шаг; технические логи доступны рядом.

**F20 acceptance:** Синтетические сбои DNS, соединения, правила и источника ведут к различным понятным результатам. Не обещать автоматически точную причину там, где доказательств недостаточно.

- [ ] Write behavior regressions against real components/native fixtures and observe the expected RED before production changes.
- [ ] Implement the smallest complete change, preserving global constraints; record shared interface decisions.
- [ ] Run focused tests GREEN, full frontend suite, format/type checks as applicable; self-review.
- [ ] Record RED/GREEN commands, limitations and file ownership in docs/tdd/twenty-ux-task-6.md, commit only own files, then independent task review.

### Task 7: Whole-branch review, visual verification and reproducible build

**Items:** F01–F20 acceptance

**Files and interfaces:** Update INTERFACE.md, ACCEPTANCE.md, DESIGN.md and final TDD matrix mapping every F01–F20 to tests and manual evidence. Run full Vitest, TypeScript, ESLint, Prettier and build/check-luci-bundle; relevant native and backend suites, syntax and package build where supported. Exercise actual shipped renderers/native LuCI fixtures on desktop/mobile, light/dark, errors/unknown states, preservation of source editors and no navigation mutation. Independent whole-branch review then fix meaningful issues with RED/GREEN tests. Record exact source and generated bundle SHA. User-facing screenshots/report go only in the established outputs directory, no private endpoint data.

- [ ] Write behavior regressions against real components/native fixtures and observe the expected RED before production changes.
- [ ] Implement the smallest complete change, preserving global constraints; record shared interface decisions.
- [ ] Run focused tests GREEN, full frontend suite, format/type checks as applicable; self-review.
- [ ] Record RED/GREEN commands, limitations and file ownership in docs/tdd/twenty-ux-task-7.md, commit only own files, then independent task review.

### Task 8: Final release and branch integration — root-owned

- [ ] Inspect relevant branch deltas and integrate all approved project work without losing unrelated changes; keep the selected 1.2.0 version and sanitized notes fixed before the final immutable gate.
- [ ] Complete the single independent whole-branch review, final browser/native checks and exact-tree frontend/backend/package CI; resolve meaningful failures with behavioral RED/GREEN and rerun affected gates.
- [ ] Merge the reviewed source to main, publish the release and six verified IPK/APK assets with SHA256SUMS and source/workflow identity. Keep private test/deployment evidence outside public git and artifacts.

### Task 9: Safe router installation — root-owned

- [ ] Discover existing authorized access without exposing credentials; collect a read-only baseline and verify configuration/package/core recovery backups.
- [ ] Prepare an independent delayed rollback before network-affecting installation. Stage the verified published packages without an unrelated VPS/control-panel/core upgrade.
- [ ] Observe service, DNS, HTTPS, IPv4/IPv6, selected routes and UI health; disarm rollback only after healthy access is confirmed. Retain private backup and deployment evidence separately.
