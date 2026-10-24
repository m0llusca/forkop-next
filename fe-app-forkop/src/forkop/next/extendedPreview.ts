import { executeShellCommand } from '../../helpers/executeShellCommand';

export type PreviewDraftCapture = {
  draft?: object;
  unavailableReason?: string;
  revision: string;
};
type Level = {
  id: string;
  name: string;
  direct: boolean;
  members: string[];
  count: number;
  empty: boolean;
  overlap: { member: string; assignedLevel: string }[];
  decisions: { member: string; included: boolean; reasons: string[] }[];
};
type PreviewData = {
  requestId: string;
  capture: string;
  candidates: { id: string; name: string }[];
  groups: {
    id: string;
    kind: string;
    name: string;
    count: number;
    omitted: boolean;
    interrupt: boolean;
    levels: Level[];
    fallbackOrder: string[];
    policy?: { pickFastest: boolean; switchToFasterSamePriority: boolean };
  }[];
};
const reasonText: Record<string, string> = {
  all_candidates: 'Фильтр выключен',
  include_match: 'Совпадает с включением',
  include_miss: 'Нет совпадения с включением',
  exclude_match: 'Совпадает с исключением',
  pool_excluded: 'Исключён из общего набора',
  earlier_level: 'Уже назначен более высокому уровню',
  direct_level: 'Прямой выход',
};
const unavailable: Record<string, string> = {
  source_draft_changed:
    'Изменены источники. Сначала сохраните и примените их, затем обновите снимок.',
  cascade_draft_changed:
    'Изменён каскад. Сначала сохраните и примените его, затем обновите снимок.',
  pending_child_incomplete: 'Заполните параметры новой группы или уровня.',
  capture_changed:
    'Набор узлов изменился. Нажмите предпросмотр ещё раз для нового снимка.',
  country_evidence_missing:
    'В снимке нет сведений о стране для части узлов. Результат фильтра пока неизвестен.',
  invalid_request:
    'Проверьте фильтры и параметры уровней: черновик не прошёл проверку.',
};
export function renderExtendedPreview(
  section: string,
  capture: () => PreviewDraftCapture,
) {
  const root = document.createElement('section');
  root.className = 'fkp-extended-preview';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Предпросмотр URLTest / Priority';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const content = document.createElement('div');
  root.append(button, status, content);
  let generation = 0,
    expectedCapture: string | undefined;
  const paragraph = (text: string, parent: HTMLElement = content) => {
    const p = document.createElement('p');
    p.textContent = text;
    parent.append(p);
  };
  const invalidate = () => {
    generation++;
    content.replaceChildren();
    status.textContent = 'Черновик изменён. Повторите предпросмотр.';
  };
  // The native host calls this after mounting, keeping listeners in its lifetime.
  root.addEventListener('forkop:preview-invalidated', invalidate);
  button.addEventListener('click', async () => {
    const current = ++generation,
      snapshot = capture();
    content.replaceChildren();
    if (snapshot.unavailableReason || !snapshot.draft) {
      status.textContent =
        unavailable[snapshot.unavailableReason || ''] ||
        'Предпросмотр недоступен: контекст источников неизвестен.';
      return;
    }
    const requestId = `preview_${current}`;
    status.textContent = 'Читаем снимок и проверяем черновик…';
    root.setAttribute('aria-busy', 'true');
    const reply = await executeShellCommand({
      command: '/usr/bin/forkop',
      args: [
        'extended_preview',
        JSON.stringify({
          schema: 1,
          section,
          requestId,
          expectedCapture,
          draft: snapshot.draft,
        }),
      ],
      timeout: 15000,
      operationName: 'Предпросмотр фильтров',
    });
    if (
      !root.isConnected ||
      current !== generation ||
      capture().revision !== snapshot.revision
    )
      return;
    root.setAttribute('aria-busy', 'false');
    try {
      const result = JSON.parse(reply.stdout);
      if (!result.success) {
        if (result.error === 'capture_changed') expectedCapture = undefined;
        status.textContent =
          unavailable[result.reason] ||
          unavailable[result.error] ||
          'Предпросмотр недоступен: нет подтверждённого снимка текущих источников. Сохраните и примените настройки.';
        return;
      }
      const data = result.data as PreviewData;
      if (data.requestId !== requestId) return;
      expectedCapture = data.capture;
      status.textContent =
        'Черновик фильтров · набор узлов из снимка. Доступность узлов не проверялась.';
      paragraph(
        'Эти настройки ещё не применены. Работающие группы смотрите в разделе «Серверы».',
      );
      const names = new Map(data.candidates.map((c) => [c.id, c.name]));
      names.set('direct', 'Direct');
      for (const group of data.groups) {
        const heading = document.createElement('h4');
        heading.textContent = `${group.name}: ${group.count} узлов${group.omitted ? ' · пустая группа не создаётся' : ''}`;
        content.append(heading);
        paragraph(
          group.interrupt
            ? 'Соединения прерываются при переключении.'
            : 'Существующие соединения сохраняются при переключении.',
        );
        for (const level of group.levels) {
          const details = document.createElement('details'),
            summary = document.createElement('summary');
          summary.textContent = `${level.name}: ${level.count}${level.empty ? ' · пусто' : ''}${level.direct ? ' · прямой выход' : ''}`;
          details.append(summary);
          content.append(details);
          paragraph(
            level.members.map((id) => names.get(id) || id).join(', ') ||
              'Нет участников',
            details,
          );
          for (const overlap of level.overlap)
            paragraph(
              `${names.get(overlap.member) || overlap.member}: уже назначен уровню ${overlap.assignedLevel}`,
              details,
            );
          const list = document.createElement('ul');
          for (const decision of level.decisions) {
            const item = document.createElement('li');
            item.textContent = `${names.get(decision.member) || decision.member}: ${decision.included ? 'включён' : 'исключён'} — ${decision.reasons.map((reason) => reasonText[reason] || 'Нет данных').join(', ')}`;
            list.append(item);
          }
          details.append(list);
        }
        if (group.kind === 'priority') {
          const levels = new Map(group.levels.map((l) => [l.id, l.name]));
          paragraph(
            `Порядок резерва: ${group.fallbackOrder.map((id) => levels.get(id) || id).join(' → ') || 'нет непустых уровней'}`,
          );
          paragraph(
            group.policy?.pickFastest
              ? 'Внутри уровня выбирается самый быстрый доступный узел.'
              : 'Внутри уровня сохраняется штатная политика выбора.',
          );
          paragraph(
            'Если проверки всех замен неуспешны, автоматическое переключение на Direct или блокировку не выполняется.',
          );
        }
      }
    } catch {
      status.textContent =
        'Не удалось прочитать предпросмотр. Повторите запрос.';
    }
  });
  return root;
}
