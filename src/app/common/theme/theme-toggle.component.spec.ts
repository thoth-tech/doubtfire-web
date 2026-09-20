import {describe, expect, it, vi} from 'vitest';
import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {ThemeToggleComponent} from './theme-toggle.component';
import {ThemeService} from './theme.service';

// Method-level, no rendering: the component reads isDark and writes the opposite
// preference. Constructed in an injection context so its inject(ThemeService)
// resolves the stub, without pulling in Material rendering.
describe('ThemeToggleComponent', () => {
  function make(isDark: boolean) {
    const setPreference = vi.fn();
    const theme = {isDark: signal(isDark), setPreference} as unknown as ThemeService;
    TestBed.configureTestingModule({providers: [{provide: ThemeService, useValue: theme}]});
    const component = TestBed.runInInjectionContext(() => new ThemeToggleComponent());
    return {component, setPreference};
  }

  it('switches to dark when the resolved theme is light', () => {
    const {component, setPreference} = make(false);
    component.toggle();
    expect(setPreference).toHaveBeenCalledWith('dark');
  });

  it('switches to light when the resolved theme is dark', () => {
    const {component, setPreference} = make(true);
    component.toggle();
    expect(setPreference).toHaveBeenCalledWith('light');
  });
});
