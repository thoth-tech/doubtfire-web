import {Injectable, Signal, inject} from '@angular/core';
import {ResolvedTheme, ThemeService} from './theme.service';

/**
 * Resolves --ot-* theme tokens to concrete colour values for contexts that cannot
 * consume a CSS variable directly: ngx-charts fill/scheme inputs, canvas, and any
 * JavaScript that needs to read or compute on a colour (e.g. a contrast calc).
 *
 * SCSS and template [style] bindings should keep using var(--ot-*) directly — those
 * flip on their own. Use this only where a resolved string is required, and pair it
 * with the `resolved` signal so a chart re-reads its colours when the theme flips.
 */
@Injectable({providedIn: 'root'})
export class ThemeColorService {
  private readonly theme = inject(ThemeService);

  /** The resolved-theme signal ('light' | 'dark'). Read it inside an effect() so a
   *  chart re-renders when the user changes theme while it is on screen. */
  readonly resolved: Signal<ResolvedTheme> = this.theme.resolved;

  /** Computed value of a CSS custom property on :root, e.g. token('--ot-chart-1'). */
  token(name: string, fallback = '#64748b'): string {
    if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
      return fallback;
    }
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  /** Resolved fill for a task status. Accepts snake_case ('working_on_it') or the
   *  hyphenated token key; the token layer uses hyphens. */
  statusColor(status: string, fallback = '#64748b'): string {
    return this.token(`--ot-status-${String(status).replace(/_/g, '-')}`, fallback);
  }

  /** Resolved status colour for a mark drawn on the page, such as a chart slice. It
   *  clears 3:1 on the surface in both themes, which the darker fills do not in dark. */
  statusGraphicColor(status: string, fallback = '#64748b'): string {
    return this.token(`--ot-status-${String(status).replace(/_/g, '-')}-graphic`, fallback);
  }

  /** Resolved on-colour (label/foreground) paired with a status, fixed for AA. */
  statusOnColor(status: string, fallback = '#ffffff'): string {
    return this.token(`--ot-status-${String(status).replace(/_/g, '-')}-on`, fallback);
  }

  /** Resolved categorical chart colour 1..6. */
  chart(index: number, fallback = '#64748b'): string {
    return this.token(`--ot-chart-${index}`, fallback);
  }
}
