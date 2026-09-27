import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {PwaConnectionStatusComponent} from './pwa-connection-status.component';

describe('PwaConnectionStatusComponent', () => {
  let fixture: ComponentFixture<PwaConnectionStatusComponent>;
  let online: boolean;

  beforeEach(async () => {
    online = true;
    vi.spyOn(window.navigator, 'onLine', 'get').mockImplementation(() => online);
    await TestBed.configureTestingModule({
      imports: [PwaConnectionStatusComponent],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  function createComponent(): HTMLElement {
    fixture = TestBed.createComponent(PwaConnectionStatusComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('keeps an empty live region without a banner when the browser is online', () => {
    const element = createComponent();
    const status = element.querySelector('[role="status"]');

    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.getAttribute('aria-atomic')).toBe('true');
    expect(status?.textContent?.trim()).toBe('');
    expect(element.querySelector('.connection-status')).toBeNull();
  });

  it('explains the limits of the cached app when launched offline', () => {
    online = false;
    const element = createComponent();

    expect(element.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'You’re offline. Reconnect to sign in, load current information or submit work. Work is not queued for upload.',
    );
  });

  it('announces connection loss and removes the warning on reconnection without reloading', () => {
    const element = createComponent();
    const liveRegion = element.querySelector('[role="status"]');

    online = false;
    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();
    expect(element.querySelector('.connection-status')).not.toBeNull();
    expect(element.querySelector('[role="status"]')).toBe(liveRegion);

    online = true;
    window.dispatchEvent(new Event('online'));
    fixture.detectChanges();
    expect(element.querySelector('.connection-status')).toBeNull();
    expect(element.querySelector('[role="status"]')).toBe(liveRegion);
  });

  it('stops responding to window events when destroyed', () => {
    createComponent();
    const component = fixture.componentInstance;
    fixture.destroy();

    online = false;
    window.dispatchEvent(new Event('offline'));

    expect(component.offline()).toBe(false);
  });
});
