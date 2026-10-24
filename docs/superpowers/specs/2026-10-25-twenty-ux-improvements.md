# Twenty Forkop UX Improvements — approved design

Approved by user on 2026-10-25: implement all 20 research recommendations in their proposed order, use TDD, preserve Extended, then check UI and build. The research was against 9b857893ca61ba93022c38a677b6109d6503b8e2.

## Intent

Make everyday routing tasks direct and make status trustworthy. Keep the six-destination workspace and complete native editor.

## Approach

Implement direct workflows over the existing section model, not a new independent server database. A full inventory migration costs compatibility and is unnecessary for these tasks. Use shared context/result primitives and authoritative preview contracts. All 20 items below are required; observations are research evidence, acceptance describes the target.

## Global Constraints

- Preserve all six sources: links, subscriptions, VPN interfaces, JSON, URLTest and Priority; preserve cascade, local proxy, Extended, DNS, TLS, IPv6, secret handling, native IDs and UCI compatibility.
- Use existing TypeScript/native LuCI/ucode, local assets and current light/dark tokens. No new framework or remote assets.
- Navigation never changes routes or starts probes. Unknown, stale, failed and verified are distinct; evidence names its captured context.
- Native drafts survive navigation and immediate actions; do not silently reload them away. Show saved versus applied meaning.
- API projections and previews omit credentials. Reuse authoritative backend resolvers for Extended preview. Do not approximate unsupported rules as confirmed.
- Behavioral TDD: observe RED, implement GREEN, record commands/results in docs/tdd. Do not fabricate unavailable router, Linux packaging or screen-reader checks.
- Implementation workers develop and verify local source only. The user's later authorization extends the root workflow to merge the reviewed project work, publish version 1.2.0 and install it on the router after all twenty items, final debug, independent review and immutable frontend/backend/package/browser gates pass.
- Before a network-affecting install, root verifies backup and recovery files and an independent delayed rollback; it removes rollback only after observing healthy access and network/UI checks. No VPS or server-core upgrade is implied. Public release material excludes private infrastructure/account/endpoint evidence while retaining public compatibility fixtures, checksums, license and provenance.

## F01: Результат проверки должен принадлежать конкретным параметрам

**Target:** Показывать цель, выбранное подключение, источник запроса, время и актуальность. При релевантной правке менять статус на «Параметры изменены — проверьте снова». Запоздавший ответ не должен подтверждать новый ввод.

**Acceptance:** Успех → изменить узел/домен/JSON → старый успех снят. Запустить A, затем B; ответ A приходит последним и не заменяет результат B. Проверка с роутера явно отличается от проверки с клиентского устройства.

**Dependency:** Общий frontend-контракт результатов, snapshot параметров и generation guard; часть контекста потребует безопасного ответа API.

**Research locations:** fe-app-forkop/src/forkop/next/compatibility.ts:75,212; next/advanced.ts:276,323; next/render.ts:225

## F02: Согласовать черновик, сохранение и немедленное применение

**Target:** Единая компактная полоса неприменённых изменений. Точные подписи «Сохранить изменения» и «Применить сейчас». Перед немедленным действием сохранять/согласовывать черновик; по возможности обновлять данные без полной перезагрузки.

**Acceptance:** Изменить DNS, перейти к устройствам и назначить маршрут: черновик DNS сохранён либо пользователь явно решил его судьбу. Переключение разделов само по себе его не теряет.

**Dependency:** Native dirty state + контракт mutation/reload; транзакционный backend уже существует.

**Research locations:** luci-app-forkop/htdocs/luci-static/resources/view/forkop/forkop.js:67; fe-app-forkop/src/forkop/next/api.ts:22; next/configReload.ts:12

## F03: Отделить восстановление прерванного применения от обычного отката

**Target:** Явный сценарий «Применение было прервано → восстановить → результат». Возврат предыдущей конфигурации оставить самостоятельным действием для стабильного состояния.

**Acceptance:** Fixture recovery_pending предлагает recover; успех обновляет состояние; отказ оставляет причину и следующий шаг. Обычный rollback не подменяет восстановление транзакции.

**Dependency:** Существующий backend recover + UI wiring и событие обновления; новое восстановление не проектировать с нуля.

**Research locations:** fe-app-forkop/src/forkop/next/advanced.ts:407,521; forkop/files/usr/lib/service/next.uc:119,130,238,267

## F04: Добавление подключения должно завершаться в контексте подключения

**Target:** Прямой путь «Добавить подключение»: ссылка/подписка первыми, остальные типы доступны явно; импорт → результат разбора → куда направлять трафик → применение → выбор узла. В первом этапе можно адресно открыть существующий редактор.

**Acceptance:** Начав в «Серверах», вставить подписку и вернуться к нужной группе без поиска строки в общей таблице; пропуски и неподдержанные элементы объяснены.

**Dependency:** Адресный native adapter возможен сейчас. Независимый справочник подключений потребует миграции модели/API: источники сейчас находятся внутри rule section.

**Research locations:** fe-app-forkop/src/forkop/next/render.ts:181; luci-app-forkop/htdocs/luci-static/resources/view/forkop/dashboard.js:17

## F05: Короткий сценарий «Добавить сайт» и понятные ошибки формата

**Target:** В контексте правила/подключения: «Добавить сайт» → вставить адрес → показать извлечённый домен и охват поддоменов → показать изменяемое правило и приоритет → применить. В полном редакторе оставить full/keyword/regex и подробные условия.

**Acceptance:** URL преобразуется в домен с видимым предварительным результатом; regex и специальные префиксы не портятся. Ошибка называет поле, неверный фрагмент и способ исправления. Создание не дублирует подписку.

**Dependency:** Быстрый редактор существующего section — frontend. Независимое постоянное правило со ссылкой на подключение требует отдельного контракта; наличие generated next_target не гарантирует готовность общего API.

**Research locations:** luci-app-forkop/htdocs/luci-static/resources/view/forkop/section.js:6924,7641; fe-app-forkop/src/forkop/workspace/rules.ts:57

## F06: Устройство: различать общие правила и принудительное направление

**Target:** Строка «Устройство — текущая политика — Изменить». Три ясных режима: «По общим правилам», «Всегда напрямую», «Через выбранное подключение». Выбор по имени и IPv4 с ручным вводом; DHCP-подсказку не называть онлайн-статусом.

**Acceptance:** Назначить маршрут, затем вернуть общие правила прямо в «Устройствах». Проверка маршрута для этого IP снова учитывает обычные условия. IPv6 ограничение объясняется до отправки.

**Dependency:** device_set {address, section:""} уже есть; native host hints можно переиспользовать. Полная поддержка IPv6 — отдельная backend-задача.

**Research locations:** fe-app-forkop/src/forkop/next/tools.ts:113,119,136; forkop/files/usr/lib/service/next.uc:187; luci-app-forkop/htdocs/luci-static/resources/view/forkop/local_devices.js:107

## F07: Маскирование диагностических данных должно явно отказывать при ошибке

**Target:** При неудаче маскирования показать явную ошибку и не выдавать сырой текст за обезличенный. Копирование безопасной версии отключать, пока безопасный результат не получен; сырой просмотр обозначать отдельно.

**Acceptance:** Обрезанный JSON, вложенные секреты, не-JSON: ни один ответ не маркируется обезличенным, если это не выполнено. Тесты используют только синтетические секреты.

**Dependency:** Frontend utility + действия копирования/экспорта; проверить также источники диагностических строк.

**Research locations:** fe-app-forkop/src/forkop/tabs/diagnostic/helpers/maskDiagnostics.ts:198; fe-app-forkop/src/forkop/tabs/diagnostic/initController.ts:740; fe-app-forkop/src/partials/modal/renderModal.ts:250

## F08: Объяснение маршрута должно отвечать на точный вопрос

**Target:** Видимый контекст: устройство → домен/IP → протокол/порт → активная или сохранённая конфигурация. По умолчанию подписать HTTPS/TCP/443, дополнительные параметры раскрываются. Результат: победившее правило, причина, переход «Открыть правило», отдельная реальная проверка.

**Acceptance:** Проверить UDP/443 и TCP/8443. Неизвестные условия дают «Не подтверждено», а не угадывание. Сетевой тест отдельно сообщает источник, цель и время.

**Dependency:** route_explain уже принимает протокол/порт. Полная связь с реальными соединениями потребует достоверной runtime-телеметрии; не выводить её из предсказания правил.

**Research locations:** fe-app-forkop/src/forkop/next/advanced.ts:276–312

## F09: Не предлагать заведомо неподходящие подключения

**Target:** Сохранять capability в модели выбора. Показывать подходящие цели либо недоступный пункт с причиной и точным переходом к настройке.

**Acceptance:** Смешанный набор DNS, Zapret, connection с прокси и без него: каждый инструмент предлагает валидные варианты; причина недоступности понятна до запуска.

**Dependency:** Action уже есть в status; для mixed proxy нужен безопасный capability projection, без передачи ключей.

**Research locations:** fe-app-forkop/src/forkop/next/tools.ts:299; next/advanced.ts:529; forkop/files/usr/lib/service/next.uc:178,208

## F10: Старый ответ не должен перезаписывать свежие данные

**Target:** Generation guard или single-flight для чтений; последнее актуальное состояние, время обновления и локальная ошибка вместо очистки рабочего списка.

**Acceptance:** Переставить порядок завершения запросов: побеждает актуальное поколение. Ошибка refresh сохраняет предыдущие данные с пометкой давности.

**Dependency:** Frontend чтения Devices; по тому же контракту проверить Profiles и остальные панели.

**Research locations:** fe-app-forkop/src/forkop/next/tools.ts:129,271,330

## F11: Сообщения об ошибке и успехе должны соответствовать операции

**Target:** У каждой операции своя область результата, loading/error/retry. Успех копирования только после подтверждённой операции; сохранить фокус и дать ручное выделение. Для статуса — role=status/aria-live, для срочной ошибки — подходящий alert.

**Acceptance:** Отказы сети и clipboard дают ошибку рядом с действием; нет вечной загрузки и ложного успеха. Изменения проверены экранным диктором, а не только наличием атрибутов.

**Dependency:** Frontend error/result primitives; интеграционные и ручные accessibility проверки.

**Research locations:** fe-app-forkop/src/forkop/next/compatibility.ts:59,236; fe-app-forkop/src/helpers/copyToClipboard.ts:9; fe-app-forkop/src/helpers/showToast.ts:6

## F12: Числовые поля должны иметь полный и единый контракт

**Target:** Явный целый формат, единицы, диапазон и смысл нуля. Единый UI/backend-контракт; ошибка рядом с полем, без молчаливого обрезания строки.

**Acceptance:** Граничные значения, пробелы, дроби, отрицательные и мусорный суффикс проверены. Каждый разрешённый ввод имеет однозначное значение.

**Dependency:** Уточнение семантики параметров + UI/backend validation; property-based тесты особенно полезны.

**Research locations:** luci-app-forkop/htdocs/luci-static/resources/view/forkop/settings.js:227,403

## F13: Быстрый интерфейс должен беречь роутер и показывать свежесть

**Target:** Приостановить polling скрытой вкладки/закрытого диалога, использовать адаптивный интервал или инкрементальное чтение. Каркас и локальные переходы не ждут сетевых тестов. Обновлять только изменившийся блок, сохранять прокрутку и ввод.

**Acceptance:** В скрытой вкладке нет фонового polling; после возврата одно актуальное чтение. Ошибка показывает последнюю удачу и повтор. Производительность измеряется отдельно на роутере, при холодном/тёплом входе и плохой связи.

**Dependency:** Frontend lifecycle/read API; отдельный план замеров до оптимизации.

**Research locations:** fe-app-forkop/src/forkop/tabs/diagnostic/initController.ts:718; fe-app-forkop/src/partials/modal/renderModal.ts:122,154

## F14: Мобильная компоновка: меньше уровней до полезного действия

**Target:** Сохранить шесть привычных разделов на широком экране. На узком проверить вариант с одним меню разделов и ясным названием текущего; главная: состояние и активное подключение → два главных действия → детали. Тему перенести в предпочтения; подробную форму проверки раскрывать.

**Acceptance:** На 320/390/430 CSS px все разделы доступны без поиска за горизонтальным краем; основное действие видно в первом рабочем экране. 200% zoom, длинные русские названия и error состояния не ломают доступ.

**Dependency:** Frontend responsive hierarchy; выбор меню подтверждать сравнением сценариев, а не субъективным голосованием.

**Research locations:** Скриншоты 07,08,13,14; DOM навигации текущего стенда

## F15: Доступность порядка правил и подписей переключателей

**Target:** Имя «Включить правило …», явный фокус; действия «Выше/Ниже» или выбор позиции с подтверждаемым результатом. Drag оставить дополнительным. Для обычных касаний стремиться к 44 px при сохранении плотности.

**Acceptance:** Клавиатурой и одиночными касаниями изменить приоритет и услышать результат. AA минимум цели — 24×24 с исключениями, 44×44 — enhanced/удобная цель; 42 px кнопка сама по себе не является доказанным нарушением.

**Dependency:** Native table adapter + реальные keyboard/screen-reader проверки.

**Research locations:** work/forkop-ui-preview/luci-static/resources/form.js:206; AX трёх строк правил; fe-app-forkop/src/helpers/showToast.ts:6

## F16: Серверы и подписки: поиск, состояние источника и итог импорта

**Target:** Локальный поиск по имени/стране/типу, закреплённый активный узел, найдено N/всего. Источник: последняя удача, последняя попытка, причина ошибки, где используется. Импорт: добавлено/пропущено/дубликаты/неподдержано; следующий шаг «Назначить трафик».

**Acceptance:** На synthetic 200 узлах найти нужный клавиатурой; поиск не меняет UCI и состав URLTest. Ошибка подписки сохраняет последний рабочий набор; статус обновления не обещает успешное соединение.

**Dependency:** Поиск — frontend; точный import/capability preview может требовать read API.

**Research locations:** fe-app-forkop/src/forkop/tabs/dashboard/partials/renderSections.ts:480; dashboard/initController.ts:1588

## F17: Профили и обновления: объяснять влияние на текущую конфигурацию

**Target:** Профиль: безопасная смысловая сводка правил/устройств/DNS без значений секретов. Компонент: установленное → целевое, источник, возможности текущих подключений, ожидаемый перезапуск и реальный путь восстановления. После обновления — применённая версия, состояние службы и отдельный сетевой результат.

**Acceptance:** До запуска понятно влияние на текущие задачи. Оба digest сохраняются. Наличие свежего Xray/3x-ui не маркируется доказанной совместимостью; нужны сопоставление параметров и реальный тест.

**Dependency:** Базовые категории diff можно получить из ключей; точный semantic diff/capability preflight требует безопасного API. Существующие checksum/rollback guards сохранить.

**Research locations:** fe-app-forkop/src/forkop/next/advanced.ts:208; tabs/updates/initController.ts:839,1140

## F18: Extended: показывать итог сложной группы до применения

**Target:** Preview: состав каждого уровня, почему узел включён/исключён, пустые уровни и последовательность fallback. Ясно разделить «черновик» и «работает сейчас». Сохранить все фильтры, каскад и поведение прерывания.

**Acceptance:** Эксперт предсказывает состав и резерв до активации. Preview и реальная генерация используют один resolver и contract tests, без второго несовпадающего алгоритма в браузере.

**Dependency:** Безопасный draft preview API с переиспользованием resolver; это более крупная работа, чем перестановка формы.

**Research locations:** luci-app-forkop/htdocs/luci-static/resources/view/forkop/section.js:2559,2739,3045; dashboard/initController.ts:1241

## F19: Игровой пресет должен явно называть охват

**Target:** Явный выбор «Все устройства / выбранное устройство» и предварительная фраза «Этот пресет затронет …». Выбор устройства переиспользует общий picker.

**Acceptance:** Пустое значение никогда молча не расширяет охват; перед применением видны устройства и маршрут. Ошибка адреса объясняется до отправки.

**Dependency:** Frontend scope contract; уточнить подписи и документацию существующего backend.

**Research locations:** fe-app-forkop/src/forkop/next/tools.ts:161; forkop/files/usr/lib/service/next.uc:221

## F20: Диагностику начинать с симптома, технические проверки раскрывать

**Target:** Пять входов: «Не работает всё», «Один сайт», «Одно устройство», «Не обновляется подписка», «Не запускается служба». Сценарий собирает точный контекст, показывает один результат и следующий шаг; технические логи доступны рядом.

**Acceptance:** Синтетические сбои DNS, соединения, правила и источника ведут к различным понятным результатам. Не обещать автоматически точную причину там, где доказательств недостаточно.

**Dependency:** Оркестрация существующих проверок; дополнительные объяснения и runtime evidence по мере появления.

**Research locations:** Скриншоты 09,10; текущие панели Diagnostics и route_explain
