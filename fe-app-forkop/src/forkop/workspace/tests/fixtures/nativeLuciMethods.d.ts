/** Types for the unmodified native JavaScript lifecycle fixture. */
export function nativeLuciMethods(...boundaries: unknown[]): {
  map: {
    renderContents(): Promise<HTMLElement>;
    render(): Promise<HTMLElement>;
    save(...args: unknown[]): Promise<HTMLElement>;
    reset(): Promise<HTMLElement>;
  };
  tabs: {
    initTabGroup(panes: ArrayLike<ChildNode>): void;
    updateTabs(event?: unknown, root?: HTMLElement): void;
    switchTab(event: Event): void;
  };
  grid: {
    handleModalSave(
      this: unknown,
      modalMap: unknown,
      event: Event,
    ): Promise<void>;
  };
};
