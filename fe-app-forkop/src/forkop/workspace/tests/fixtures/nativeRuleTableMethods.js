/* eslint-disable */
// Verbatim focused LuCI methods captured 2026-10-24. Test fixture only.
// Copyright LuCI contributors. Apache-2.0; see LUCI-LICENSE in this directory.
// Upstream: https://github.com/openwrt/luci/tree/master/modules/luci-base/htdocs/luci-static/resources
// form.js SHA256 b68bebcbb5eef7256790b9dcb821bf6b1d4104b72fb076dda2e67268d7254787
// Method selection, wrapper and formatting added; method bodies retain native semantics.
export function nativeRuleTableMethods(E, dom, L, _) {
  return {
    stripTags(s) {
      if (typeof s == 'string' && !s.match(/[<>&]/)) return s;
      const x = dom.elem(s) ? s : dom.parse(`<div>${s}</div>`);
      x.querySelectorAll('br').forEach((br) => {
        x.replaceChild(document.createTextNode('\n'), br);
      });
      return (x.textContent ?? x.innerText ?? '').replace(/([ \t]*\n)+/g, '\n');
    },
    titleFn(attr, ...args) {
      let s = null;
      if (typeof this[attr] == 'function') s = this[attr](...args);
      else if (typeof this[attr] == 'string')
        s = args.length ? this[attr].format(...args) : this[attr];
      if (s != null) s = this.stripTags(String(s)).trim();
      if (s == null || s == '') return null;
      return s;
    },
    renderContents(cfgsections, nodes) {
      const section_id = null;
      const config_name = this.uciconfig ?? this.map.config;
      const max_cols = this.max_cols ?? this.children.length;
      const cloneable = this.cloneable;
      const has_more = max_cols < this.children.length;
      const drag_sort = this.sortable && !('ontouchstart' in window);
      const touch_sort = this.sortable && 'ontouchstart' in window;
      const sectionEl = E('div', {
        id: 'cbi-%s-%s'.format(config_name, this.sectiontype),
        class: 'cbi-section cbi-tblsection',
        'data-tab':
          this.map.tabbed && !this.parentoption ? this.sectiontype : null,
        'data-tab-title':
          this.map.tabbed && !this.parentoption
            ? this.title || this.sectiontype
            : null,
      });
      const tableEl = E('table', { class: 'table cbi-section-table' });
      const theadEl = E('thead', { class: 'thead cbi-section-thead' });
      const tbodyEl = E('tbody', { class: 'tbody cbi-section-tbody' });
      const tfootEl = E('tfoot', { class: 'tfoot cbi-section-tfoot' });
      if (this.title != null && this.title != '' && !this.hidetitle)
        sectionEl.appendChild(E('h3', {}, this.title));
      if (this.description != null && this.description != '')
        sectionEl.appendChild(
          E('div', { class: 'cbi-section-descr' }, this.description),
        );
      theadEl.appendChild(this.renderHeaderRows(false));
      if (theadEl.hasChildNodes()) tableEl.appendChild(theadEl);
      for (let i = 0; i < nodes.length; i++) {
        let sectionname = this.titleFn('sectiontitle', cfgsections[i]);
        if (sectionname == null) sectionname = cfgsections[i];
        const trEl = E('tr', {
          id: 'cbi-%s-%s'.format(config_name, cfgsections[i]),
          class: 'tr cbi-section-table-row',
          'data-sid': cfgsections[i],
          dragover: drag_sort ? L.bind(this.handleDragOver, this) : null,
          dragenter: drag_sort ? L.bind(this.handleDragEnter, this) : null,
          dragleave: drag_sort ? L.bind(this.handleDragLeave, this) : null,
          dragend: drag_sort ? L.bind(this.handleDragEnd, this) : null,
          drop: drag_sort ? L.bind(this.handleDrop, this) : null,
          touchend: touch_sort ? L.bind(this.handleTouchEnd, this) : null,
          'data-title':
            sectionname && (!this.anonymous || this.sectiontitle)
              ? sectionname
              : null,
          'data-section-id': cfgsections[i],
        });
        if (this.extedit || this.rowcolors)
          trEl.classList.add(
            !(tbodyEl.childNodes.length % 2)
              ? 'cbi-rowstyle-1'
              : 'cbi-rowstyle-2',
          );
        if (sectionname && (!this.anonymous || this.sectiontitle)) {
          trEl.appendChild(
            E('td', { class: 'td cbi-value-field cbi-section-table-titles' }, [
              sectionname && (!this.anonymous || this.sectiontitle)
                ? sectionname
                : null,
            ]),
          );
        }
        for (let j = 0; j < max_cols && nodes[i].firstChild; j++)
          trEl.appendChild(nodes[i].firstChild);
        trEl.appendChild(
          this.renderRowActions(cfgsections[i], has_more ? _('More…') : null),
        );
        tbodyEl.appendChild(trEl);
      }
      if (nodes.length == 0)
        tbodyEl.appendChild(
          E(
            'tr',
            { class: 'tr cbi-section-table-row placeholder' },
            E('td', { class: 'td' }, this.renderSectionPlaceholder()),
          ),
        );
      tableEl.appendChild(tbodyEl);
      tfootEl.appendChild(this.renderFooterRows(false));
      if (tfootEl.hasChildNodes()) tableEl.appendChild(tfootEl);
      sectionEl.appendChild(tableEl);
      setTimeout(() => {
        try {
          this.stabilizeActionColumnWidth(tableEl);
        } catch (e) {}
      }, 0);
      sectionEl.appendChild(this.renderSectionAdd('cbi-tblsection-create'));
      dom.bindClassInstance(sectionEl, this);
      return sectionEl;
    },
    renderTextValue(section_id, opt) {
      const title = this.stripTags(opt.title).trim();
      const descr = this.stripTags(opt.description).trim();
      const value = opt.textvalue(section_id);
      return E(
        'td',
        {
          class: 'td cbi-value-field',
          'data-title': title != '' ? title : null,
          'data-description': descr != '' ? descr : null,
          'data-name': opt.option,
          'data-widget': 'CBI.DummyValue',
        },
        value != null ? value : E('em', _('none')),
      );
    },
  };
}
