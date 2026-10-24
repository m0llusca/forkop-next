"use strict";
"require baseclass";
"require form";
"require view.forkop.main as main";
return baseclass.extend({
  createNextContent: function (section) {
    const option = section.option(form.DummyValue, "_next_panel");
    option.rawhtml = true;
    option.cfgvalue = function () {
      const overviewState = function (state) {
        if (!state || !state.service || !state.service.forkop)
          return { error: "unavailable" };
        const running = state.service.forkop.running;
        return {
          running: running === 1 ? true : running === 0 ? false : undefined,
          pending: Boolean(
            state.actions &&
              state.actions.service &&
              state.actions.service.some(function (action) {
                return action.running;
              }),
          ),
        };
      };
      return main.renderNextPanel(undefined, main.getDashboardSections, {
        workspace: true,
        changeService: async function (action) {
          const started =
            await main.ForkopShellMethods.serviceActionStart(action);
          if (!started.success) return { success: false, error: started.error };
          const result = await main.ForkopShellMethods.waitServiceActionJob(
            started.data.job_id,
          );
          if (!result.success) return { success: false, error: result.error };
          if (result.data.success !== true || result.data.running)
            return {
              success: false,
              error: result.data.message || "Service action incomplete",
            };
          return { success: true };
        },
        readTraffic: async function () {
          const response =
            await main.ForkopShellMethods.getClashApiConnections();
          if (!response.success)
            throw new Error(response.error || "traffic_unavailable");
          if (!response.data || !Array.isArray(response.data.connections))
            throw new Error("traffic_unavailable");
          return {
            downloadTotal: response.data.downloadTotal,
            uploadTotal: response.data.uploadTotal,
            connections: response.data.connections.length,
          };
        },
        readRuntime: function () {
          return main
            .refreshRuntimeUiState({ force: true })
            .then(overviewState);
        },
        subscribeRuntime: function (listener) {
          // The shared service replays its cache synchronously at registration.
          // That replay must not supersede a pending fresh read or its failure.
          let registering = true;
          const unsubscribe = main.subscribeRuntimeUiState(function (state) {
            listener(overviewState(state), { cached: registering });
          });
          registering = false;
          return unsubscribe;
        },
      });
    };
  },
});
