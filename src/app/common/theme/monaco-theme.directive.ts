import {DiffEditorComponent, EditorComponent} from 'ngx-monaco-editor-v2-alternative';
import {DestroyRef, Directive, InjectionToken, effect, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ThemeService} from './theme.service';

type MonacoThemeApi = {editor: {setTheme(theme: string): void}};

// The wrapper loads Monaco into window before emitting onInit. Resolve lazily:
// reading it when the directive is created would race the asynchronous loader.
export const MONACO_THEME_API: InjectionToken<() => MonacoThemeApi | undefined> =
  new InjectionToken('Monaco theme API', {
    providedIn: 'root',
    factory: () => () => (window as Window & {monaco?: MonacoThemeApi}).monaco,
  });

/** Use Monaco's palette API without recreating models, selection or undo history. */
@Directive({selector: 'ngx-monaco-editor, ngx-monaco-diff-editor', standalone: false})
export class MonacoThemeDirective {
  private readonly theme = inject(ThemeService);
  private readonly api = inject(MONACO_THEME_API);

  constructor() {
    const editor =
      inject(EditorComponent, {self: true, optional: true}) ??
      inject(DiffEditorComponent, {self: true, optional: true});
    editor?.onInit.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => this.apply());
    effect(() => this.apply());
  }

  private apply(): void {
    const palette = this.theme.resolved() === 'dark' ? 'vs-dark' : 'vs';
    this.api()?.editor.setTheme(palette);
  }
}
