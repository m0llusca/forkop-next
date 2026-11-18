import fs from 'fs/promises';
import { execSync } from 'child_process';

const lang = process.argv[2];
if (!lang) {
  console.error('❌ Укажи язык, например: node generate-po.js ru');
  process.exit(1);
}

const callsPath = 'locales/calls.json';
const poPath = `locales/forkop.${lang}.po`;

function getGitUser() {
  try {
    return execSync('git config user.name').toString().trim();
  } catch {
    return 'Automatically generated';
  }
}

function getHeader(lang) {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].slice(0, 5);
  const tzOffset = (() => {
    const offset = -now.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
    const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
    return `${sign}${hours}${minutes}`;
  })();

  const translator = getGitUser();
  const pluralForms =
    lang === 'ru'
      ? 'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);'
      : 'nplurals=2; plural=(n != 1);';

  return [
    `# ${lang.toUpperCase()} translations for FORKOP package.`,
    `# Copyright (C) ${now.getFullYear()} THE FORKOP COPYRIGHT HOLDER`,
    `# This file is distributed under the same license as the FORKOP package.`,
    `# ${translator}, ${now.getFullYear()}.`,
    '#',
    'msgid ""',
    'msgstr ""',
    `"Project-Id-Version: FORKOP\\n"`,
    `"Report-Msgid-Bugs-To: \\n"`,
    `"POT-Creation-Date: ${date} ${time}${tzOffset}\\n"`,
    `"PO-Revision-Date: ${date} ${time}${tzOffset}\\n"`,
    `"Last-Translator: ${translator}\\n"`,
    `"Language-Team: none\\n"`,
    `"Language: ${lang}\\n"`,
    `"MIME-Version: 1.0\\n"`,
    `"Content-Type: text/plain; charset=UTF-8\\n"`,
    `"Content-Transfer-Encoding: 8bit\\n"`,
    `"Plural-Forms: ${pluralForms}\\n"`,
    '',
  ];
}

function parsePo(content) {
  const lines = content.split(/\r?\n/);
  const translations = new Map();
  let mode = null;
  let msgid = null;
  let msgstr = null;

  const flush = () => {
    if (msgid !== null && msgid !== '' && msgstr !== null) {
      translations.set(msgid, msgstr);
    }
    mode = null;
    msgid = null;
    msgstr = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      flush();
      continue;
    }
    if (line.startsWith('msgid ')) {
      flush();
      msgid = JSON.parse(line.slice(6));
      mode = 'msgid';
    } else if (line.startsWith('msgstr ') && msgid !== null) {
      msgstr = JSON.parse(line.slice(7));
      mode = 'msgstr';
    } else if (line.startsWith('"') && line.endsWith('"')) {
      const part = JSON.parse(line);
      if (mode === 'msgid' && msgid !== null) {
        msgid += part;
      } else if (mode === 'msgstr' && msgstr !== null) {
        msgstr += part;
      }
    }
  }
  flush();
  return translations;
}

function escapePoString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

function extractExistingHeader(raw) {
  if (!raw) return null;
  const normalized = raw.replace(/\r\n/g, '\n');
  const idx = normalized.indexOf('\n\n');
  if (idx === -1 || !normalized.includes('msgid ""')) return null;
  return normalized.slice(0, idx + 1);
}

async function generatePo() {
  const [callsRaw, oldPoRaw] = await Promise.all([
    fs.readFile(callsPath, 'utf8'),
    fs.readFile(poPath, 'utf8').catch(() => ''),
  ]);

  const calls = JSON.parse(callsRaw);
  const oldTranslations = parsePo(oldPoRaw);
  const header = extractExistingHeader(oldPoRaw) ?? getHeader(lang).join('\n');

  const body = calls
    .map(({ key }) => {
      const msgid = key;
      const msgstr = oldTranslations.get(msgid) || '';
      return [
        `msgid "${escapePoString(msgid)}"`,
        `msgstr "${escapePoString(msgstr)}"`,
        '',
      ].join('\n');
    })
    .join('\n');

  const finalPo = header + '\n' + body;

  await fs.writeFile(poPath, finalPo, 'utf8');
  const translatedCount = calls.filter(({ key }) =>
    Boolean(oldTranslations.get(key)),
  ).length;
  console.log(
    `✅ Файл ${poPath} успешно сгенерирован. Переведено ${translatedCount}/${calls.length}`,
  );
}

generatePo().catch((err) => {
  process.exitCode = 1;
  console.error('Ошибка генерации PO файла:', err);
});
