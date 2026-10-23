"use strict";
"require baseclass";
"require form";
"require view.forkop.main as main";
return baseclass.extend({
  createNextContent: function (section) {
    const option = section.option(form.DummyValue, "_next_panel");
    option.rawhtml = true;
    option.cfgvalue = function () {
      return main.renderNextPanel(undefined, main.getDashboardSections);
    };
  },
});
