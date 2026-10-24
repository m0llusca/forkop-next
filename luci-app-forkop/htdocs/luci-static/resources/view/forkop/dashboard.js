"use strict";
"require baseclass";
"require form";
"require ui";
"require uci";
"require fs";
"require view.forkop.main as main";

function createDashboardContent(section) {
  const o = section.option(form.DummyValue, "_mount_node");
  o.rawhtml = true;
  o.cfgvalue = () => {
    main.DashboardTab.initController();
    const root = document.createElement("div");
    const sources = document.createElement("div");
    sources.className = "fkp-workspace-sources";
    const help = document.createElement("p");
    help.textContent =
      "Ссылки и подписки, VPN-интерфейсы, JSON, URLTest и резервирование по приоритету настраиваются в источниках подключения внутри правила.";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "cbi-button";
    edit.textContent = "Добавить или изменить источники";
    edit.onclick = () =>
      root
        .closest(".cbi-map")
        ?.querySelector('.cbi-tabmenu [data-tab="section"] a')
        ?.click();
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "Добавить подключение";
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    add.onclick = () => {
      if (
        !main.navigateToRule(root, {
          kind: "create",
          option: "subscription_url",
        })
      )
        status.textContent =
          "Не удалось открыть создание подключения. Повторите действие в правилах.";
    };
    sources.append(add, help, edit, status);
    root.append(sources, main.DashboardTab.render());
    return root;
  };
}

const EntryPoint = {
  createDashboardContent,
};

return baseclass.extend(EntryPoint);
