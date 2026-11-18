import { renderButton } from '../../../../partials';
import {
  renderCircleCheckBigIcon24,
  renderCirclePlayIcon24,
  renderCircleStopIcon24,
  renderCogIcon24,
  renderPauseIcon24,
  renderPlayIcon24,
  renderRotateCcwIcon24,
  renderSquareChartGanttIcon24,
} from '../../../../icons';
import { insertIf } from '../../../../helpers';
import {
  actionMenuDivider,
  actionMenuHeading,
  createActionMenu,
} from '../../../workspace/actionMenu';

interface ActionProps {
  loading: boolean;
  visible: boolean;
  disabled: boolean;
  onClick: () => void;
}

interface IRenderAvailableActionsProps {
  restart: ActionProps;
  start: ActionProps;
  stop: ActionProps;
  enable: ActionProps;
  disable: ActionProps;
  globalCheck: ActionProps;
  viewLogs: ActionProps;
  showSingBoxConfig: ActionProps;
}

export function renderAvailableActions({
  restart,
  start,
  stop,
  enable,
  disable,
  globalCheck,
  viewLogs,
  showSingBoxConfig,
}: IRenderAvailableActionsProps) {
  const primaryButtons = [
    ...insertIf(viewLogs.visible, [
      renderButton({
        onClick: viewLogs.onClick,
        icon: renderSquareChartGanttIcon24,
        text: _('View logs'),
        loading: viewLogs.loading,
        disabled: viewLogs.disabled,
      }),
    ]),
    ...insertIf(restart.visible, [
      renderButton({
        classNames: ['cbi-button-apply'],
        onClick: restart.onClick,
        icon: renderRotateCcwIcon24,
        text: _('Restart Forkop'),
        loading: restart.loading,
        disabled: restart.disabled,
      }),
    ]),
    ...insertIf(start.visible, [
      renderButton({
        classNames: ['cbi-button-save'],
        onClick: start.onClick,
        icon: renderCirclePlayIcon24,
        text: _('Start Forkop'),
        loading: start.loading,
        disabled: start.disabled,
      }),
    ]),
  ];

  const overflowConfigButtons = [
    ...insertIf(showSingBoxConfig.visible, [
      renderButton({
        onClick: showSingBoxConfig.onClick,
        icon: renderCogIcon24,
        text: _('Show sing-box config'),
        loading: showSingBoxConfig.loading,
        disabled: showSingBoxConfig.disabled,
      }),
    ]),
    ...insertIf(globalCheck.visible, [
      renderButton({
        onClick: globalCheck.onClick,
        icon: renderCircleCheckBigIcon24,
        text: _('Get global check'),
        loading: globalCheck.loading,
        disabled: globalCheck.disabled,
      }),
    ]),
  ];

  const overflowServiceButtons = [
    ...insertIf(enable.visible, [
      renderButton({
        classNames: ['cbi-button-save'],
        onClick: enable.onClick,
        icon: renderPlayIcon24,
        text: _('Enable autostart'),
        loading: enable.loading,
        disabled: enable.disabled,
      }),
    ]),
    ...insertIf(disable.visible, [
      renderButton({
        classNames: ['cbi-button-remove'],
        onClick: disable.onClick,
        icon: renderPauseIcon24,
        text: _('Disable autostart'),
        loading: disable.loading,
        disabled: disable.disabled,
      }),
    ]),
    ...insertIf(stop.visible, [
      renderButton({
        classNames: ['cbi-button-remove'],
        onClick: stop.onClick,
        icon: renderCircleStopIcon24,
        text: _('Stop Forkop'),
        loading: stop.loading,
        disabled: stop.disabled,
      }),
    ]),
  ];

  const hasOverflow =
    overflowConfigButtons.length > 0 || overflowServiceButtons.length > 0;
  const overflowBusy = Boolean(
    showSingBoxConfig.loading ||
      globalCheck.loading ||
      enable.loading ||
      disable.loading ||
      stop.loading,
  );

  return E('div', { class: 'fkp_diagnostic-page__right-bar__actions' }, [
    E('b', {}, _('Available actions')),
    ...(primaryButtons.length
      ? [
          E('div', { class: 'fkp_diagnostic-page__actions-group' }, [
            ...primaryButtons,
          ]),
        ]
      : []),
    ...(hasOverflow
      ? [
          createActionMenu(
            'Дополнительно',
            [
              ...(overflowConfigButtons.length
                ? [
                    actionMenuHeading('Конфигурация и отчёт'),
                    ...overflowConfigButtons,
                  ]
                : []),
              ...(overflowConfigButtons.length && overflowServiceButtons.length
                ? [actionMenuDivider()]
                : []),
              ...(overflowServiceButtons.length
                ? [
                    actionMenuHeading('Управление сервисом'),
                    ...overflowServiceButtons,
                  ]
                : []),
            ],
            {
              block: true,
              ariaLabel: 'Дополнительные действия диагностики',
              open: overflowBusy,
              busy: overflowBusy,
            },
          ),
        ]
      : []),
  ]);
}
