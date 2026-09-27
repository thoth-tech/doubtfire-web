import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {PwaInstallButtonComponent} from './pwa-install-button.component';
import {PwaInstallDialogComponent} from './pwa-install-dialog.component';
import {PwaInstallService} from './pwa-install.service';

describe('PwaInstallButtonComponent', () => {
  let fixture: ComponentFixture<PwaInstallButtonComponent>;
  let installed: ReturnType<typeof signal<boolean>>;
  let openDialog: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    installed = signal(false);
    openDialog = vi.fn();
    await TestBed.configureTestingModule({
      imports: [PwaInstallButtonComponent],
      providers: [
        {provide: PwaInstallService, useValue: {isInstalled: installed}},
        {provide: MatDialog, useValue: {open: openDialog}},
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PwaInstallButtonComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('offers installation help from a button without submitting the sign-in form', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.type).toBe('button');
    expect(button.textContent).toContain('Install OnTrack app');
    expect(openDialog).not.toHaveBeenCalled();

    button.click();
    expect(openDialog).toHaveBeenCalledWith(PwaInstallDialogComponent, {
      width: '560px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'first-heading',
    });
  });

  it('keeps help accessible after installation with an appropriate label', () => {
    installed.set(true);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.textContent).toContain('OnTrack app help');
    button.click();
    expect(openDialog).toHaveBeenCalledTimes(1);
  });
});
