// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { mountForkopWorkspace } from '../render';
import { workspaceStyles } from '../styles';
import { store } from '../../services/store.service';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  store.reset();
  document.head
    .querySelectorAll('[data-workspace-test-style]')
    .forEach((node) => node.remove());
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-darkmode');
  document.body.removeAttribute('data-theme');
});

function nativeMap(
  ids = [
    'next',
    'dashboard',
    'section',
    'server',
    'diagnostic',
    'monitoring',
    'settings',
    'updates',
  ],
) {
  const root = document.createElement('div');
  root.className = 'cbi-map';
  root.id = 'cbi-forkop';
  const menu = document.createElement('ul');
  menu.className = 'cbi-tabmenu';
  const panes = document.createElement('div');
  panes.className = 'cbi-map-tabbed';
  root.append(menu, panes);
  for (const id of ids) {
    const item = document.createElement('li');
    item.dataset.tab = id;
    item.className = id === 'next' ? 'cbi-tab' : 'cbi-tab-disabled';
    const link = document.createElement('a');
    link.href = `#${id}`;
    link.textContent = id;
    item.append(link);
    menu.append(item);
    const pane = document.createElement('section');
    pane.dataset.tab = id;
    pane.dataset.tabActive = String(id === 'next');
    pane.className = 'cbi-section';
    pane.innerHTML = `<label>${id}<input name="${id}" value="saved"></label>`;
    panes.append(pane);
    link.addEventListener('click', (event) => {
      event.preventDefault();
      for (const p of [...panes.children])
        p.setAttribute('data-tab-active', String(p === pane));
      for (const t of [...menu.children])
        t.className = t === item ? 'cbi-tab' : 'cbi-tab-disabled';
    });
  }
  document.body.append(root);
  return { root, menu, panes };
}
const primary = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLButtonElement>(`[data-workspace-section="${id}"]`)!;
const page = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLButtonElement>(`[data-workspace-tab="${id}"]`)!;

it('activates native primary and secondary tabs without replacing draft inputs or their listeners', async () => {
  const { root, menu, panes } = nativeMap();
  const draft = root.querySelector<HTMLInputElement>('input[name=server]')!;
  draft.value = 'unsaved inbound';
  let changes = 0;
  draft.addEventListener('change', () => changes++);
  mountForkopWorkspace(root);
  expect(primary(root, 'servers')).not.toBeNull();
  primary(root, 'servers').click();
  expect(
    panes
      .querySelector('[data-tab=dashboard]')
      ?.getAttribute('data-tab-active'),
  ).toBe('true');
  page(root, 'server').click();
  expect(
    panes.querySelector('[data-tab=server]')?.getAttribute('data-tab-active'),
  ).toBe('true');
  primary(root, 'rules').click();
  primary(root, 'servers').click();
  expect(draft.value).toBe('unsaved inbound');
  expect(root.querySelector('input[name=server]')).toBe(draft);
  draft.dispatchEvent(new Event('change'));
  expect(changes).toBe(1);
  expect(root.querySelector('.cbi-tabmenu')).toBe(menu);
  expect(root.querySelector('.cbi-map-tabbed')).toBe(panes);
  await flush();
  expect(primary(root, 'servers').getAttribute('aria-current')).toBe('page');
});

it('synchronizes workspace selection when an original tab link is clicked externally', async () => {
  const { root, menu } = nativeMap();
  mountForkopWorkspace(root);
  menu.querySelector<HTMLAnchorElement>('[data-tab=monitoring] a')!.click();
  await flush();
  expect(primary(root, 'diagnostics')?.getAttribute('aria-current')).toBe(
    'page',
  );
  expect(page(root, 'monitoring')?.getAttribute('aria-current')).toBe('page');
  expect(root.querySelector('.fkp-workspace-title')?.textContent).toBe(
    'Диагностика',
  );
});

it('omits missing optional destinations and makes repeated mounting idempotent', () => {
  const { root } = nativeMap(['next', 'section', 'settings']);
  mountForkopWorkspace(root);
  mountForkopWorkspace(root);
  expect(root.querySelectorAll('.fkp-workspace-primary')).toHaveLength(1);
  expect(primary(root, 'devices')).toBeNull();
  expect(primary(root, 'servers')).toBeNull();
  expect(root.querySelectorAll('[data-workspace-section]')).toHaveLength(3);
  expect(page(root, 'advanced')).toBeNull();
});

it('keeps capability-hidden native destinations unavailable and follows later visibility changes', async () => {
  const { root, menu } = nativeMap(['next', 'devices', 'settings', 'advanced']);
  const advanced = menu.querySelector<HTMLElement>('[data-tab=advanced]')!;
  advanced.hidden = true;
  mountForkopWorkspace(root);
  expect(page(root, 'advanced')).toBeNull();
  advanced.hidden = false;
  await flush();
  expect(page(root, 'advanced')?.textContent).toContain('Расширенные');
  advanced.style.display = 'none';
  await flush();
  expect(page(root, 'advanced')).toBeNull();
});

it('reports unknown service and unchecked network separately, then follows real overview evidence', async () => {
  const { root, panes } = nativeMap();
  mountForkopWorkspace(root);
  expect(root.querySelector('.fkp-workspace-service')?.textContent).toContain(
    'неизвестно',
  );
  expect(
    root.querySelector('.fkp-workspace-connection')?.textContent,
  ).toContain('не проверено');
  const overview = document.createElement('section');
  overview.className = 'fkp-next-overview';
  overview.innerHTML =
    '<p class="fkp-next-service">Сервис запущен</p><p class="fkp-next-connection">Соединение ещё не проверено</p>';
  panes.querySelector('[data-tab=next]')!.append(overview);
  await flush();
  expect(root.querySelector('.fkp-workspace-service')?.textContent).toBe(
    'Сервис запущен',
  );
  expect(
    root.querySelector('.fkp-workspace-connection')?.textContent,
  ).toContain('не проверено');
  overview.querySelector('.fkp-next-connection')!.textContent =
    'Нет сетевого ответа · HTTP 503';
  await flush();
  expect(
    root.querySelector('.fkp-workspace-connection')?.textContent,
  ).toContain('Нет сетевого ответа');
});

it('applies one theme to the workspace and only identifiable Forkop modals', async () => {
  document.documentElement.dataset.theme = 'dark';
  const { root } = nativeMap();
  mountForkopWorkspace(root);
  expect(root.dataset.theme).toBe('dark');
  const theme = root.querySelector<HTMLSelectElement>(
    '.fkp-workspace-theme select',
  );
  expect(theme).not.toBeNull();
  theme!.value = 'light';
  theme!.dispatchEvent(new Event('change'));
  const forkop = document.createElement('div');
  forkop.className = 'modal cbi-modal';
  forkop.innerHTML = '<div id="cbi-forkop-rule-modal"><input></div>';
  const other = document.createElement('div');
  other.className = 'modal';
  other.innerHTML = '<div id="cbi-network"><input></div>';
  document.body.append(forkop, other);
  await flush();
  expect(root.dataset.theme).toBe('light');
  expect(forkop.classList.contains('fkp-workspace-modal')).toBe(true);
  expect(forkop.dataset.theme).toBe('light');
  expect(other.classList.contains('fkp-workspace-modal')).toBe(false);
  expect(other.dataset.theme).toBeUndefined();
});

it('stops observing and handling navigation after the workspace detaches', async () => {
  const { root, menu } = nativeMap();
  mountForkopWorkspace(root);
  expect(primary(root, 'servers')).not.toBeNull();
  root.remove();
  await flush();
  primary(root, 'servers').click();
  expect(menu.querySelector('[data-tab=next]')?.className).toBe('cbi-tab');
  root.querySelector('.fkp-workspace-service')!.textContent = 'Detached';
  await flush();
  expect(root.querySelector('.fkp-workspace-service')?.textContent).toBe(
    'Detached',
  );
});

it('retains keyboard focus on navigation controls when their native destination activates', async () => {
  const { root } = nativeMap();
  mountForkopWorkspace(root);
  const servers = primary(root, 'servers');
  servers.focus();
  servers.click();
  await flush();
  expect(document.activeElement).toBe(servers);
  const inbound = page(root, 'server');
  inbound.focus();
  inbound.click();
  await flush();
  expect(document.activeElement).toBe(inbound);
});

it('themes identifiable Forkop detail modals that do not contain UCI fields', async () => {
  const { root } = nativeMap();
  mountForkopWorkspace(root);
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML =
    '<div class="fkp_dashboard-page__urltest-details"><button>Close</button></div>';
  document.body.append(modal);
  await flush();
  expect(modal.classList.contains('fkp-workspace-modal')).toBe(true);
});

it('follows native Atlas darkmode changes while an explicit workspace choice remains authoritative', async () => {
  document.documentElement.setAttribute('data-darkmode', 'true');
  const { root } = nativeMap();
  mountForkopWorkspace(root);
  expect(root.dataset.theme).toBe('dark');
  document.documentElement.setAttribute('data-darkmode', 'false');
  await flush();
  expect(root.dataset.theme).toBe('light');
  document.body.dataset.theme = 'dark';
  await flush();
  expect(root.dataset.theme).toBe('dark');
  const theme = root.querySelector<HTMLSelectElement>(
    '.fkp-workspace-theme select',
  )!;
  theme.value = 'light';
  theme.dispatchEvent(new Event('change'));
  document.body.dataset.theme = 'light';
  document.body.dataset.theme = 'dark';
  await flush();
  expect(root.dataset.theme).toBe('light');
});

it('inherits the LuCI theme when mounting the not-yet-attached native render result', () => {
  document.documentElement.setAttribute('data-darkmode', 'true');
  const { root } = nativeMap();
  root.remove();
  mountForkopWorkspace(root);
  expect(root.dataset.theme).toBe('dark');
  document.body.append(root);
});

it('hides initially inactive native panes with an absent active attribute and shows only the activated pane', () => {
  const style = document.createElement('style');
  style.dataset.workspaceTestStyle = '';
  style.textContent = workspaceStyles;
  document.head.append(style);
  const { root, panes } = nativeMap();
  for (const pane of panes.querySelectorAll('[data-tab-active=false]'))
    pane.removeAttribute('data-tab-active');
  mountForkopWorkspace(root);
  const visible = () =>
    [...panes.children].filter(
      (pane) => getComputedStyle(pane).display !== 'none',
    );
  expect(visible().map((pane) => pane.getAttribute('data-tab'))).toEqual([
    'next',
  ]);
  primary(root, 'servers').click();
  expect(visible().map((pane) => pane.getAttribute('data-tab'))).toEqual([
    'dashboard',
  ]);
});

it('uses fresh shared service evidence off-home while retaining unknown for the unloaded store', () => {
  const { root } = nativeMap();
  mountForkopWorkspace(root);
  primary(root, 'rules').click();
  const service = root.querySelector('.fkp-workspace-service')!;
  expect(service.textContent).toContain('неизвестно');
  store.set({
    servicesInfoWidget: {
      loading: false,
      failed: false,
      data: {
        singbox: 1,
        forkopRunning: 1,
        forkopEnabled: 1,
        forkopStatus: 'running',
      },
    },
  });
  expect(service.textContent).toBe('Сервис запущен');
  store.set({
    servicesInfoWidget: {
      loading: false,
      failed: false,
      data: {
        singbox: 0,
        forkopRunning: 0,
        forkopEnabled: 1,
        forkopStatus: 'stopped',
      },
    },
  });
  expect(service.textContent).toBe('Сервис остановлен');
  store.set({
    servicesInfoWidget: {
      loading: false,
      failed: false,
      data: {
        singbox: 0,
        forkopRunning: 0,
        forkopEnabled: 1,
        forkopStatus: 'reloading',
      },
    },
  });
  expect(service.textContent).toContain('Выполняется действие');
  store.set({
    servicesInfoWidget: {
      loading: false,
      failed: true,
      data: {
        singbox: 0,
        forkopRunning: 0,
        forkopEnabled: 1,
        forkopStatus: '',
      },
    },
  });
  expect(service.textContent).toContain('недоступно');
});
