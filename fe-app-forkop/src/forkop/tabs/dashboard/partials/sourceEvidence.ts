import { executeShellCommand } from '../../../../helpers/executeShellCommand';
import { navigateToRule } from '../../../next/workflows';

export interface SourceEvidence {
  id: string;
  index: number;
  usedBy: string[];
  evidence: {
    status: 'unknown' | 'success' | 'failed';
    lastAttempt: number | null;
    lastSuccess: number | null;
    error: string | null;
    import: Record<
      'added' | 'accepted' | 'skipped' | 'duplicates' | 'unsupported',
      number | null
    >;
  };
}

export async function loadSourceEvidence(
  section: string,
): Promise<SourceEvidence[] | undefined> {
  const result = await executeShellCommand({
    command: '/usr/bin/forkop',
    args: ['source_evidence', section],
    timeout: 10000,
    operationName: 'История источников',
  });
  try {
    const value = JSON.parse(result.stdout);
    return value.success &&
      value.data?.section === section &&
      Array.isArray(value.data.sources)
      ? value.data.sources
      : undefined;
  } catch {
    return undefined;
  }
}

export function renderSourceEvidence(
  section: string,
  count: number,
  sources?: SourceEvidence[],
) {
  const root = document.createElement('details');
  root.className = 'fkp-source-evidence';
  const title = document.createElement('summary');
  title.textContent = `Источники и результат импорта (${count})`;
  root.append(title);
  const line = (text: string) => {
    const p = document.createElement('p');
    p.textContent = text;
    root.append(p);
  };
  const date = (value?: number | null) =>
    typeof value === 'number' && value > 0
      ? new Date(value * 1000).toLocaleString()
      : 'неизвестно';
  const number = (value?: number | null) =>
    typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : 'неизвестно';
  for (let index = 1; index <= count; index++) {
    const source = sources?.find((source) => source.index === index);
    const evidence = source?.evidence;
    line(
      `Источник ${index} · Используется: ${source?.usedBy.join(', ') || section}`,
    );
    line(
      `Последняя удача: ${date(evidence?.lastSuccess)} · Последняя попытка: ${date(evidence?.lastAttempt)}`,
    );
    if (evidence?.status === 'failed') {
      line(
        'Ошибка: загрузка или импорт не завершены. Повторите обновление или проверьте источник.',
      );
      if (evidence.lastSuccess) line('Последний рабочий набор сохранён.');
    } else if (!evidence || evidence.status === 'unknown')
      line('Причина ошибки: неизвестно — история ещё не записана.');
    else line('Последнее обновление источника завершено.');
    line(
      `Добавлено: ${number(evidence?.import.added)} · Принято: ${number(evidence?.import.accepted)} · Пропущено: ${number(evidence?.import.skipped)}`,
    );
    line(
      `Дубликаты: ${number(evidence?.import.duplicates)} · Не поддержано: ${number(evidence?.import.unsupported)}`,
    );
  }
  line(
    'Импорт не проверяет соединение. Пропущенные записи могут включать некорректные и неподдерживаемые форматы; отдельная разбивка неизвестна.',
  );
  const assign = document.createElement('button');
  assign.type = 'button';
  assign.textContent = 'Назначить трафик';
  assign.addEventListener('click', () =>
    navigateToRule(assign, { kind: 'edit', section, option: 'domain' }),
  );
  root.append(assign);
  return root;
}
