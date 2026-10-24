/** Types for the unmodified native JavaScript lifecycle fixture. */
export function nativeLuciMethods(...boundaries: unknown[]): {
  value: { parse(this: unknown, section: string): Promise<unknown> };
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
    handleAdd(this: unknown, event: Event, name?: string): unknown;
    handleModalCancel(
      this: unknown,
      modalMap: unknown,
      event: Event,
      isSaving?: boolean,
    ): unknown;
    handleModalSave(
      this: unknown,
      modalMap: unknown,
      event: Event,
    ): Promise<void>;
  };
};
