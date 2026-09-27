import {Inject, Injectable} from '@angular/core';
import {DEMO_MEETING_LINKS_KEY, DEMO_TOOLS_AVAILABLE} from './demo-mode.store';

export interface DemoMeetingLinks {
  helpHub: string;
  extraHelpHub: string;
}

/** Accept joining links only: no redirects, credentials, ports or arbitrary websites. */
export function safeDemoMeetingUrl(value: string): string | null {
  if (!value || value.length > 4096 || /[\p{Cc}\s]/u.test(value)) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === 'teams.microsoft.com' &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (/^\/meet\/\d+\/?$/.test(url.pathname) ||
        /^\/l\/meetup-join\/[^/]+\/\d+\/?$/.test(url.pathname))
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** Host-provided access links belong to this browser tab, never API data or public fixtures. */
@Injectable({providedIn: 'root'})
export class DemoMeetingLinksStore {
  constructor(@Inject(DEMO_TOOLS_AVAILABLE) private available: boolean) {
    if (!available) {
      this.clear();
    }
  }

  get links(): DemoMeetingLinks {
    const empty = {helpHub: '', extraHelpHub: ''};
    if (!this.available) {
      return empty;
    }
    try {
      const stored = JSON.parse(sessionStorage.getItem(DEMO_MEETING_LINKS_KEY) || '{}');
      return {
        helpHub:
          typeof stored?.helpHub === 'string' ? safeDemoMeetingUrl(stored.helpHub) || '' : '',
        extraHelpHub:
          typeof stored?.extraHelpHub === 'string'
            ? safeDemoMeetingUrl(stored.extraHelpHub) || ''
            : '',
      };
    } catch {
      return empty;
    }
  }

  save(links: DemoMeetingLinks): void {
    if (!this.available) {
      throw new Error('Hosted demo links are available only in development.');
    }
    const checked: DemoMeetingLinks = {helpHub: '', extraHelpHub: ''};
    for (const key of ['helpHub', 'extraHelpHub'] as const) {
      const value = links[key].trim();
      if (value && !safeDemoMeetingUrl(value)) {
        throw new Error(
          'Use a complete HTTPS Teams joining link for each HelpHub, or leave it blank.',
        );
      }
      checked[key] = value ? safeDemoMeetingUrl(value)! : '';
    }
    try {
      sessionStorage.setItem(DEMO_MEETING_LINKS_KEY, JSON.stringify(checked));
    } catch {
      throw new Error(
        'This browser could not save the links. Allow session storage and try again.',
      );
    }
  }

  clear(): void {
    try {
      globalThis.sessionStorage?.removeItem(DEMO_MEETING_LINKS_KEY);
    } catch {
      // Production cannot read hosted links even when storage is unavailable.
    }
  }
}
