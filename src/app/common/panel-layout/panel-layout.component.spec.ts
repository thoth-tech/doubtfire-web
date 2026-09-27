import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {BreakpointObserver} from '@angular/cdk/layout';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {BehaviorSubject} from 'rxjs';
import {PanelCollapseButtonComponent} from './panel-collapse-button.component';
import {PanelFullscreenButtonComponent} from './panel-fullscreen-button.component';
import {PanelLayoutComponent} from './panel-layout.component';
import {PanelStateService} from './panel-state.service';
import {PanelComponent} from './panel.component';

// The real template is set in the test module below, so this one stays empty.
@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    PanelLayoutComponent,
    PanelComponent,
    PanelCollapseButtonComponent,
    PanelFullscreenButtonComponent,
  ],
  // eslint-disable-next-line @angular-eslint/component-max-inline-declarations
  template: '',
})
class HostComponent {
  public fullscreen: string | null = null;
}

// A page that keeps the width itself, the way the project dashboard does. The restored
// width has to land here without moving the parent after its own check has run.
@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [PanelLayoutComponent, PanelComponent],
  // eslint-disable-next-line @angular-eslint/component-max-inline-declarations
  template: `
    <app-panel-layout page="spec">
      <app-panel
        panelId="list"
        panelTitle="Tasks"
        resizeEdge="end"
        [minWidth]="280"
        [(width)]="width"
      ></app-panel>
    </app-panel-layout>
  `,
})
class TwoWayWidthHostComponent {
  public width: number | string | null = 300;
}

const hostTemplate = `
    <app-panel-layout page="spec" [(fullscreenPanel)]="fullscreen">
      <app-panel
        icon="list"
        panelId="list"
        panelTitle="Tasks"
        resizeEdge="end"
        [maxWidth]="500"
        [minWidth]="280"
        [showHeader]="false"
        [width]="300"
      >
        <div class="list-controls"><app-panel-collapse-button></app-panel-collapse-button></div>
        <p>list</p>
      </app-panel>
      <app-panel
        panelId="work"
        panelTitle="Selected task"
        [collapsible]="false"
        [flex]="true"
        [minWidth]="420"
        [showHeader]="false"
      >
        <div class="work-tabs">
          <app-panel-collapse-button></app-panel-collapse-button>
          <app-panel-fullscreen-button buttonClass="work-fullscreen"></app-panel-fullscreen-button>
        </div>
        <button class="work-action" type="button">Act</button>
        <p>work</p>
      </app-panel>
      <app-panel
        icon="forum"
        panelId="comments"
        panelTitle="Comments"
        resizeEdge="start"
        [fullscreenable]="true"
        [minWidth]="320"
        [width]="340"
      >
        <p>comments</p>
      </app-panel>
    </app-panel-layout>
    <div class="outside-panel"><app-panel-fullscreen-button></app-panel-fullscreen-button></div>
  `;

describe('PanelLayoutComponent', () => {
  let stacked$: BehaviorSubject<{matches: boolean; breakpoints: object}>;
  let fixture: ComponentFixture<HostComponent>;

  const panel = (id: string): HTMLElement =>
    fixture.nativeElement.querySelector(`app-panel[data-panel-id="${id}"]`);
  const button = (id: string, label: string): HTMLButtonElement =>
    panel(id).querySelector(`button[aria-label="${label}"]`);

  const instance = <T>(id: string): T =>
    fixture.debugElement.query((el) => el.nativeElement === panel(id)).componentInstance as T;
  const layout = (): PanelLayoutComponent =>
    fixture.debugElement.children[0].componentInstance as PanelLayoutComponent;

  const create = () => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    window.localStorage.clear();
    stacked$ = new BehaviorSubject({matches: false, breakpoints: {}});
    await TestBed.configureTestingModule({
      imports: [HostComponent, TwoWayWidthHostComponent],
      providers: [{provide: BreakpointObserver, useValue: {observe: () => stacked$}}],
    })
      .overrideComponent(HostComponent, {set: {template: hostTemplate}})
      .compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('collapses a panel to a rail and expands it again', () => {
    create();
    const collapse = button('comments', 'Collapse Comments');
    expect(collapse.getAttribute('aria-expanded')).toBe('true');

    collapse.click();
    fixture.detectChanges();

    expect(panel('comments').classList).toContain('app-panel--collapsed');
    const rail = button('comments', 'Expand Comments');
    expect(rail.getAttribute('aria-expanded')).toBe('false');
    expect(rail.textContent).toContain('Comments');

    rail.click();
    fixture.detectChanges();

    expect(panel('comments').classList).not.toContain('app-panel--collapsed');
  });

  it('lets a headerless panel collapse from a button inside its own content', () => {
    create();
    const collapse = panel('list').querySelector<HTMLButtonElement>(
      '.list-controls button[aria-label="Collapse Tasks"]',
    );
    expect(collapse).not.toBeNull();
    expect(collapse.getAttribute('aria-expanded')).toBe('true');
    expect(collapse.classList).toContain('mat-mdc-icon-button');
    const spy = vi.spyOn(instance<PanelComponent>('list'), 'setCollapsed');

    collapse.click();
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledWith(true);
    expect(panel('list').classList).toContain('app-panel--collapsed');
    expect(panel('work').querySelector('button[aria-label^="Collapse"]')).toBeNull();
  });

  it('has no floating edge toggle on any panel', () => {
    create();
    expect(fixture.nativeElement.querySelector('.app-panel__edge-toggle')).toBeNull();
    const buttons = panel('list').querySelectorAll('button[aria-label="Collapse Tasks"]');
    expect(buttons.length).toBe(1);
  });

  it('renders the collapse button as nothing while the panels are stacked', () => {
    create();
    stacked$.next({matches: true, breakpoints: {}});
    fixture.detectChanges();
    expect(panel('list').querySelector('button[aria-label="Collapse Tasks"]')).toBeNull();
  });

  it('keeps a resized panel between its minimum and the room the others leave', () => {
    create();
    const list = instance<PanelComponent>('list');
    vi.spyOn(list, 'currentWidth', 'get').mockReturnValue(290);
    list.resizeWithKeyboard(new KeyboardEvent('keydown', {key: 'ArrowLeft', shiftKey: true}));
    expect(list.width).toBe(280);

    // 1100 wide less work (420), comments (320) and two 12px gaps leaves 336 for the list.
    layout().setAvailableWidth(1100);
    vi.spyOn(list, 'currentWidth', 'get').mockReturnValue(330);
    list.resizeWithKeyboard(new KeyboardEvent('keydown', {key: 'ArrowRight', shiftKey: true}));
    expect(list.width).toBe(336);
    expect(panel('list').style.minWidth).toBe('280px');
  });

  it('does not strand a drag when a second pointer grabs the same handle', () => {
    // The teardown for a drag lives in one field. A second pointerdown used to
    // overwrite it, leaving the first drag's document listeners on the page for
    // good, still resizing the panel from a pointer with no button held. Touch
    // reports button 0 for every finger, so this is a two-finger grab.
    create();
    const list = instance<PanelComponent>('list');
    const added: string[] = [];
    const removed: string[] = [];
    vi.spyOn(document, 'addEventListener').mockImplementation(((type: string) => {
      added.push(type);
    }) as never);
    vi.spyOn(document, 'removeEventListener').mockImplementation(((type: string) => {
      removed.push(type);
    }) as never);

    const grab = () => new PointerEvent('pointerdown', {button: 0, clientX: 500});
    list.startResize(grab());
    list.startResize(grab());

    // Whatever the second grab added, the first grab's listeners are gone too.
    expect(added.filter((type) => type === 'pointermove').length).toBe(2);
    expect(removed.filter((type) => type === 'pointermove').length).toBe(1);
    expect(list.resizing).toBe(true);

    vi.mocked(document.addEventListener).mockRestore();
    vi.mocked(document.removeEventListener).mockRestore();
  });

  it('clamps a remembered width that is out of range when it loads', () => {
    window.localStorage.setItem('ontrack.panels.spec.list', '{"width":90}');
    window.localStorage.setItem('ontrack.panels.spec.comments', '{"width":9000}');
    create();
    expect(panel('list').style.width).toBe('280px');
    expect(instance<PanelComponent>('comments').width).toBe(640);
  });

  it('hands a restored width to a two-way parent after its check, never inside it', async () => {
    window.localStorage.setItem('ontrack.panels.spec.list', '{"width":420}');
    const host = TestBed.createComponent(TwoWayWidthHostComponent);

    // Emitting straight from ngOnInit moved the parent's `width` after Angular had
    // already read it for the `[width]` binding, which is NG0100 in dev mode.
    expect(() => host.detectChanges()).not.toThrow();
    expect(host.componentInstance.width).toBe(300);

    await host.whenStable();
    host.detectChanges();

    expect(host.componentInstance.width).toBe(420);
    expect(host.nativeElement.querySelector('app-panel').style.width).toBe('420px');
  });

  it('drops a restored width when the panel goes before the check it waits for', async () => {
    window.localStorage.setItem('ontrack.panels.spec.list', '{"width":420}');
    const host = TestBed.createComponent(TwoWayWidthHostComponent);
    host.detectChanges();
    host.destroy();

    await host.whenStable();

    expect(host.componentInstance.width).toBe(300);
  });

  it('rails the list, then comments, when the page is too narrow, without touching storage', async () => {
    create();
    await Promise.resolve();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    // All three need 280 + 420 + 320 + 24 = 1044.
    layout().setAvailableWidth(1000);
    fixture.detectChanges();
    expect(panel('list').classList).toContain('app-panel--collapsed');
    expect(panel('comments').classList).not.toContain('app-panel--collapsed');
    expect(instance<PanelComponent>('list').collapsed).toBe(false);

    layout().setAvailableWidth(700);
    fixture.detectChanges();
    expect(panel('comments').classList).toContain('app-panel--collapsed');

    layout().setAvailableWidth(1200);
    fixture.detectChanges();
    expect(panel('list').classList).not.toContain('app-panel--collapsed');
    expect(panel('comments').classList).not.toContain('app-panel--collapsed');
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('ontrack.panels.spec.list')).toBeNull();
  });

  it('opens a space-railed panel from its rail without remembering it', async () => {
    create();
    await Promise.resolve();
    layout().setAvailableWidth(1000);
    fixture.detectChanges();

    button('list', 'Expand Tasks').click();
    fixture.detectChanges();
    expect(panel('list').classList).not.toContain('app-panel--collapsed');
    expect(window.localStorage.getItem('ontrack.panels.spec.list')).toBeNull();
  });

  it('remembers collapsed state and width under a page and panel key', () => {
    create();
    button('comments', 'Collapse Comments').click();
    const list = fixture.debugElement.children[0].children[0].componentInstance as PanelComponent;
    list.width = 360;
    list.resizeWithKeyboard(new KeyboardEvent('keydown', {key: 'ArrowRight'}));

    expect(JSON.parse(window.localStorage.getItem('ontrack.panels.spec.comments'))).toEqual({
      collapsed: true,
    });
    expect(
      JSON.parse(window.localStorage.getItem('ontrack.panels.spec.list')).width,
    ).toBeGreaterThan(0);

    fixture.destroy();
    create();

    expect(panel('comments').classList).toContain('app-panel--collapsed');
    expect(panel('list').style.width).not.toBe('300px');
  });

  it('falls back to defaults when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });

    create();
    expect(panel('comments').classList).not.toContain('app-panel--collapsed');
    expect(panel('list').style.width).toBe('300px');

    expect(() => {
      button('comments', 'Collapse Comments').click();
      fixture.detectChanges();
    }).not.toThrow();
    expect(panel('comments').classList).toContain('app-panel--collapsed');
  });

  it('ignores stored values of the wrong shape', () => {
    const service = TestBed.inject(PanelStateService);
    window.localStorage.setItem('ontrack.panels.spec.comments', '{"collapsed":"yes","width":-4}');
    expect(service.read('spec', 'comments')).toEqual({});
    window.localStorage.setItem('ontrack.panels.spec.comments', 'not json');
    expect(service.read('spec', 'comments')).toEqual({});
  });

  it('goes full screen, makes the rest inert, and leaves on Esc', () => {
    create();
    button('comments', 'Full screen Comments').click();
    fixture.detectChanges();

    expect(fixture.componentInstance.fullscreen).toBe('comments');
    expect(panel('comments').classList).toContain('app-panel--fullscreen');
    expect(panel('list').hasAttribute('inert')).toBe(true);
    expect(button('comments', 'Exit full screen').getAttribute('aria-pressed')).toBe('true');

    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    fixture.detectChanges();

    expect(fixture.componentInstance.fullscreen).toBeNull();
    expect(panel('list').hasAttribute('inert')).toBe(false);
  });

  describe('full-screen button', () => {
    const fullscreenButton = (): HTMLButtonElement =>
      panel('work').querySelector('.work-tabs app-panel-fullscreen-button button');

    it('toggles the panel it sits in, with a label, pressed state and icon to match', () => {
      create();
      const toggle = fullscreenButton();
      const spy = vi.spyOn(instance<PanelComponent>('work'), 'toggleFullscreen');

      expect(toggle.getAttribute('aria-label')).toBe('Open Selected task full screen');
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(toggle.classList).toContain('mat-mdc-icon-button');
      expect(toggle.classList).toContain('work-fullscreen');
      expect(toggle.textContent.trim()).toBe('open_in_full');

      toggle.click();
      fixture.detectChanges();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.fullscreen).toBe('work');
      expect(panel('work').classList).toContain('app-panel--fullscreen');
      expect(panel('list').hasAttribute('inert')).toBe(true);
      expect(toggle.getAttribute('aria-label')).toBe('Exit full screen');
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      expect(toggle.textContent.trim()).toBe('close_fullscreen');

      toggle.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.fullscreen).toBeNull();
      expect(panel('work').classList).not.toContain('app-panel--fullscreen');
    });

    it('renders nothing outside a panel', () => {
      create();
      const outside = fixture.nativeElement.querySelector('.outside-panel');
      expect(outside.querySelector('app-panel-fullscreen-button')).not.toBeNull();
      expect(outside.querySelector('button')).toBeNull();
    });

    it('renders nothing while the panels are stacked', () => {
      create();
      stacked$.next({matches: true, breakpoints: {}});
      fixture.detectChanges();
      expect(fullscreenButton()).toBeNull();
    });

    it('leaves full screen on Esc and puts focus back on the button', async () => {
      create();
      fullscreenButton().click();
      fixture.detectChanges();
      panel('work').querySelector<HTMLButtonElement>('.work-action').focus();
      expect(document.activeElement).toBe(panel('work').querySelector('.work-action'));

      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
      fixture.detectChanges();
      // Focus moves once the check that saw full screen end has finished.
      await Promise.resolve();

      expect(fixture.componentInstance.fullscreen).toBeNull();
      expect(panel('work').classList).not.toContain('app-panel--fullscreen');
      expect(document.activeElement).toBe(fullscreenButton());
    });

    it('keeps one panel full screen at a time, swapping from comments to the task', async () => {
      create();
      const comments = button('comments', 'Full screen Comments');
      comments.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.fullscreen).toBe('comments');

      fullscreenButton().click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.fullscreen).toBe('work');
      expect(fixture.nativeElement.querySelectorAll('.app-panel--fullscreen').length).toBe(1);
      expect(panel('comments').classList).not.toContain('app-panel--fullscreen');
      expect(panel('comments').hasAttribute('inert')).toBe(true);
      expect(panel('work').hasAttribute('inert')).toBe(false);

      button('comments', 'Full screen Comments').click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.fullscreen).toBe('comments');
      expect(fixture.nativeElement.querySelectorAll('.app-panel--fullscreen').length).toBe(1);
      expect(fullscreenButton().getAttribute('aria-pressed')).toBe('false');
    });
  });

  it('shows one panel at a time behind tabs when stacked, and ignores collapse', () => {
    window.localStorage.setItem('ontrack.panels.spec.comments', '{"collapsed":true}');
    create();
    stacked$.next({matches: true, breakpoints: {}});
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(3);
    expect(panel('list').classList).not.toContain('app-panel--hidden');
    expect(panel('comments').classList).toContain('app-panel--hidden');

    (tabs[2] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(panel('comments').classList).not.toContain('app-panel--hidden');
    expect(panel('comments').classList).not.toContain('app-panel--collapsed');
    expect(panel('list').classList).toContain('app-panel--hidden');
  });
});
