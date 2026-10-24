/** Captured LuCI title and table rendering methods, bound to DOM boundaries. */
export function nativeRuleTableMethods(...boundaries: unknown[]): {
  stripTags(value: unknown): string;
  titleFn(this: unknown, attribute: string, ...args: unknown[]): string | null;
  renderContents(
    this: unknown,
    sections: string[],
    nodes: HTMLElement[],
  ): HTMLElement;
  renderTextValue(this: unknown, section: string, option: unknown): HTMLElement;
};
