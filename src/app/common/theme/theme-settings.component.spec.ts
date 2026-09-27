import {beforeEach, describe, expect, it, vi} from 'vitest';
import {signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatRadioModule} from '@angular/material/radio';
import {ThemeSettingsComponent} from './theme-settings.component';
import {ThemePreference, ThemeService} from './theme.service';

describe('ThemeSettingsComponent interaction (THM-F02)', () => {
  it('writes the chosen preference through the service, unchanged', () => {
    const setPreference = vi.fn();
    const theme = {
      preference: signal<ThemePreference>('system').asReadonly(),
      setPreference,
    } as unknown as ThemeService;
    TestBed.configureTestingModule({providers: [{provide: ThemeService, useValue: theme}]});
    const component = TestBed.runInInjectionContext(() => new ThemeSettingsComponent());

    component.onPreferenceChange({value: 'dark'} as never);

    expect(setPreference).toHaveBeenCalledWith('dark');
  });
});

describe('ThemeSettingsComponent rendering (THM-F02)', () => {
  let fixture: ComponentFixture<ThemeSettingsComponent>;

  function render(initial: ThemePreference) {
    const theme = {
      preference: signal(initial).asReadonly(),
      setPreference: vi.fn(),
    } as unknown as ThemeService;

    TestBed.configureTestingModule({
      declarations: [ThemeSettingsComponent],
      imports: [MatRadioModule],
      providers: [{provide: ThemeService, useValue: theme}],
    });
    fixture = TestBed.createComponent(ThemeSettingsComponent);
    fixture.detectChanges();
  }

  function radioInput(value: ThemePreference): HTMLInputElement {
    return fixture.nativeElement.querySelector(`#theme-preference-${value} input`);
  }

  beforeEach(() => render('dark'));

  it('shows the stored preference as the selected option on load', () => {
    expect(radioInput('dark').checked).toBe(true);
    expect(radioInput('light').checked).toBe(false);
    expect(radioInput('system').checked).toBe(false);
  });

  it('names all three choices in words, not icons alone', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Light');
    expect(text).toContain('Dark');
    expect(text).toContain('System');
  });

  it('exposes an accessible group label naming the control and a one-line System explanation', () => {
    const group: HTMLElement = fixture.nativeElement.querySelector('mat-radio-group');
    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-labelledby')).toBe('theme-preference-title');
    expect(fixture.nativeElement.textContent).toContain(
      "System follows your device's Light or Dark setting",
    );
  });
});
