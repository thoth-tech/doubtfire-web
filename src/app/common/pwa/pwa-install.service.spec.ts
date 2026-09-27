import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {DOCUMENT} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {PwaInstallService} from './pwa-install.service';

interface TestMediaQuery extends EventTarget {
  matches: boolean;
  media: string;
}

describe('PwaInstallService', () => {
  let browser: EventTarget & {
    navigator: {standalone: boolean};
    matchMedia: ReturnType<typeof vi.fn<(media: string) => TestMediaQuery>>;
  };
  let queries: Map<string, TestMediaQuery>;

  beforeEach(() => {
    queries = new Map();
    browser = Object.assign(new EventTarget(), {
      navigator: {standalone: false},
      matchMedia: vi.fn((media: string) => {
        if (!queries.has(media)) {
          const query = Object.assign(new EventTarget(), {matches: false, media});
          queries.set(media, query);
        }
        return queries.get(media);
      }),
    });
    TestBed.configureTestingModule({
      providers: [PwaInstallService, {provide: DOCUMENT, useValue: {defaultView: browser}}],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  function offerInstall(outcome: 'accepted' | 'dismissed' = 'accepted') {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event('beforeinstallprompt', {cancelable: true});
    Object.assign(event, {
      prompt,
      userChoice: Promise.resolve({outcome, platform: 'web'}),
    });
    browser.dispatchEvent(event);
    return {event, prompt};
  }

  it('starts without install capability and gives menu help when no event exists', async () => {
    const service = TestBed.inject(PwaInstallService);
    expect(service.canInstall()).toBe(false);
    expect(service.isInstalled()).toBe(false);
    expect(await service.install()).toBe('unavailable');
    expect(service.installMessage()).toContain('browser’s menu');
  });

  it('retains an install event without automatically displaying the browser prompt', () => {
    const service = TestBed.inject(PwaInstallService);
    const {event, prompt} = offerInstall();

    expect(event.defaultPrevented).toBe(true);
    expect(service.canInstall()).toBe(true);
    expect(service.installMessage()).toBe('');
    expect(prompt).not.toHaveBeenCalled();
  });

  it('invokes prompt synchronously from the user action and consumes each event once', async () => {
    const service = TestBed.inject(PwaInstallService);
    const {prompt} = offerInstall();

    const result = service.install();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(service.isInstalling()).toBe(true);
    expect(service.canInstall()).toBe(false);
    expect(await service.install()).toBe('unavailable');
    expect(await result).toBe('accepted');
    expect(service.isInstalling()).toBe(false);
    expect(service.isInstalled()).toBe(false);
    expect(service.installMessage()).toContain('Installation requested');
    expect(await service.install()).toBe('unavailable');
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('allows another browser event after dismissal without permanently suppressing installation', async () => {
    const service = TestBed.inject(PwaInstallService);
    const first = offerInstall('dismissed');

    expect(await service.install()).toBe('dismissed');
    expect(service.isInstalled()).toBe(false);
    expect(service.installMessage()).toContain('cancelled');
    expect(service.canInstall()).toBe(false);

    const second = offerInstall();
    expect(service.canInstall()).toBe(true);
    expect(service.installMessage()).toBe('');
    expect(await service.install()).toBe('accepted');
    expect(first.prompt).toHaveBeenCalledTimes(1);
    expect(second.prompt).toHaveBeenCalledTimes(1);
  });

  it('handles a rejected prompt and permits retry only after a fresh event', async () => {
    const service = TestBed.inject(PwaInstallService);
    const {prompt} = offerInstall();
    prompt.mockRejectedValue(new Error('Installation is unavailable'));

    expect(await service.install()).toBe('error');
    expect(service.isInstalling()).toBe(false);
    expect(service.isInstalled()).toBe(false);
    expect(service.canInstall()).toBe(false);
    expect(service.installMessage()).toContain('could not complete');

    offerInstall();
    expect(await service.install()).toBe('accepted');
  });

  it('handles a synchronously thrown prompt error', async () => {
    const service = TestBed.inject(PwaInstallService);
    const {prompt} = offerInstall();
    prompt.mockImplementation(() => {
      throw new Error('User activation expired');
    });

    expect(await service.install()).toBe('error');
    expect(service.isInstalling()).toBe(false);
  });

  it('handles a rejected user choice without an unhandled rejection', async () => {
    const service = TestBed.inject(PwaInstallService);
    let rejectChoice: (error: Error) => void;
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: new Promise((_resolve, reject) => {
        rejectChoice = reject;
      }),
    });
    browser.dispatchEvent(event);
    const result = service.install();
    await Promise.resolve();
    rejectChoice(new Error('Browser closed'));

    expect(await result).toBe('error');
    expect(service.isInstalling()).toBe(false);
  });

  it('marks installation complete only when the browser confirms appinstalled', async () => {
    const service = TestBed.inject(PwaInstallService);
    const {prompt} = offerInstall();
    browser.dispatchEvent(new Event('appinstalled'));

    expect(service.isInstalled()).toBe(true);
    expect(service.canInstall()).toBe(false);
    expect(service.installMessage()).toContain('OnTrack is installed');
    expect(await service.install()).toBe('unavailable');
    expect(prompt).not.toHaveBeenCalled();
  });

  it('does not replace an appinstalled success message with a late prompt result', async () => {
    const service = TestBed.inject(PwaInstallService);
    offerInstall('dismissed');
    const result = service.install();
    browser.dispatchEvent(new Event('appinstalled'));
    await result;

    expect(service.isInstalled()).toBe(true);
    expect(service.installMessage()).toContain('OnTrack is installed');
  });

  it('accepts a fresh install event after an app has been uninstalled in the same session', () => {
    const service = TestBed.inject(PwaInstallService);
    browser.dispatchEvent(new Event('appinstalled'));
    offerInstall();

    expect(service.isInstalled()).toBe(false);
    expect(service.canInstall()).toBe(true);
  });

  it.each(['standalone', 'minimal-ui', 'window-controls-overlay'])(
    'recognises %s app windows and reacts to display mode changes',
    (displayMode) => {
      const query = browser.matchMedia(`(display-mode: ${displayMode})`);
      query.matches = true;
      const service = TestBed.inject(PwaInstallService);
      expect(service.isInstalled()).toBe(true);
      offerInstall();
      expect(service.canInstall()).toBe(false);

      query.matches = false;
      query.dispatchEvent(new Event('change'));
      expect(service.isInstalled()).toBe(false);
      offerInstall();
      expect(service.canInstall()).toBe(true);

      query.matches = true;
      query.dispatchEvent(new Event('change'));
      expect(service.canInstall()).toBe(false);
    },
  );

  it('recognises iOS standalone mode without requiring matchMedia', () => {
    browser.navigator.standalone = true;
    browser.matchMedia = undefined;
    const service = TestBed.inject(PwaInstallService);

    expect(service.isInstalled()).toBe(true);
    offerInstall();
    expect(service.canInstall()).toBe(false);
  });

  it('continues working when matchMedia is unavailable', () => {
    browser.matchMedia = undefined;
    const service = TestBed.inject(PwaInstallService);
    offerInstall();

    expect(service.isInstalled()).toBe(false);
    expect(service.canInstall()).toBe(true);
  });

  it('does not infer an installation when no browser window is present', () => {
    TestBed.overrideProvider(DOCUMENT, {useValue: {defaultView: null}});
    const service = TestBed.inject(PwaInstallService);
    expect(service.isInstalled()).toBe(false);
    expect(service.canInstall()).toBe(false);
  });

  it('ignores events without a callable browser prompt', () => {
    const service = TestBed.inject(PwaInstallService);
    browser.dispatchEvent(new Event('beforeinstallprompt'));
    expect(service.canInstall()).toBe(false);
  });

  it('removes window and media query listeners on destruction', () => {
    const service = TestBed.inject(PwaInstallService);
    const removeWindowListener = vi.spyOn(browser, 'removeEventListener');
    const query = queries.get('(display-mode: standalone)');
    const removeMediaListener = vi.spyOn(query, 'removeEventListener');

    service.ngOnDestroy();
    offerInstall();
    browser.dispatchEvent(new Event('appinstalled'));
    Object.defineProperty(query, 'matches', {value: true});
    query.dispatchEvent(new Event('change'));

    expect(service.canInstall()).toBe(false);
    expect(service.isInstalled()).toBe(false);
    expect(removeWindowListener).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
    expect(removeWindowListener).toHaveBeenCalledWith('appinstalled', expect.any(Function));
    expect(removeMediaListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
