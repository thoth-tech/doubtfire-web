import {EditorComponent} from 'ngx-monaco-editor-v2-alternative';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {EventEmitter, signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {MONACO_THEME_API, MonacoThemeDirective} from './monaco-theme.directive';
import {ResolvedTheme, ThemeService} from './theme.service';

describe('MonacoThemeDirective', () => {
  const resolved = signal<ResolvedTheme>('light');
  let onInit: EventEmitter<unknown>;
  let setTheme: ReturnType<typeof vi.fn>;
  let loaded: boolean;

  beforeEach(() => {
    resolved.set('light');
    loaded = false;
    onInit = new EventEmitter();
    setTheme = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {provide: ThemeService, useValue: {resolved}},
        {provide: EditorComponent, useValue: {onInit}},
        {provide: MONACO_THEME_API, useValue: () => (loaded ? {editor: {setTheme}} : undefined)},
      ],
    });
    TestBed.runInInjectionContext(() => new MonacoThemeDirective());
  });

  it('handles a delayed loader and uses the current palette when the editor becomes ready', () => {
    TestBed.tick();
    expect(setTheme).not.toHaveBeenCalled();
    resolved.set('dark');
    loaded = true;
    onInit.emit({});
    expect(setTheme).toHaveBeenLastCalledWith('vs-dark');
  });

  it('follows live resolved theme changes without replacing editor options or models', () => {
    loaded = true;
    TestBed.tick();
    expect(setTheme).toHaveBeenLastCalledWith('vs');
    resolved.set('dark');
    TestBed.tick();
    expect(setTheme).toHaveBeenLastCalledWith('vs-dark');
    resolved.set('light');
    TestBed.tick();
    expect(setTheme).toHaveBeenLastCalledWith('vs');
  });

  it('removes the readiness listener when the view is destroyed', () => {
    TestBed.resetTestingModule();
    loaded = true;
    onInit.emit({});
    expect(setTheme).not.toHaveBeenCalled();
  });
});
