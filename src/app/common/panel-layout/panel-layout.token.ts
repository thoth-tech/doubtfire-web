import {InjectionToken} from '@angular/core';

/** The slice of the layout a panel talks to. Kept in its own file so the two components do not import each other. */
export interface PanelLayoutHost {
  readonly page: string;
  readonly stacked: boolean;
  readonly fullscreenPanel: string | null;
  readonly activePanel: string | null;
  register(panel: PanelRegistration): void;
  unregister(panel: PanelRegistration): void;
  toggleFullscreen(panelId: string): void;
  notifyResize(): void;
  /** Re-check whether every expanded panel still fits, after a panel collapses or expands. */
  updateAutoRails(): void;
  /** True while the layout shows this panel as a rail only because the page is too narrow. */
  isAutoRailed(panelId: string): boolean;
  /** Opens a panel the layout railed for space. It stays open until everything fits again. */
  releaseAutoRail(panelId: string): void;
  /** The widest this panel can grow before another panel would drop below its minimum. */
  maxWidthFor(panel: PanelRegistration): number;
}

export interface PanelRegistration {
  readonly panelId: string;
  readonly panelTitle: string;
  readonly icon: string | null;
  readonly collapsible: boolean;
  /** The user's own choice, as remembered. Not set by the layout's space rule. */
  readonly collapsed: boolean;
  readonly minWidth: number;
}

export const PANEL_LAYOUT: InjectionToken<PanelLayoutHost> = new InjectionToken('PANEL_LAYOUT');
