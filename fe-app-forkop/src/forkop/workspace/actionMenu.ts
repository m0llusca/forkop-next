export interface ActionMenuOptions {
  compact?: boolean;
  block?: boolean;
  ariaLabel?: string;
  open?: boolean;
  busy?: boolean;
}

const boundDocuments = new WeakSet<Document>();

function ensureDocumentDismissal(doc: Document | null | undefined): void {
  if (!doc || boundDocuments.has(doc)) return;
  boundDocuments.add(doc);
  doc.addEventListener('pointerdown', (event) => {
    const target = event.target instanceof Node ? event.target : null;
    for (const openMenu of doc.querySelectorAll<HTMLDetailsElement>(
      'details.fkp-action-menu[open]',
    )) {
      if (!target || !openMenu.contains(target)) {
        openMenu.open = false;
      }
    }
  });
}

export function actionMenuDivider(): HTMLHRElement {
  const hr = document.createElement('hr');
  hr.className = 'fkp-action-menu__divider';
  hr.setAttribute('aria-hidden', 'true');
  return hr;
}

export function actionMenuHeading(text: string): HTMLDivElement {
  const heading = document.createElement('div');
  heading.className = 'fkp-action-menu__heading';
  heading.textContent = text;
  return heading;
}

export function decorateActionMenuItems(popover: HTMLElement): void {
  for (const btn of popover.querySelectorAll('button')) {
    btn.classList.add('fkp-action-menu__item');
    if (!btn.hasAttribute('role')) {
      btn.setAttribute('role', 'menuitem');
    }
    if (
      btn.classList.contains('cbi-button-remove') ||
      btn.classList.contains('cbi-button-negative') ||
      btn.dataset.danger === 'true'
    ) {
      btn.classList.add('fkp-action-menu__danger');
    }
  }
}

export function createActionMenu(
  label: string,
  items: Array<Node | null | undefined>,
  options: ActionMenuOptions = {},
): HTMLDetailsElement {
  ensureDocumentDismissal(typeof document !== 'undefined' ? document : null);

  const details = document.createElement('details');
  details.className = [
    'fkp-action-menu',
    options.compact ? 'fkp-action-menu--compact' : '',
    options.block ? 'fkp-action-menu--block' : '',
  ]
    .filter(Boolean)
    .join(' ');
  details.dataset.align = 'end';
  if (options.busy) details.dataset.busy = 'true';
  if (options.open) details.open = true;

  const summary = document.createElement('summary');
  summary.className = 'fkp-action-menu__trigger';
  summary.setAttribute(
    'aria-label',
    options.ariaLabel ||
      (options.compact ? 'Ещё действия' : label || 'Ещё действия'),
  );
  const labelSpan = document.createElement('span');
  labelSpan.className = 'fkp-action-menu__label';
  labelSpan.textContent = label;
  summary.append(labelSpan);

  const popover = document.createElement('div');
  popover.className = 'fkp-action-menu__popover';
  popover.setAttribute('role', 'menu');
  for (const item of items) {
    if (item) popover.append(item);
  }
  decorateActionMenuItems(popover);

  details.append(summary, popover);

  details.addEventListener('toggle', () => {
    const doc = details.ownerDocument;
    ensureDocumentDismissal(doc);
    if (!details.open) return;
    for (const other of doc.querySelectorAll<HTMLDetailsElement>(
      'details.fkp-action-menu[open]',
    )) {
      if (other !== details) other.open = false;
    }
    if (!options.block && typeof window !== 'undefined') {
      const rect = details.getBoundingClientRect();
      if (
        rect.width > 0 &&
        rect.right < 236 &&
        window.innerWidth - rect.left > rect.right
      ) {
        details.dataset.align = 'start';
      } else {
        details.dataset.align = 'end';
      }
    }
  });

  details.addEventListener('keydown', (event) => {
    if (!details.open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      details.open = false;
      summary.focus();
      return;
    }
    if (
      event.key !== 'ArrowDown' &&
      event.key !== 'ArrowUp' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return;
    }
    const focusable = [
      ...popover.querySelectorAll<HTMLButtonElement>('button'),
    ].filter((btn) => !btn.disabled && !btn.hidden);
    if (!focusable.length) return;
    event.preventDefault();
    const active = details.ownerDocument.activeElement as HTMLButtonElement;
    const currentIndex = focusable.indexOf(active);
    let nextIndex = 0;
    if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = focusable.length - 1;
    } else if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % focusable.length;
    } else {
      nextIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
    }
    focusable[nextIndex]?.focus();
  });

  popover.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest('button');
    if (button && popover.contains(button) && !button.disabled) {
      details.open = false;
    }
  });

  return details;
}

/**
 * Consolidates secondary/destructive table row buttons (e.g. "Добавить сайт", "Удалить")
 * into a compact `⋯` overflow menu right after `.cbi-button-edit`, without detaching
 * or recreating native buttons.
 */
export function ensureRowOverflowMenu(
  bar: HTMLElement,
  rowLabel = '',
): HTMLDetailsElement | null {
  const addSiteBtns = [
    ...bar.querySelectorAll<HTMLButtonElement>('.fkp-rule-add-site'),
  ];
  const removeBtns = [
    ...bar.querySelectorAll<HTMLButtonElement>(
      '.cbi-button-remove, .cbi-button-negative',
    ),
  ];
  let menu = bar.querySelector<HTMLDetailsElement>(
    ':scope > details.fkp-action-menu',
  );
  if (!addSiteBtns.length && !removeBtns.length) {
    if (menu) menu.remove();
    return null;
  }
  const ariaLabel = rowLabel ? `Ещё действия: ${rowLabel}` : 'Ещё действия';
  if (!menu) {
    menu = createActionMenu('⋯', [], {
      compact: true,
      ariaLabel,
    });
    bar.append(menu);
  } else {
    menu
      .querySelector('.fkp-action-menu__trigger')
      ?.setAttribute('aria-label', ariaLabel);
  }
  const popover = menu.querySelector<HTMLElement>('.fkp-action-menu__popover')!;
  popover
    .querySelectorAll('.fkp-action-menu__divider')
    .forEach((hr) => hr.remove());
  for (const btn of addSiteBtns) {
    popover.append(btn);
  }
  if (addSiteBtns.length > 0 && removeBtns.length > 0) {
    popover.append(actionMenuDivider());
  }
  for (const btn of removeBtns) {
    popover.append(btn);
  }
  decorateActionMenuItems(popover);
  return menu;
}
