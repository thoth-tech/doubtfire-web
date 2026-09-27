import {Injectable} from '@angular/core';

/** What a panel remembers between visits. Anything missing falls back to the page's default. */
export interface PanelState {
  collapsed?: boolean;
  width?: number;
}

/**
 * Remembers each panel's collapsed state and width in this browser only.
 *
 * Storage can be missing or refuse writes (private windows, blocked site data, a full
 * quota), so every read and write is guarded and a failure just means the defaults.
 */
@Injectable({providedIn: 'root'})
export class PanelStateService {
  public static readonly prefix = 'ontrack.panels';

  public key(page: string, panel: string): string {
    return `${PanelStateService.prefix}.${page}.${panel}`;
  }

  public read(page: string, panel: string): PanelState {
    try {
      const raw = window.localStorage.getItem(this.key(page, panel));
      if (!raw) {
        return {};
      }
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return {};
      }
      const value = parsed as Record<string, unknown>;
      const state: PanelState = {};
      if (typeof value.collapsed === 'boolean') {
        state.collapsed = value.collapsed;
      }
      if (typeof value.width === 'number' && Number.isFinite(value.width) && value.width > 0) {
        state.width = value.width;
      }
      return state;
    } catch {
      return {};
    }
  }

  public write(page: string, panel: string, patch: PanelState): void {
    try {
      const next = {...this.read(page, panel), ...patch};
      window.localStorage.setItem(this.key(page, panel), JSON.stringify(next));
    } catch {
      // Nothing to do: the panel keeps working, it just will not be remembered.
    }
  }
}
