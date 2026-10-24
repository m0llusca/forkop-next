interface CreationSection {
  sectiontype: string;
  uciconfig?: string;
  map: {
    config: string;
    readonly?: boolean;
    addedSection?: string;
    data: {
      get(config: string, name: string): unknown;
      set(config: string, name: string, option: string, value: string): unknown;
      remove(config: string, name: string): unknown;
    };
  };
  handleAdd(event: Event, name?: string): unknown;
  renderMoreOptionsModal(name: string, event?: Event): unknown;
  renderSectionAdd(extra?: string): HTMLElement;
}

/** Keep native named section identity and modal/cancel/default behavior. */
export function configureNamedSectionCreation(
  section: CreationSection,
  label: string,
  buttonLabel: string,
): void {
  const pending = new Set<string>();
  const originalModal = section.renderMoreOptionsModal;
  section.renderMoreOptionsModal = function (name, event) {
    if (pending.delete(name))
      this.map.data.set(
        this.uciconfig ?? this.map.config,
        name,
        'label',
        label,
      );
    return originalModal.call(this, name, event);
  };
  section.renderSectionAdd = function (extra) {
    const root = document.createElement('div');
    root.className = `cbi-section-create ${extra || ''}`.trim();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cbi-button cbi-button-add';
    button.textContent = buttonLabel;
    button.disabled = this.map.readonly === true;
    const result = document.createElement('p');
    result.setAttribute('role', 'status');
    result.hidden = true;
    button.onclick = async (event) => {
      if (this.map.readonly || button.disabled) return;
      const config = this.uciconfig ?? this.map.config;
      let index = 1;
      while (this.map.data.get(config, `${this.sectiontype}_${index}`)) index++;
      const name = `${this.sectiontype}_${index}`;
      pending.add(name);
      button.disabled = true;
      result.hidden = true;
      try {
        await this.handleAdd(event, name);
      } catch {
        // Native handleAdd reserves the named draft before loading its modal.
        // Remove only that reservation on failure; existing sections are untouched.
        if (this.map.addedSection === name) {
          this.map.data.remove(config, name);
          delete this.map.addedSection;
        }
        result.textContent =
          'Не удалось открыть редактор. Повторите добавление.';
        result.hidden = false;
      } finally {
        pending.delete(name);
        button.disabled = Boolean(this.map.readonly);
      }
    };
    root.append(button, result);
    return root;
  };
}
