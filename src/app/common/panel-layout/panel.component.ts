import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {PANEL_LAYOUT, PanelRegistration} from './panel-layout.token';
import {PanelStateService} from './panel-state.service';

/**
 * One rounded card in an `app-panel-layout`. Project actions into `[panelActions]` and a
 * note beside the title into `[panelSubtitle]`; everything else becomes the body.
 *
 * A panel without a header puts an `app-panel-collapse-button` or an
 * `app-panel-fullscreen-button` in its content's own control row, which finds this panel
 * and collapses it or takes it full screen.
 */
@Component({
  selector: 'app-panel',
  templateUrl: './panel.component.html',
  styleUrl: './panel.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
})
export class PanelComponent implements PanelRegistration, OnInit, OnDestroy {
  @Input({required: true}) public panelId: string;
  @Input({required: true}) public panelTitle: string;
  @Input() public icon: string | null = null;
  @Input() public count: number | null = null;

  /** Without a header, the content carries an `app-panel-collapse-button` instead. */
  @Input() public showHeader = true;
  @Input() public collapsible = true;
  @Input() public fullscreenable = false;

  /** Takes the space the other panels leave. A flex panel has no width and cannot resize. */
  @Input() public flex = false;

  /** A number is pixels, a string any CSS width. A remembered width wins over it. */
  @Input() public width: number | string | null = null;
  /** Resizing, restored widths and the layout's space rule all keep the panel at least this wide. */
  @Input() public minWidth = 200;
  @Input() public maxWidth = 640;

  /** Which edge carries the drag handle, the one facing the flexible panel. */
  @Input() public resizeEdge: 'start' | 'end' | null = null;

  /** Starts collapsed when the user has no remembered choice for this panel. */
  @Input() public defaultCollapsed = false;

  @Input() public bodyClass = '';

  @Output() public widthChange: EventEmitter<number> = new EventEmitter();
  @Output() public collapsedChange: EventEmitter<boolean> = new EventEmitter();

  public collapsed = false;
  public resizing = false;

  private readonly layout = inject(PANEL_LAYOUT, {optional: true});
  private readonly state = inject(PanelStateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private removeDragListeners: (() => void) | null = null;
  private destroyed = false;

  @HostBinding('class.app-panel') public readonly baseClass = true;
  @HostBinding('attr.role') public readonly role = 'region';

  @HostBinding('attr.aria-label')
  public get ariaLabel(): string {
    return this.panelTitle;
  }

  @HostBinding('attr.data-panel-id')
  public get dataPanelId(): string {
    return this.panelId;
  }

  public get stacked(): boolean {
    return !!this.layout?.stacked;
  }

  @HostBinding('class.app-panel--fullscreen')
  public get isFullscreen(): boolean {
    return !!this.panelId && this.layout?.fullscreenPanel === this.panelId;
  }

  /** Railed by the layout because the page is too narrow, not by the user. */
  public get autoRailed(): boolean {
    return !!this.panelId && !!this.layout?.isAutoRailed(this.panelId);
  }

  /** Collapsing is a desktop idea: stacked panels already show one at a time. */
  @HostBinding('class.app-panel--collapsed')
  public get showRail(): boolean {
    return (
      this.collapsible && (this.collapsed || this.autoRailed) && !this.stacked && !this.isFullscreen
    );
  }

  /** Whether a collapse control makes sense right now, in the header or the content. */
  public get canCollapse(): boolean {
    return this.collapsible && !this.showRail && !this.stacked && !this.isFullscreen;
  }

  @HostBinding('class.app-panel--flex')
  public get flexClass(): boolean {
    return this.flex;
  }

  @HostBinding('class.app-panel--stacked')
  public get stackedClass(): boolean {
    return this.stacked;
  }

  @HostBinding('class.app-panel--hidden')
  public get hidden(): boolean {
    return this.stacked && this.layout?.activePanel !== this.panelId;
  }

  /** Everything behind a full-screen panel is out of reach of Tab. */
  @HostBinding('attr.inert')
  public get inert(): '' | null {
    const fullscreen = this.layout?.fullscreenPanel;
    return fullscreen && fullscreen !== this.panelId ? '' : null;
  }

  @HostBinding('style.width')
  public get hostWidth(): string | null {
    if (this.flex || this.stacked || this.isFullscreen || this.showRail || this.width == null) {
      return null;
    }
    return typeof this.width === 'number' ? `${this.width}px` : this.width;
  }

  @HostBinding('style.min-width')
  public get hostMinWidth(): string | null {
    if (this.stacked || this.isFullscreen || this.showRail) {
      return null;
    }
    return `${this.minWidth}px`;
  }

  public get canResize(): boolean {
    return !!this.resizeEdge && !this.flex && !this.stacked && !this.isFullscreen && !this.showRail;
  }

  public get collapseEdge(): 'start' | 'end' {
    return this.resizeEdge ?? 'end';
  }

  public get collapseIcon(): string {
    return this.collapseEdge === 'end' ? 'chevron_left' : 'chevron_right';
  }

  public get currentWidth(): number {
    return Math.round(this.host.nativeElement.getBoundingClientRect().width);
  }

  public ngOnInit(): void {
    this.layout?.register(this);
    if (!this.layout) {
      return;
    }
    const saved = this.state.read(this.layout.page, this.panelId);
    if (this.collapsible) {
      this.collapsed =
        typeof saved.collapsed === 'boolean' ? saved.collapsed : this.defaultCollapsed;
    }
    if (this.resizeEdge && !this.flex && saved.width) {
      this.width = this.clamp(saved.width);
      // A panel runs its ngOnInit inside the check that set its inputs, so emitting here
      // changes parent state Angular has already read, which is NG0100 under `[(width)]`
      // or any listener that feeds a binding. Hand the width over just after the check
      // instead, the way the layout settles its rails.
      void Promise.resolve().then(() => this.emitRestoredWidth());
    }
  }

  public ngOnDestroy(): void {
    this.destroyed = true;
    this.layout?.unregister(this);
    this.stopDragging();
  }

  /** The parent still has to hear it: the layout's space arithmetic uses the width it holds. */
  private emitRestoredWidth(): void {
    if (this.destroyed || typeof this.width !== 'number') {
      return;
    }
    this.widthChange.emit(this.width);
  }

  public setCollapsed(collapsed: boolean): void {
    if (!this.collapsible || this.collapsed === collapsed) {
      return;
    }
    this.collapsed = collapsed;
    this.collapsedChange.emit(collapsed);
    if (this.layout) {
      this.state.write(this.layout.page, this.panelId, {collapsed});
      this.layout.updateAutoRails();
      this.layout.notifyResize();
    }
  }

  /** The rail's button: undo the user's collapse, or open a panel the layout railed for space. */
  public expandFromRail(): void {
    if (this.collapsed) {
      this.setCollapsed(false);
    } else if (this.autoRailed) {
      this.layout?.releaseAutoRail(this.panelId);
    }
  }

  public toggleCollapsed(): void {
    this.setCollapsed(!this.collapsed);
  }

  public toggleFullscreen(): void {
    this.layout?.toggleFullscreen(this.panelId);
  }

  public startResize(event: PointerEvent): void {
    if (!this.canResize || event.button !== 0) {
      return;
    }
    // Only one drag owns the panel. The teardown for a drag lives in a single
    // field, so a second pointerdown before the first pointerup used to
    // overwrite it and strand three document listeners: the abandoned move
    // handler kept its own startX and startWidth and went on resizing the panel
    // from a pointer with no button held, for the rest of the session. Touch
    // reports button 0 for every finger, so the guard above does not cover it.
    this.stopDragging();
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = this.currentWidth;
    const direction = this.resizeEdge === 'end' ? 1 : -1;
    let frame = 0;

    const move = (moveEvent: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        this.width = this.clamp(startWidth + (moveEvent.clientX - startX) * direction);
        this.layout?.notifyResize();
      });
    };
    const up = () => {
      cancelAnimationFrame(frame);
      this.stopDragging();
      this.commitWidth();
    };

    this.resizing = true;
    document.body.classList.add('split-pane-resizing');
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    this.removeDragListeners = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
    };
  }

  public resizeWithKeyboard(event: KeyboardEvent): void {
    const step = event.shiftKey ? 64 : 16;
    const grow = this.resizeEdge === 'end' ? 'ArrowRight' : 'ArrowLeft';
    const shrink = this.resizeEdge === 'end' ? 'ArrowLeft' : 'ArrowRight';
    if (event.key !== grow && event.key !== shrink) {
      return;
    }
    event.preventDefault();
    this.width = this.clamp(this.currentWidth + (event.key === grow ? step : -step));
    this.commitWidth();
  }

  private commitWidth(): void {
    if (typeof this.width !== 'number') {
      return;
    }
    this.widthChange.emit(this.width);
    if (this.layout) {
      this.state.write(this.layout.page, this.panelId, {width: this.width});
      this.layout.notifyResize();
    }
  }

  private stopDragging(): void {
    this.resizing = false;
    this.removeDragListeners?.();
    this.removeDragListeners = null;
    document.body.classList.remove('split-pane-resizing');
  }

  private clamp(width: number): number {
    const room = this.layout ? this.layout.maxWidthFor(this) : Number.POSITIVE_INFINITY;
    const max = Math.min(this.maxWidth, room);
    return Math.round(Math.max(this.minWidth, Math.min(max, width)));
  }
}
