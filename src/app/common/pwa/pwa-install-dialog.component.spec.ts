import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {PwaInstallDialogComponent} from './pwa-install-dialog.component';
import {PwaInstallService} from './pwa-install.service';

describe('PwaInstallDialogComponent', () => {
  let fixture: ComponentFixture<PwaInstallDialogComponent>;
  let service: {
    isInstalled: ReturnType<typeof signal<boolean>>;
    canInstall: ReturnType<typeof signal<boolean>>;
    isInstalling: ReturnType<typeof signal<boolean>>;
    installMessage: ReturnType<typeof signal<string>>;
    install: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      isInstalled: signal(false),
      canInstall: signal(false),
      isInstalling: signal(false),
      installMessage: signal(''),
      install: vi.fn().mockResolvedValue('accepted'),
    };
    await TestBed.configureTestingModule({
      imports: [PwaInstallDialogComponent],
      providers: [{provide: PwaInstallService, useValue: service}],
    }).compileComponents();
    fixture = TestBed.createComponent(PwaInstallDialogComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function installButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('button[mat-flat-button]');
  }

  it('opens with manual browser instructions and never installs automatically', () => {
    expect(service.install).not.toHaveBeenCalled();
    expect(installButton()).toBeNull();
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('summary') as NodeListOf<HTMLElement>,
    ).map((summary) => summary.textContent);
    expect(labels).toEqual([
      'Chrome on Windows, macOS or Linux',
      'Microsoft Edge',
      'Safari on macOS',
      'Firefox and other desktop browsers',
      'iPhone, iPad or Android',
    ]);
    expect(fixture.nativeElement.textContent).toContain('internet connection');
    expect(fixture.nativeElement.textContent).toContain('Add to Home Screen');
  });

  it('only shows direct installation when the browser provides that capability', () => {
    service.canInstall.set(true);
    fixture.detectChanges();
    expect(installButton()).not.toBeNull();
    expect(service.install).not.toHaveBeenCalled();

    installButton().click();
    expect(service.install).toHaveBeenCalledTimes(1);
  });

  it('disables the installation action while awaiting the browser', () => {
    service.isInstalling.set(true);
    fixture.detectChanges();

    expect(installButton().disabled).toBe(true);
    expect(installButton().textContent).toContain('Installing');
    installButton().click();
    expect(service.install).not.toHaveBeenCalled();
  });

  it('announces installation outcomes in a live status region', () => {
    service.installMessage.set('Installation cancelled.');
    fixture.detectChanges();
    const status: HTMLElement = fixture.nativeElement.querySelector('[role="status"]');

    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('Installation cancelled');
  });

  it('shows app launch help instead of installation instructions once installed', () => {
    // appinstalled may arrive before the outstanding prompt promise settles.
    service.isInstalling.set(true);
    service.isInstalled.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h2').textContent).toBe('OnTrack app');
    expect(fixture.nativeElement.textContent).toContain('Start menu, Dock, or home screen');
    expect(fixture.nativeElement.querySelector('details')).toBeNull();
    expect(installButton()).toBeNull();
  });
});
