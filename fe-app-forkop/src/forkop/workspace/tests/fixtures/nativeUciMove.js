/* eslint-disable */
// Verbatim LuCI UCI.move captured 2026-10-25. Test fixture only.
// Copyright LuCI contributors. Apache-2.0; see LUCI-LICENSE.
// https://github.com/openwrt/luci/blob/master/modules/luci-base/htdocs/luci-static/resources/uci.js
// Captured file SHA256 a18a6df989d046ac8564770b2d17348ef94d49d5e3fd97c926d404f7b72f2429
({
  move(conf, sid1, sid2, after) {
    const sa = this.sections(conf);
    let s1 = null;
    let s2 = null;
    sid1 = this.resolveSID(conf, sid1);
    sid2 = this.resolveSID(conf, sid2);
    for (let i = 0; i < sa.length; i++) {
      if (sa[i]['.name'] != sid1) continue;
      s1 = sa[i];
      sa.splice(i, 1);
      break;
    }
    if (s1 == null) return false;
    if (sid2 == null) {
      sa.push(s1);
    } else {
      for (let i = 0; i < sa.length; i++) {
        if (sa[i]['.name'] != sid2) continue;
        s2 = sa[i];
        sa.splice(i + !!after, 0, s1);
        break;
      }
      if (s2 == null) return false;
    }
    for (let i = 0; i < sa.length; i++)
      this.get(conf, sa[i]['.name'])['.index'] = i;
    if (this.state) this.state.reorder[conf] = true;
    return true;
  },
});
