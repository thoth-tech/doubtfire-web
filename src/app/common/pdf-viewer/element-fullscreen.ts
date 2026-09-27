/**
 * The browser's full screen for one element, in the shape the PDF viewer needs:
 * whether it can go full screen here, whether it is, and a toggle.
 *
 * Kept apart from the viewer so it can be tested without loading the PDF library.
 */
export class ElementFullscreen {
  constructor(
    private readonly element: () => HTMLElement | undefined,
    private readonly doc: Document = document,
  ) {}

  /** Phones such as the iPhone only let video go full screen. */
  public get supported(): boolean {
    return !!this.doc.fullscreenEnabled;
  }

  public get active(): boolean {
    const element = this.element();
    return !!element && this.doc.fullscreenElement === element;
  }

  /** Resolves once the browser has switched, and rejects when it refuses. */
  public toggle(): Promise<void> {
    if (this.active) {
      return this.doc.exitFullscreen();
    }

    const element = this.element();
    return element ? element.requestFullscreen() : Promise.resolve();
  }

  /** Leave full screen if this element holds it, for when the viewer goes away. */
  public release(): void {
    if (this.active) {
      this.doc.exitFullscreen().catch(() => undefined);
    }
  }
}
