import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {DemoMeetingLinksStore, safeDemoMeetingUrl} from './demo-meeting-links.store';
import {DEMO_MEETING_LINKS_KEY, DemoModeStore} from './demo-mode.store';

const hosted = 'https://teams.microsoft.com/meet/123456789?p=demo-example';

describe('Host-provided demo meeting links', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('accepts both Microsoft joining formats and preserves encoded meeting context', () => {
    expect(safeDemoMeetingUrl(hosted)).toBe(hosted);
    const legacy =
      'https://teams.microsoft.com/l/meetup-join/19%3Aexample%40thread.tacv2/12345?context=%7B%22Tid%22%3A%22example%22%7D';
    expect(safeDemoMeetingUrl(legacy)).toBe(legacy);
  });

  it.each([
    'javascript:alert(1)',
    'http://teams.microsoft.com/meet/123',
    'https://teams.microsoft.com.evil.test/meet/123',
    'https://evil.test/meet/123',
    'https://teams.microsoft.com@evil.test/meet/123',
    'https://user:password@teams.microsoft.com/meet/123',
    'https://teams.microsoft.com:8443/meet/123',
    'https://teams.microsoft.com/l/meeting/new?subject=example',
    'https://teams.microsoft.com/meet/123#redirect',
    'https://teams.microsoft.com/meet/123\n',
  ])('rejects unsafe or non-joining URL %s', (url) => {
    expect(safeDemoMeetingUrl(url)).toBeNull();
  });

  it('persists only in the current tab and revalidates stored data', () => {
    const store = new DemoMeetingLinksStore(true);
    store.save({helpHub: hosted, extraHelpHub: ''});
    expect(new DemoMeetingLinksStore(true).links.helpHub).toBe(hosted);
    sessionStorage.setItem(
      DEMO_MEETING_LINKS_KEY,
      JSON.stringify({helpHub: 'https://evil.test/meet/123', extraHelpHub: 42}),
    );
    expect(store.links).toEqual({helpHub: '', extraHelpHub: ''});
    sessionStorage.setItem(DEMO_MEETING_LINKS_KEY, 'null');
    expect(store.links).toEqual({helpHub: '', extraHelpHub: ''});
  });

  it('rejects invalid edits without replacing the existing configuration', () => {
    const store = new DemoMeetingLinksStore(true);
    store.save({helpHub: hosted, extraHelpHub: ''});
    expect(() => store.save({helpHub: hosted, extraHelpHub: 'https://evil.test'})).toThrow();
    expect(store.links.helpHub).toBe(hosted);
  });

  it('disables and clears links without demo tools, including forged saved values', () => {
    sessionStorage.setItem(DEMO_MEETING_LINKS_KEY, JSON.stringify({helpHub: hosted}));
    const store = new DemoMeetingLinksStore(false);
    expect(store.links.helpHub).toBe('');
    expect(sessionStorage.getItem(DEMO_MEETING_LINKS_KEY)).toBeNull();
    expect(() => store.save({helpHub: hosted, extraHelpHub: ''})).toThrow();
  });

  it('retains links across mode toggles but clears them when authentication resets demo state', () => {
    const store = new DemoMeetingLinksStore(true);
    const mode = new DemoModeStore(true);
    store.save({helpHub: hosted, extraHelpHub: ''});
    mode.setEnabled(true);
    mode.setEnabled(false);
    expect(store.links.helpHub).toBe(hosted);
    mode.reset();
    expect(store.links.helpHub).toBe('');
  });

  it('reports storage failure instead of claiming the links were saved', () => {
    vi.stubGlobal('sessionStorage', {
      setItem: () => {
        throw new Error('denied');
      },
    });
    expect(() => new DemoMeetingLinksStore(true).save({helpHub: hosted, extraHelpHub: ''})).toThrow(
      'could not save',
    );
  });
});
