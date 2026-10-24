"use strict";
"require view";
"require form";
"require baseclass";
"require uci";
"require ui";
"require view.forkop.main as main";
"require view.forkop.next as next";

// Global settings
"require view.forkop.settings as settings";

// Sections
"require view.forkop.section as section";

// Server
"require view.forkop.server as server";

// Dashboard
"require view.forkop.dashboard as dashboard";

// Monitoring
"require view.forkop.monitoring as monitoring";

// Diagnostic
"require view.forkop.diagnostic as diagnostic";

// Updates
"require view.forkop.updates as updates";

const UCI_PACKAGE = main.FORKOP_UCI_PACKAGE;

function getRuleEditButtonText() {
  const label = _("Edit rule action");

  return label === "Edit rule action" ? "Edit" : label;
}

function configureGridSection(sectionRef, type, title, addTitle) {
  sectionRef.anonymous = false;
  sectionRef.addremove = true;
  sectionRef.sortable = true;
  sectionRef.rowcolors = true;
  sectionRef.nodescriptions = true;
  sectionRef.modaltitle = function (section_id) {
    const label = uci.get(UCI_PACKAGE, section_id, "label");
    return section_id ? `${title}: ${label || section_id}` : addTitle;
  };
  sectionRef.sectiontitle = function (section_id) {
    return uci.get(UCI_PACKAGE, section_id, "label") || section_id;
  };

  if (type === "section") {
    sectionRef.renderRowActions = function (section_id) {
      return form.TableSection.prototype.renderRowActions.call(
        this,
        section_id,
        getRuleEditButtonText(),
      );
    };
  }
}

const EntryPoint = {
  async render() {
    main.injectGlobalStyles();
    main.registerConfigurationReload();
    const uiCapabilities = {
      loaded: false,
      singBoxExtended: false,
      singBoxTiny: false,
      singBoxTailscale: true,
      zapretInstalled: false,
      zapret2Installed: false,
      byedpiInstalled: false,
      serverInboundsEnabledCount: -1,
    };
    let uiCapabilitiesPromise = null;
    let serverSectionRef = null;
    let mapRendered = false;
    let initializeSettings = null;
    const capabilityNotice = document.createElement("div");
    const capabilityMessage = document.createElement("p");
    capabilityMessage.setAttribute("role", "status");
    capabilityMessage.textContent =
      "Проверяем возможности компонентов. Настройки появятся после проверки; правила и обзор уже доступны.";
    const retryCapabilities = document.createElement("button");
    retryCapabilities.type = "button";
    retryCapabilities.textContent = "Повторить проверку";
    capabilityNotice.append(capabilityMessage, retryCapabilities);
    const showCapabilityError = function () {
      capabilityMessage.textContent =
        "Не удалось проверить возможности компонентов. Настройки временно недоступны. Повторите проверку.";
    };
    retryCapabilities.onclick = function () {
      retryCapabilities.disabled = true;
      capabilityMessage.textContent = "Проверяем возможности компонентов…";
      void loadUiCapabilities()
        .then(function () {
          return initializeSettings?.();
        })
        .catch(showCapabilityError)
        .finally(function () {
          retryCapabilities.disabled = false;
        });
    };

    const applyUiCapabilities = function () {
      if (mapRendered && initializeSettings)
        void initializeSettings().catch(showCapabilityError);
      if (serverSectionRef) {
        server.applyServerCapabilities(serverSectionRef, uiCapabilities);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(main.FORKOP_ACTION_PROVIDERS_AVAILABILITY_EVENT, {
            detail: {
              zapretInstalled: uiCapabilities.zapretInstalled,
              zapret2Installed: uiCapabilities.zapret2Installed,
              byedpiInstalled: uiCapabilities.byedpiInstalled,
            },
          }),
        );
      }

      if (main.store && typeof main.store.set === "function") {
        const currentSystemInfo = main.store.get().diagnosticsSystemInfo;
        main.store.set({
          diagnosticsSystemInfo: {
            ...currentSystemInfo,
            providerInfoLoaded: true,
            sing_box_extended: uiCapabilities.singBoxExtended ? 1 : 0,
            sing_box_tiny: uiCapabilities.singBoxTiny ? 1 : 0,
            sing_box_tailscale: uiCapabilities.singBoxTailscale ? 1 : 0,
            zapret_installed: uiCapabilities.zapretInstalled ? 1 : 0,
            zapret2_installed: uiCapabilities.zapret2Installed ? 1 : 0,
            byedpi_installed: uiCapabilities.byedpiInstalled ? 1 : 0,
            server_inbounds_enabled_count:
              uiCapabilities.serverInboundsEnabledCount,
            zapret_version: uiCapabilities.zapretInstalled
              ? currentSystemInfo.zapret_version
              : "not installed",
            zapret2_version: uiCapabilities.zapret2Installed
              ? currentSystemInfo.zapret2_version
              : "not installed",
            byedpi_version: uiCapabilities.byedpiInstalled
              ? currentSystemInfo.byedpi_version
              : "not installed",
          },
        });
      }
    };

    const updateUiCapabilities = function (data) {
      const evidenceKeys = [
        "sing_box_extended",
        "sing_box_tiny",
        "zapret_installed",
        "zapret2_installed",
        "byedpi_installed",
      ];
      if (
        !data ||
        !evidenceKeys.every(function (key) {
          return [0, 1, "0", "1", true, false].includes(data[key]);
        })
      )
        throw new Error("UI capability evidence unavailable");
      uiCapabilities.loaded = true;
      uiCapabilities.singBoxExtended = Boolean(
        Number(data?.sing_box_extended) === 1,
      );
      uiCapabilities.singBoxTiny = Boolean(Number(data?.sing_box_tiny) === 1);
      uiCapabilities.singBoxTailscale =
        typeof data?.sing_box_tailscale === "undefined"
          ? true
          : Boolean(Number(data.sing_box_tailscale) === 1);
      uiCapabilities.zapretInstalled = Boolean(
        Number(data?.zapret_installed) === 1,
      );
      uiCapabilities.zapret2Installed = Boolean(
        Number(data?.zapret2_installed) === 1,
      );
      uiCapabilities.byedpiInstalled = Boolean(
        Number(data?.byedpi_installed) === 1,
      );
      const serverInboundsEnabledCount =
        typeof data?.server_inbounds_enabled_count !== "undefined"
          ? Number(data.server_inbounds_enabled_count)
          : -1;
      uiCapabilities.serverInboundsEnabledCount = Number.isFinite(
        serverInboundsEnabledCount,
      )
        ? serverInboundsEnabledCount
        : -1;

      applyUiCapabilities();

      return uiCapabilities;
    };

    const applyUiState = function (data) {
      const result = updateUiCapabilities(data?.capabilities || data || {});

      if (typeof main.applyUiStateToStore === "function" && data?.service) {
        main.applyUiStateToStore(data);
      } else if (
        main.store &&
        typeof main.store.set === "function" &&
        data?.service
      ) {
        main.store.set({
          servicesInfoWidget: {
            loading: false,
            failed: false,
            data: {
              singbox: Number(data.service.sing_box?.running) || 0,
              forkopRunning: Number(data.service.forkop?.running) || 0,
              forkopEnabled: Number(data.service.forkop?.enabled) || 0,
              forkopStatus: data.service.forkop?.status || "",
            },
          },
        });
      }

      return result;
    };

    const loadFallbackUiCapabilities = function () {
      return Promise.allSettled([
        main.ForkopShellMethods.getServerCapabilities(),
        main.ForkopShellMethods.checkZapretRuntime(),
        main.ForkopShellMethods.checkZapret2Runtime(),
        main.ForkopShellMethods.checkByedpiRuntime(),
        main.ForkopShellMethods.checkInboundsConfig(),
      ]).then(
        ([
          serverCapabilitiesResult,
          zapretRuntimeResult,
          zapret2RuntimeResult,
          byedpiRuntimeResult,
          inboundsConfigResult,
        ]) => {
          const serverCapabilities =
            serverCapabilitiesResult.status === "fulfilled"
              ? serverCapabilitiesResult.value
              : null;
          const zapretRuntime =
            zapretRuntimeResult.status === "fulfilled"
              ? zapretRuntimeResult.value
              : null;
          const zapret2Runtime =
            zapret2RuntimeResult.status === "fulfilled"
              ? zapret2RuntimeResult.value
              : null;
          const byedpiRuntime =
            byedpiRuntimeResult.status === "fulfilled"
              ? byedpiRuntimeResult.value
              : null;
          const inboundsConfig =
            inboundsConfigResult.status === "fulfilled"
              ? inboundsConfigResult.value
              : null;

          if (
            !serverCapabilities?.success ||
            !zapretRuntime?.success ||
            !zapret2Runtime?.success ||
            !byedpiRuntime?.success ||
            !inboundsConfig?.success ||
            ![
              serverCapabilities.data?.sing_box_extended,
              serverCapabilities.data?.sing_box_tiny,
              zapretRuntime.data?.zapret_installed,
              zapret2Runtime.data?.zapret2_installed,
              byedpiRuntime.data?.byedpi_installed,
            ].every(function (value) {
              return [0, 1, "0", "1", true, false].includes(value);
            })
          )
            throw new Error("Fallback capability evidence unavailable");

          return updateUiCapabilities({
            sing_box_extended:
              serverCapabilities?.success &&
              Number(serverCapabilities.data?.sing_box_extended) === 1
                ? 1
                : 0,
            sing_box_tiny:
              serverCapabilities?.success &&
              Number(serverCapabilities.data?.sing_box_tiny) === 1
                ? 1
                : 0,
            sing_box_tailscale:
              !serverCapabilities?.success ||
              typeof serverCapabilities.data?.sing_box_tailscale ===
                "undefined" ||
              Number(serverCapabilities.data?.sing_box_tailscale) === 1
                ? 1
                : 0,
            zapret_installed:
              zapretRuntime?.success &&
              Number(zapretRuntime.data?.zapret_installed) === 1
                ? 1
                : 0,
            zapret2_installed:
              zapret2Runtime?.success &&
              Number(zapret2Runtime.data?.zapret2_installed) === 1
                ? 1
                : 0,
            byedpi_installed:
              byedpiRuntime?.success &&
              Number(byedpiRuntime.data?.byedpi_installed) === 1
                ? 1
                : 0,
            server_inbounds_enabled_count:
              inboundsConfig?.success &&
              typeof inboundsConfig.data?.enabled_count !== "undefined"
                ? inboundsConfig.data.enabled_count
                : -1,
          });
        },
      );
    };

    const loadUiCapabilities = function () {
      if (uiCapabilities.loaded) {
        return Promise.resolve(uiCapabilities);
      }

      if (uiCapabilitiesPromise) {
        return uiCapabilitiesPromise;
      }

      uiCapabilitiesPromise = main.ForkopShellMethods.getUiCapabilities()
        .then((response) => {
          if (!response?.success) {
            throw new Error("UI capabilities request failed");
          }

          return updateUiCapabilities(response.data);
        })
        .catch((error) => {
          console.warn("Failed to load Forkop UI capabilities", error);
          return main.ForkopShellMethods.getUiState()
            .then((response) => {
              if (!response?.success) {
                throw new Error("UI state request failed");
              }

              return applyUiState(response.data);
            })
            .catch((fallbackError) => {
              console.warn("Failed to load Forkop UI state", fallbackError);
              return loadFallbackUiCapabilities();
            });
        })
        .finally(() => {
          uiCapabilitiesPromise = null;
        });

      return uiCapabilitiesPromise;
    };
    const forkopMap = new form.Map(
      UCI_PACKAGE,
      _("Forkop Settings"),
      _("Configuration for Forkop service"),
    );
    forkopMap.tabbed = true;
    let nativeDirty = false;
    let mutationBusy = false;
    let synchronizationFailed = false;
    let pendingSaved = false;
    let refreshingNative = false;
    let stateVersion = 0;
    let preserveToolHosts = false;
    let disabledControls = [];
    const pendingBar = document.createElement("div");
    pendingBar.className = "fkp-next-notice";
    pendingBar.setAttribute("role", "status");
    pendingBar.hidden = true;
    const pendingText = document.createElement("span");
    const saveDraft = document.createElement("button");
    saveDraft.type = "button";
    saveDraft.textContent = "Сохранить изменения";
    const applyDraft = document.createElement("button");
    applyDraft.type = "button";
    applyDraft.textContent = "Применить сейчас";
    const refreshEditor = document.createElement("button");
    refreshEditor.type = "button";
    refreshEditor.textContent = "Обновить редактор";
    refreshEditor.hidden = true;
    pendingBar.append(pendingText, saveDraft, applyDraft, refreshEditor);
    const showPending = function (message) {
      pendingBar.hidden = false;
      pendingText.textContent =
        message ||
        (nativeDirty
          ? "Есть несохранённые изменения. Сохранение оставит их неприменёнными; применение изменит работу роутера."
          : "Изменения сохранены, но ещё не применены. Нажмите «Применить сейчас», затем повторите действие.");
    };
    const localChanges = function () {
      return ["changes", "creates", "deletes", "reorder"].some(function (kind) {
        const value = uci.state?.[kind]?.[UCI_PACKAGE];
        return value === true || Object.keys(value || {}).length > 0;
      });
    };
    const readPending = async function () {
      const changes = await uci.changes();
      if (!changes || typeof changes !== "object")
        throw new Error("native_state_unavailable");
      return (
        Object.keys(changes[UCI_PACKAGE] || {}).length > 0 || localChanges()
      );
    };
    const originalSave = forkopMap.save;
    forkopMap.save = function () {
      if (mutationBusy || refreshingNative || synchronizationFailed)
        return Promise.reject(new Error("native_refresh_required"));
      stateVersion++;
      return Promise.resolve(originalSave.apply(this, arguments)).then(
        async function (result) {
          nativeDirty = false;
          try {
            pendingSaved = await readPending();
          } catch (error) {
            showPending(
              "Изменения сохранены; не удалось проверить, применены ли они. Повторите действие после восстановления связи.",
            );
            return result;
          }
          if (pendingSaved) showPending();
          else pendingBar.hidden = true;
          return result;
        },
      );
    };
    const originalReset = forkopMap.reset;
    forkopMap.reset = function () {
      return Promise.resolve(originalReset.apply(this, arguments)).then(
        function (result) {
          nativeDirty = false;
          if (!pendingSaved) pendingBar.hidden = true;
          return result;
        },
      );
    };
    const synchronizeNative = async function () {
      try {
        uci.unload(UCI_PACKAGE);
        await uci.load(UCI_PACKAGE);
        await forkopMap.load();
        preserveToolHosts = true;
        try {
          await forkopMap.reset();
        } finally {
          preserveToolHosts = false;
        }
        synchronizationFailed = false;
        refreshEditor.hidden = true;
        showPending(
          "Изменения применены. Данные обновлены без перезагрузки страницы.",
        );
      } catch (error) {
        synchronizationFailed = true;
        refreshEditor.hidden = false;
        showPending(
          "Изменения применены, но не удалось обновить данные редактора. Нажмите «Обновить редактор»; до этого сохранение редактора заблокировано.",
        );
      }
    };
    refreshEditor.onclick = async function () {
      if (mutationBusy || refreshingNative) return;
      refreshingNative = true;
      rendered.inert = true;
      try {
        if (nativeDirty || (await readPending())) {
          showPending(
            "Черновик сохранён в редакторе. Сначала отмените его штатной кнопкой LuCI, затем обновите редактор.",
          );
          return;
        }
        await synchronizeNative();
      } catch (error) {
        showPending(
          "Не удалось проверить неприменённые изменения. Повторите обновление после восстановления связи.",
        );
      } finally {
        rendered.inert = false;
        refreshingNative = false;
      }
    };
    saveDraft.onclick = function () {
      void forkopMap.save().catch(function () {
        showPending(
          "Не удалось сохранить изменения. Исправьте отмеченные поля и повторите сохранение.",
        );
      });
    };
    applyDraft.onclick = function (event) {
      return forkopView
        .handleSaveApply(event, "0")
        .then(function () {
          showPending(
            "Изменения сохранены. Применение запущено в LuCI — дождитесь результата в штатном диалоге.",
          );
        })
        .catch(function () {
          showPending(
            "Не удалось применить изменения. Проверьте поля и состояние сервиса, затем повторите применение.",
          );
        });
    };
    const originalRenderContents = forkopMap.renderContents;
    forkopMap.renderContents = function () {
      const activeTab = preserveToolHosts
        ? this.root?.querySelector('.cbi-map-tabbed > [data-tab-active="true"]')
            ?.dataset.tab
        : null;
      const retainedTools = preserveToolHosts
        ? Array.from(
            this.root?.querySelectorAll(".fkp-workspace-tools") || [],
          ).filter(function (host) {
            return host.querySelector(".fkp-next");
          })
        : [];
      const originalParents = retainedTools.map(function (host) {
        return host.parentElement;
      });
      const staging = retainedTools.length
        ? document.createElement("div")
        : null;
      if (staging) {
        staging.hidden = true;
        this.root.before(staging);
        retainedTools.forEach(function (host) {
          staging.append(host);
        });
      }
      if (this.root) {
        if (!retainedTools.length) main.disposeWorkspaceTools(this.root);
        else
          this.root
            .querySelectorAll(".fkp-workspace-tools")
            .forEach(function (host) {
              if (!retainedTools.includes(host))
                host.dispatchEvent(new Event("forkop:dispose-tools"));
            });
      }
      return Promise.resolve(originalRenderContents.apply(this, arguments))
        .then(function (rendered) {
          retainedTools.forEach(function (host) {
            const replacement = rendered.querySelector(
              '.fkp-workspace-tools[data-tools-area="' +
                host.dataset.toolsArea +
                '"]',
            );
            if (replacement) {
              replacement.dispatchEvent(new Event("forkop:dispose-tools"));
              replacement.replaceWith(host);
            }
          });
          staging?.remove();
          main.mountForkopWorkspace(rendered);
          rendered.prepend(pendingBar);
          if (activeTab)
            rendered
              .querySelector('.cbi-tabmenu [data-tab="' + activeTab + '"] a')
              ?.click();
          retainedTools.forEach(function (host) {
            host
              .querySelector(".fkp-next")
              ?.dispatchEvent(new Event("forkop:refresh"));
          });
          return rendered;
        })
        .catch((error) => {
          retainedTools.forEach((host, index) => {
            if (host.parentElement === staging) {
              const parent = originalParents[index];
              (parent?.isConnected ? parent : this.root).append(host);
            }
          });
          staging?.remove();
          throw error;
        });
    };
    const forkopView = this;
    const originalHandleSaveApply = forkopView.handleSaveApply;
    forkopView.handleSaveApply = function (ev, mode) {
      if (mutationBusy || refreshingNative || synchronizationFailed)
        return Promise.reject(new Error("native_refresh_required"));
      const refreshUiState = function () {
        main.ForkopShellMethods.getUiState()
          .then((response) => {
            if (
              response?.success &&
              typeof main.applyUiStateToStore === "function"
            ) {
              main.applyUiStateToStore(response.data);
            }
          })
          .catch(() => null);
      };

      if (main.store && typeof main.store.set === "function") {
        const servicesInfoWidget = main.store.get().servicesInfoWidget;
        main.store.set({
          servicesInfoWidget: {
            ...servicesInfoWidget,
            data: {
              ...servicesInfoWidget.data,
              forkopStatus: "reloading",
            },
          },
        });
      }

      return Promise.resolve()
        .then(() => originalHandleSaveApply.call(this, ev, mode))
        .then((result) => {
          window.setTimeout(refreshUiState, 250);

          return result;
        })
        .catch((error) => {
          refreshUiState();

          throw error;
        });
    };

    const nextSection = forkopMap.section(
      form.TypedSection,
      "next",
      "Обзор и управление",
    );
    nextSection.anonymous = true;
    nextSection.addremove = false;
    nextSection.cfgsections = function () {
      return ["next"];
    };
    next.createNextContent(nextSection);

    const rulesSection = forkopMap.section(
      form.GridSection,
      "section",
      "Правила",
      _("Drag rows to change priority. The rule at the top is checked first."),
    );
    configureGridSection(
      rulesSection,
      "section",
      "Правило",
      "Добавить правило",
    );
    section.configureSectionSection(rulesSection, {
      loadActionProvidersAvailability: loadUiCapabilities,
    });
    section.createSectionContent(rulesSection);
    main.configureNamedSectionCreation(
      rulesSection,
      "Новое правило",
      "Добавить правило",
    );

    const serverSection = forkopMap.section(
      form.GridSection,
      "server",
      _("Servers"),
      _("Accept external proxy connections and route them with sing-box."),
    );
    configureGridSection(
      serverSection,
      "server",
      _("Server"),
      _("Add a server inbound"),
    );
    serverSectionRef = serverSection;
    server.configureServerSection(serverSection, {
      loadCapabilities: loadUiCapabilities,
    });
    server.createServerContent(serverSection, uiCapabilities);
    main.configureNamedSectionCreation(
      serverSection,
      "Входящее подключение",
      "Добавить входящее подключение",
    );

    const settingsSection = forkopMap.section(
      form.TypedSection,
      "settings",
      _("Settings"),
    );
    settingsSection.anonymous = true;
    settingsSection.addremove = false;
    settingsSection.cfgsections = function () {
      return ["settings"];
    };
    const pendingSettings = settingsSection.option(
      form.DummyValue,
      "_capabilities_pending",
    );
    pendingSettings.rawhtml = true;
    pendingSettings.cfgvalue = function () {
      return capabilityNotice;
    };
    let settingsReady = false;
    let settingsMountPromise = null;
    const originalSettingsParse = settingsSection.parse;
    settingsSection.parse = function () {
      // Unmounted fields must never parse null form values into UCI deletions.
      return settingsReady
        ? originalSettingsParse.apply(this, arguments)
        : Promise.resolve();
    };
    initializeSettings = function () {
      if (!mapRendered || !uiCapabilities.loaded || settingsReady)
        return Promise.resolve();
      if (settingsMountPromise) return settingsMountPromise;
      const pendingChildren = settingsSection.children;
      settingsMountPromise = Promise.resolve()
        .then(async function () {
          settingsSection.children = [];
          try {
            settings.createSettingsContent(settingsSection, uiCapabilities);
            await settingsSection.load();
            const pane = await settingsSection.render();
            const previous = forkopMap.findElement(
              '.cbi-map-tabbed > .cbi-section[data-tab="settings"]',
            );
            if (!previous) throw new Error("Settings pane unavailable");
            if (previous.hasAttribute("data-tab-active"))
              pane.setAttribute(
                "data-tab-active",
                previous.getAttribute("data-tab-active"),
              );
            previous.replaceWith(pane);
            settingsReady = true;
            forkopMap.checkDepends();
          } catch (error) {
            settingsSection.children = pendingChildren;
            throw error;
          }
        })
        .finally(function () {
          settingsMountPromise = null;
        });
      return settingsMountPromise;
    };

    const diagnosticSection = forkopMap.section(
      form.TypedSection,
      "diagnostic",
      _("Diagnostics"),
    );
    diagnosticSection.anonymous = true;
    diagnosticSection.addremove = false;
    diagnosticSection.cfgsections = function () {
      return ["diagnostic"];
    };
    diagnostic.createDiagnosticContent(diagnosticSection);

    const dashboardSection = forkopMap.section(
      form.TypedSection,
      "dashboard",
      _("Dashboard"),
    );
    dashboardSection.anonymous = true;
    dashboardSection.addremove = false;
    dashboardSection.cfgsections = function () {
      return ["dashboard"];
    };
    dashboard.createDashboardContent(dashboardSection);

    const monitoringSection = forkopMap.section(
      form.TypedSection,
      "monitoring",
      _("Monitoring"),
    );
    monitoringSection.anonymous = true;
    monitoringSection.addremove = false;
    monitoringSection.cfgsections = function () {
      return ["monitoring"];
    };
    monitoring.createMonitoringContent(monitoringSection);

    const updatesSection = forkopMap.section(
      form.TypedSection,
      "updates",
      _("Components"),
    );
    updatesSection.anonymous = true;
    updatesSection.addremove = false;
    updatesSection.cfgsections = function () {
      return ["updates"];
    };
    updates.createUpdatesContent(updatesSection);

    // Append UI-only panes: existing native tab indices retain their meaning.
    for (const [id, title, area] of [
      ["devices", "Маршруты устройств", "devices"],
      ["rule_tools", "Временные правила и рекомендации", "rules"],
      ["route_tools", "Проверка маршрута", "diagnostics"],
      ["advanced", "Профили и совместимость", "settings"],
    ]) {
      const toolsSection = forkopMap.section(form.TypedSection, id, title);
      toolsSection.anonymous = true;
      toolsSection.addremove = false;
      toolsSection.cfgsections = function () {
        return [id];
      };
      const tools = toolsSection.option(form.DummyValue, "_workspace_tools");
      tools.rawhtml = true;
      // DummyValue inherits Value.parse(), which calls cfgvalue(). These
      // display-only values must not create detached hosts during saves.
      tools.parse = function () {
        return Promise.resolve();
      };
      tools.cfgvalue = function () {
        return main.renderWorkspaceTools(area);
      };
    }

    void loadUiCapabilities().catch(showCapabilityError);

    const rendered = await forkopMap.render();
    const markDirty = function (event) {
      const pane = event.target.closest?.(".cbi-section[data-tab]");
      if (
        pane &&
        ["settings", "section", "server"].includes(pane.dataset.tab)
      ) {
        nativeDirty = true;
        stateVersion++;
        showPending();
      }
    };
    rendered.addEventListener("input", markDirty);
    rendered.addEventListener("change", markDirty);
    main.registerConfigurationReload(window, {
      beforeChange: async function () {
        if (!rendered.isConnected) return;
        if (refreshingNative) throw new Error("native_refresh_required");
        if (mutationBusy) throw new Error("native_mutation_busy");
        mutationBusy = true;
        stateVersion++;
        try {
          pendingSaved = await readPending();
          if (nativeDirty || pendingSaved) {
            showPending(
              "Есть неприменённые изменения. «Сохранить изменения» сохраняет черновик. «Применить сейчас» применит его; затем повторите действие. Черновик также можно отменить штатной кнопкой LuCI.",
            );
            throw new Error("native_pending_changes");
          }
          if (synchronizationFailed) {
            showPending(
              "Сначала нажмите «Обновить редактор», затем повторите действие.",
            );
            throw new Error("native_refresh_required");
          }
          disabledControls = Array.from(
            rendered.querySelectorAll("input,select,textarea,button"),
          ).filter(function (control) {
            return !control.disabled;
          });
          disabledControls.forEach(function (control) {
            control.disabled = true;
          });
          rendered.inert = true;
          rendered.setAttribute("aria-busy", "true");
        } catch (error) {
          if (
            !["native_pending_changes", "native_refresh_required"].includes(
              error.message,
            )
          )
            showPending(
              "Не удалось проверить неприменённые изменения. Повторите действие после восстановления связи с роутером.",
            );
          throw error;
        }
      },
      changed: async function () {
        if (!rendered.isConnected) return;
        await synchronizeNative();
      },
      settled: function () {
        if (!mutationBusy) return;
        disabledControls.forEach(function (control) {
          control.disabled = false;
        });
        disabledControls = [];
        mutationBusy = false;
        rendered.removeAttribute("aria-busy");
        rendered.inert = false;
      },
    });
    const initialVersion = stateVersion;
    void readPending()
      .then(function (pending) {
        if (initialVersion !== stateVersion) return;
        pendingSaved = pending;
        if (pending) showPending();
      })
      .catch(function () {
        if (initialVersion === stateVersion)
          showPending(
            "Не удалось проверить неприменённые изменения. Перед немедленным действием проверка будет повторена.",
          );
      });
    mapRendered = true;
    if (uiCapabilities.loaded)
      void initializeSettings().catch(showCapabilityError);
    main.coreService({
      waitForLogWatcherStart: loadUiCapabilities,
      logWatcherStartDelayMs: 5000,
    });

    return rendered;
  },
};

return view.extend(EntryPoint);
