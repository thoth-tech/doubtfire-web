import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatSlideToggleChange} from '@angular/material/slide-toggle';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {provideRouter} from '@angular/router';
import {SwPush} from '@angular/service-worker';
import {DemoModeStore} from '../demo-mode.store';
import {DemoToolsModule} from '../demo-tools.module';
import {DEMO_RELOAD, DemoControlsComponent} from './demo-controls.component';

describe('DemoControlsComponent', () => {
  let fixture: ComponentFixture<DemoControlsComponent>;
  let demoMode: {
    available: boolean;
    enabled: boolean;
    setEnabled: ReturnType<typeof vi.fn>;
  };
  let reload: ReturnType<typeof vi.fn>;
  let requestPermission: ReturnType<typeof vi.fn>;
  let requestSubscription: ReturnType<typeof vi.fn>;
  let httpTesting: HttpTestingController;
  let originalNotification: typeof Notification | undefined;

  beforeEach(async () => {
    demoMode = {available: true, enabled: false, setEnabled: vi.fn()};
    reload = vi.fn();
    requestPermission = vi.fn();
    requestSubscription = vi.fn();
    originalNotification = globalThis.Notification;
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: {permission: 'default', requestPermission},
    });

    await TestBed.configureTestingModule({
      imports: [DemoToolsModule, NoopAnimationsModule],
      providers: [
        {provide: DemoModeStore, useValue: demoMode},
        {provide: DEMO_RELOAD, useValue: reload},
        {provide: SwPush, useValue: {requestSubscription}},
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DemoControlsComponent);
    fixture.detectChanges();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: originalNotification,
    });
  });

  it('shows an accessible control and an exact description of affected surfaces', () => {
    const text = fixture.nativeElement.textContent;
    const toggle = fixture.nativeElement.querySelector('mat-slide-toggle');

    expect(toggle.getAttribute('aria-describedby')).toBe('demo-mode-description');
    expect(text).toContain('Demo mode off');
    expect(text).toContain('Off — quiet baseline');
    expect(text).toContain('one baseline unit (DEMO20007 when available)');
    expect(text).toContain('On — complete walkthrough');
    expect(text).toContain('privacy-safe lifecycle spread (60% submitted and 10% complete)');
    expect(text).toContain('all seven curated local notifications');
    expect(text).toContain('live local project cards');
    expect(text).toContain('live notification bell');
    expect(text).toContain('Live task-level peer comparison');
    expect(text).toContain('unit summary');
    expect(text).toContain('Peer Progress Indicator visual preview');
    expect(text).toContain('Full status data');
    expect(text).toContain('Insufficient cohort');
    expect(text).toContain('Advanced details protected');
    expect(text).toContain('Rounded total 90%');
    expect(text).toContain('Rounded total 110%');
    expect(fixture.nativeElement.querySelectorAll('.ppi-preview__choices button').length).toBe(5);
  });

  it('persists the switch and reloads to avoid mixed entity caches', () => {
    fixture.componentInstance.setDemoMode({checked: true} as MatSlideToggleChange);

    expect(demoMode.setEnabled).toHaveBeenCalledWith(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('renders a visual-only push preview without browser, SwPush, or API calls', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Preview only');
    expect(text).toContain('Feedback is ready');
    expect(text).toContain('Open My Profile for real notifications');
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/edit_profile');
    expect(requestPermission).not.toHaveBeenCalled();
    expect(requestSubscription).not.toHaveBeenCalled();
    httpTesting.expectNone((request) => request.url.includes('/push_subscriptions'));
  });

  it('switches between complete and privacy-safe peer progress preview states locally', () => {
    fixture.componentInstance.setPpiPreviewAdvanced(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Task status breakdown');
    expect(fixture.nativeElement.textContent).toContain('60%');
    expect(fixture.nativeElement.textContent).toContain('10%');

    fixture.componentInstance.setPpiPreview('details-protected');
    fixture.componentInstance.setPpiPreviewAdvanced(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Detailed breakdown protected');
    expect(fixture.nativeElement.textContent).not.toContain('Redo');

    fixture.componentInstance.setPpiPreview('insufficient');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Progress is hidden to protect privacy');
    expect(fixture.nativeElement.textContent).toContain('Not enough students');

    httpTesting.expectNone((request) => request.url.includes('/peer_progress'));
  });

  it('keeps the sample compact by default and exposes details through a small accessible switch', () => {
    const preview = fixture.nativeElement.querySelector('.ppi-preview-card') as HTMLElement;
    const toggle = preview.querySelector('button[role="switch"]') as HTMLButtonElement;
    const progress = preview.querySelector('[role="progressbar"]') as HTMLElement;

    expect(toggle.getAttribute('aria-label')).toBe('Advanced peer status breakdown');
    expect(toggle.getAttribute('aria-controls')).toBe('ppi-preview-advanced-panel');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(preview.querySelector('.ppi-preview-card__advanced')).toBeNull();
    expect(progress.getAttribute('aria-label')).toBe(
      '10% of peers at your target grade have completed this task',
    );

    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(preview.querySelector('#ppi-preview-advanced-panel')).toBeTruthy();
    expect(preview.textContent).toContain('Redo');
    expect(preview.textContent).toContain('Resubmit');
  });

  it.each([
    {kind: 'rounded-90' as const, total: 90},
    {kind: 'rounded-110' as const, total: 110},
  ])('previews a $total% rounded vector without visually renormalising it', ({kind, total}) => {
    fixture.componentInstance.setPpiPreview(kind);
    fixture.componentInstance.setPpiPreviewAdvanced(true);
    fixture.detectChanges();

    const independent = fixture.nativeElement.querySelector('.ppi-preview-independent');
    const workingFill = fixture.nativeElement.querySelector(
      '[data-status="working_on_it"] .ppi-preview-independent__fill',
    ) as HTMLElement;
    const workingTrack = fixture.nativeElement.querySelector(
      '[data-status="working_on_it"] [role="progressbar"]',
    ) as HTMLElement;

    expect(fixture.componentInstance.ppiPreviewDistributionTotal).toBe(total);
    expect(fixture.nativeElement.querySelector('.ppi-preview-bar')).toBeNull();
    expect(independent.textContent).toContain(`total ${total}%`);
    expect(independent.textContent).toContain('not stretched to fill 100%');
    expect(workingFill.style.width).toBe('20%');
    expect(workingTrack.getAttribute('aria-valuenow')).toBe('20');
    expect(workingTrack.getAttribute('aria-describedby')).toBe('ppi-preview-independent-note');
  });
});
