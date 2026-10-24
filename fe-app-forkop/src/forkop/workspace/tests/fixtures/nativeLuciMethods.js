/* eslint-disable */
// Verbatim focused LuCI methods captured 2026-10-24. Test fixture only.
// Copyright LuCI contributors. Apache-2.0; see LUCI-LICENSE in this directory.
// Upstream: https://github.com/openwrt/luci/tree/master/modules/luci-base/htdocs/luci-static/resources
// form.js SHA256 b68bebcbb5eef7256790b9dcb821bf6b1d4104b72fb076dda2e67268d7254787
// ui.js SHA256 00c1708f28fcd8991dbb259c1377911f65599fd71a9b1393469e8efc47375c52
// Method selection, wrapper and formatting added; method bodies retain native semantics.
export function nativeLuciMethods(E, dom, L, ui, UI, _) {
  // Native form.js helper used by Value.parse().
  function isEqual(x, y) {
    if (typeof y == 'object' && y instanceof RegExp)
      return x == null ? false : y.test(x);
    if (x != null && y != null && typeof x != typeof y) return false;
    if ((x == null && y != null) || (x != null && y == null)) return false;
    if (Array.isArray(x)) {
      if (x.length != y.length) return false;
      for (let i = 0; i < x.length; i++) if (!isEqual(x[i], y[i])) return false;
    } else if (typeof x == 'object') {
      for (const k in x) {
        if (x.hasOwnProperty(k) && !y.hasOwnProperty(k)) return false;
        if (!isEqual(x[k], y[k])) return false;
      }
      for (const k in y)
        if (y.hasOwnProperty(k) && !x.hasOwnProperty(k)) return false;
    } else if (x != y) return false;
    return true;
  }
  return {
    value: {
      parse(section_id) {
        const active = this.isActive(section_id);
        if (active && !this.isValid(section_id)) {
          const title = this.stripTags(this.title).trim();
          const error = this.getValidationError(section_id);
          return Promise.reject(
            new TypeError(
              `${_('Option "%s" contains an invalid input value.').format(title || this.option)} ${error}`,
            ),
          );
        }
        if (active) {
          const cval = this.cfgvalue(section_id);
          const fval = this.formvalue(section_id);
          if (fval == null || fval == '') {
            if (this.rmempty || this.optional)
              return Promise.resolve(this.remove(section_id));
            else {
              const title = this.stripTags(this.title).trim();
              return Promise.reject(
                new TypeError(
                  _('Option "%s" must not be empty.').format(
                    title || this.option,
                  ),
                ),
              );
            }
          } else if (this.forcewrite || !isEqual(cval, fval)) {
            if (
              this.map.findElement('data-field', this.cbid(section_id)) != null
            )
              return Promise.resolve(this.write(section_id, fval));
          }
        } else if (!this.retain)
          return Promise.resolve(this.remove(section_id));
        return Promise.resolve();
      },
    },
    map: {
      save(cb, silent) {
        this.checkDepends();
        return this.parse()
          .then(cb)
          .then(this.data.save.bind(this.data))
          .then(this.load.bind(this))
          .catch((e) => {
            if (!silent) {
              ui.showModal(_('Save error'), [
                E('p', {}, [_('An error occurred while saving the form:')]),
                E('p', {}, [
                  E('em', { style: 'white-space:pre-wrap' }, [e.message]),
                ]),
                E('div', { class: 'right' }, [
                  E('button', { class: 'cbi-button', click: ui.hideModal }, [
                    _('Dismiss'),
                  ]),
                ]),
              ]);
            }
            return Promise.reject(e);
          })
          .then(this.renderContents.bind(this));
      },
      reset() {
        return this.renderContents();
      },
      render() {
        return this.load().then(this.renderContents.bind(this));
      },
      renderContents() {
        const mapEl = (this.root ??= E('div', {
          id: 'cbi-%s'.format(this.config),
          class: 'cbi-map',
          'cbi-dependency-check': L.bind(this.checkDepends, this),
        }));
        dom.bindClassInstance(mapEl, this);
        return this.renderChildren(null).then(
          L.bind((nodes) => {
            const initialRender = !mapEl.firstChild;
            dom.content(mapEl, null);
            if (this.title != null && this.title != '')
              mapEl.appendChild(E('h2', { name: 'content' }, this.title));
            if (this.description != null && this.description != '')
              mapEl.appendChild(
                E('div', { class: 'cbi-map-descr' }, this.description),
              );
            if (this.tabbed)
              dom.append(mapEl, E('div', { class: 'cbi-map-tabbed' }, nodes));
            else dom.append(mapEl, nodes);
            if (!initialRender) {
              mapEl.classList.remove('flash');
              window.setTimeout(() => {
                mapEl.classList.add('flash');
              }, 1);
            }
            this.checkDepends();
            const tabGroups = mapEl.querySelectorAll(
              '.cbi-map-tabbed, .cbi-section-node-tabbed',
            );
            for (let i = 0; i < tabGroups.length; i++)
              ui.tabs.initTabGroup(tabGroups[i].childNodes);
            return mapEl;
          }, this),
        );
      },
    },
    tabs: {
      initTabGroup(panes) {
        if (
          typeof panes != 'object' ||
          !('length' in panes) ||
          panes.length === 0
        )
          return;
        const menu = E('ul', { class: 'cbi-tabmenu' });
        const group = panes[0].parentNode;
        let selected = null;
        if (group.getAttribute('data-initialized') === 'true') return;
        let pane;
        for (let i = 0; i < panes.length; i++) {
          pane = panes[i];
          const name = pane.getAttribute('data-tab');
          const title = pane.getAttribute('data-tab-title');
          const active = pane.getAttribute('data-tab-active') === 'true';
          menu.appendChild(
            E(
              'li',
              {
                style: this.isEmptyPane(pane) ? 'display:none' : null,
                class: active ? 'cbi-tab' : 'cbi-tab-disabled',
                'data-tab': name,
              },
              E('a', { href: '#', click: this.switchTab.bind(this) }, title),
            ),
          );
          if (active) selected = i;
        }
        group.parentNode.insertBefore(menu, group);
        group.setAttribute('data-initialized', true);
        if (selected === null) {
          selected = this.getActiveTabId(panes[0]);
          if (
            selected < 0 ||
            selected >= panes.length ||
            this.isEmptyPane(panes[selected])
          ) {
            for (let i = 0; i < panes.length; i++) {
              if (!this.isEmptyPane(panes[i])) {
                selected = i;
                break;
              }
            }
          }
          menu.childNodes[selected].classList.add('cbi-tab');
          menu.childNodes[selected].classList.remove('cbi-tab-disabled');
          panes[selected].setAttribute('data-tab-active', 'true');
          this.setActiveTabId(panes[selected], selected);
        }
        requestAnimationFrame(
          L.bind(
            (pane) => {
              pane.dispatchEvent(
                new CustomEvent('cbi-tab-active', {
                  detail: { tab: pane.getAttribute('data-tab') },
                }),
              );
            },
            this,
            panes[selected],
          ),
        );
        this.updateTabs(group);
      },
      updateTabs(ev, root) {
        (root ?? document).querySelectorAll('[data-tab-title]').forEach(
          L.bind((pane) => {
            const menu = pane.parentNode.previousElementSibling;
            const tab = menu
              ? menu.querySelector(
                  '[data-tab="%s"]'.format(pane.getAttribute('data-tab')),
                )
              : null;
            const n_errors = pane.querySelectorAll('.cbi-input-invalid').length;
            if (!menu || !tab) return;
            if (this.isEmptyPane(pane)) {
              tab.style.display = 'none';
              tab.classList.remove('flash');
            } else if (tab.style.display === 'none') {
              tab.style.display = '';
              requestAnimationFrame(() => tab.classList.add('flash'));
            }
            if (n_errors) {
              tab.setAttribute('data-errors', n_errors);
              tab.setAttribute(
                'data-tooltip',
                _('%d invalid field(s)').format(n_errors),
              );
              tab.setAttribute('data-tooltip-style', 'error');
            } else {
              tab.removeAttribute('data-errors');
              tab.removeAttribute('data-tooltip');
            }
          }, this),
        );
      },
      switchTab(ev) {
        const tab = ev.target.parentNode;
        const name = tab.getAttribute('data-tab');
        const menu = tab.parentNode;
        const group = menu.nextElementSibling;
        let index = 0;
        ev.preventDefault();
        if (!tab.classList.contains('cbi-tab-disabled')) return;
        menu.querySelectorAll('[data-tab]').forEach((tab) => {
          tab.classList.remove('cbi-tab');
          tab.classList.remove('cbi-tab-disabled');
          tab.classList.add(
            tab.getAttribute('data-tab') === name
              ? 'cbi-tab'
              : 'cbi-tab-disabled',
          );
        });
        group.childNodes.forEach((pane) => {
          if (dom.matches(pane, '[data-tab]')) {
            if (pane.getAttribute('data-tab') === name) {
              pane.setAttribute('data-tab-active', 'true');
              pane.dispatchEvent(
                new CustomEvent('cbi-tab-active', { detail: { tab: name } }),
              );
              UI.prototype.tabs.setActiveTabId(pane, index);
            } else {
              pane.setAttribute('data-tab-active', 'false');
            }
            index++;
          }
        });
      },
    },
    grid: {
      handleAdd(ev, name) {
        const config_name = this.uciconfig ?? this.map.config;
        const section_id = this.map.data.add(
          config_name,
          this.sectiontype,
          name,
        );
        const mapNode = this.getPreviousModalMap();
        const prevMap = mapNode ? dom.findClassInstance(mapNode) : this.map;
        prevMap.addedSection = section_id;
        return this.renderMoreOptionsModal(section_id);
      },
      handleModalCancel(modalMap, ev, isSaving) {
        const config_name = this.uciconfig ?? this.map.config;
        const mapNode = this.getPreviousModalMap();
        const prevMap = mapNode ? dom.findClassInstance(mapNode) : this.map;
        if (prevMap.addedSection != null && !isSaving)
          this.map.data?.remove(config_name, prevMap.addedSection);
        delete prevMap.addedSection;
        return this.super('handleModalCancel', arguments);
      },
      handleModalSave(modalMap, ev) {
        const mapNode = this.getActiveModalMap();
        let activeMap = dom.findClassInstance(mapNode);
        let saveTasks = activeMap.save(null, true);
        while (activeMap.parent) {
          activeMap = activeMap.parent;
          saveTasks = saveTasks
            .then(L.bind(activeMap.load, activeMap))
            .then(L.bind(activeMap.reset, activeMap));
        }
        return saveTasks
          .then(L.bind(this.handleModalCancel, this, modalMap, ev, true))
          .catch(() => {});
      },
    },
  };
}
