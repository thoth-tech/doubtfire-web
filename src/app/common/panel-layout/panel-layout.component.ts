import {BreakpointObserver} from '@angular/cdk/layout';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  forwardRef,
  inject,
} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {Subject, takeUntil} from 'rxjs';
import {PANEL_LAYOUT, PanelLayoutHost, PanelRegistration} from './panel-layout.token';

/**
 * Rounded panels side by side with even gaps: a list, the work, and a side panel such as
 * comments. Each `app-panel` inside can collapse to a rail, be resized, or go full screen.
 *
 * Below the stack breakpoint only one panel shows at a time, picked from a row of tabs, so
 * nothing scrolls sideways on a small screen.
 *
 * Above it, every expanded panel keeps its minimum width. When the page cannot fit them
 * all, the lowest-priority side panels (the first collapsible ones, so the list and then
 * comments) show as rails until there is room again. That is the layout's call alone and
 * never written over the user's remembered choice.
 */
@Component({
  selector: 'app-panel-layout',
  templateUrl: './panel-layout.component.html',
  styleUrl: './panel-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [MatIconModule],
  providers: [{provide: PANEL_LAYOUT, useExisting: forwardRef(() => PanelLayoutComponent)}],
})
export class PanelLayoutComponent implements PanelLayoutHost, OnInit, AfterViewInit, OnDestroy {
  /** The width of a collapsed panel's rail, matching `.app-panel--collapsed`. */
  public static readonly railWidth = 44;

  /** Namespaces the remembered panel state, as in `ontrack.panels.<page>.<panel>`. */
  @Input({required: true}) public page: string;

  /** The width, in pixels, at and below which the panels become tabs. */
  @Input() public stackBelow = 899.98;

  /** Hide the tab row when the page switches panels itself. */
  @Input() public showTabs = true;

  @Input() public fullscreenPanel: string | null = null;
  @Output() public fullscreenPanelChange: EventEmitter<string | null> = new EventEmitter();

  /** The one panel shown while stacked. Falls back to the first registered panel. */
  @Input() public set activePanel(panelId: string | null) {
    this._activePanel = panelId;
  }
  public get activePanel(): string | null {
    const panels = this.panels;
    if (this._activePanel && panels.some((panel) => panel.panelId === this._activePanel)) {
      return this._activePanel;
    }
    return panels[0]?.panelId ?? null;
  }
  @Output() public activePanelChange: EventEmitter<string | null> = new EventEmitter();

  public stacked = false;
  public panels: PanelRegistration[] = [];

  /** The width the panels have to share, or null before it has been measured. */
  public availableWidth: number | null = null;

  private _activePanel: string | null = null;
  private autoRailed: ReadonlySet<string> = new Set();
  private readonly releasedRails: Set<string> = new Set();
  private resizeObserver: ResizeObserver | null = null;
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly destroy$: Subject<void> = new Subject();

  @HostBinding('class.app-panel-layout--stacked')
  public get stackedClass(): boolean {
    return this.stacked;
  }

  @HostBinding('class.app-panel-layout--fullscreen')
  public get fullscreenClass(): boolean {
    return !!this.fullscreenPanel;
  }

  public ngOnInit(): void {
    this.breakpointObserver
      .observe(`(max-width: ${this.stackBelow}px)`)
      .pipe(takeUntil(this.destroy$))
      .subscribe(({matches}) => {
        this.stacked = matches;
        this.changeDetector.markForCheck();
        if (matches && this.fullscreenPanel) {
          this.setFullscreen(null);
        }
        this.updateAutoRails();
        this.notifyResize();
      });
  }

  public ngAfterViewInit(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver = new ResizeObserver((entries) => {
      const width = entries[entries.length - 1]?.contentRect.width;
      if (typeof width === 'number') {
        this.zone.run(() => this.setAvailableWidth(width));
      }
    });
    this.resizeObserver.observe(this.host.nativeElement);
  }

  public ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  public register(panel: PanelRegistration): void {
    if (!this.panels.includes(panel)) {
      this.panels = [...this.panels, panel];
      this.scheduleAutoRails();
    }
  }

  public unregister(panel: PanelRegistration): void {
    this.panels = this.panels.filter((candidate) => candidate !== panel);
    this.releasedRails.delete(panel.panelId);
    this.scheduleAutoRails();
    if (this.fullscreenPanel === panel.panelId) {
      this.setFullscreen(null);
    }
  }

  public toggleFullscreen(panelId: string): void {
    this.setFullscreen(this.fullscreenPanel === panelId ? null : panelId);
  }

  public exitFullscreen(): void {
    this.setFullscreen(null);
  }

  public selectPanel(panelId: string): void {
    this._activePanel = panelId;
    this.activePanelChange.emit(panelId);
    this.notifyResize();
  }

  public setAvailableWidth(width: number): void {
    this.availableWidth = Math.max(0, width);
    this.updateAutoRails();
  }

  public isAutoRailed(panelId: string): boolean {
    return this.autoRailed.has(panelId);
  }

  public releaseAutoRail(panelId: string): void {
    this.releasedRails.add(panelId);
    this.updateAutoRails();
    this.notifyResize();
  }

  public maxWidthFor(panel: PanelRegistration): number {
    if (this.availableWidth === null || this.stacked) {
      return Number.POSITIVE_INFINITY;
    }
    const others = this.panels
      .filter((candidate) => candidate !== panel)
      .reduce((sum, candidate) => sum + this.widthNeeded(candidate, this.autoRailed), 0);
    return this.availableWidth - others - this.gapTotal();
  }

  /**
   * Rails the first collapsible panels, in order, until every expanded panel fits at its
   * minimum. A panel the user opened from its rail is skipped until everything fits.
   */
  public updateAutoRails(): void {
    const next: Set<string> = new Set();
    const available = this.availableWidth;
    if (available !== null && !this.stacked && !this.fullscreenPanel) {
      if (this.requiredWidth(next) <= available) {
        this.releasedRails.clear();
      }
      const candidates = this.panels.filter(
        (panel) => panel.collapsible && !panel.collapsed && !this.releasedRails.has(panel.panelId),
      );
      for (const panel of candidates) {
        if (this.requiredWidth(next) <= available) {
          break;
        }
        next.add(panel.panelId);
      }
    }
    const changed =
      next.size !== this.autoRailed.size || [...next].some((id) => !this.autoRailed.has(id));
    if (changed) {
      this.autoRailed = next;
      this.changeDetector.markForCheck();
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  public onEscape(event: Event): void {
    // A dialog or menu that handled Esc first keeps it.
    if (!this.fullscreenPanel || event.defaultPrevented) {
      return;
    }
    this.setFullscreen(null);
  }

  /** PDF viewers and charts measure themselves on window resize. */
  public notifyResize(): void {
    window.dispatchEvent(new Event('resize'));
  }

  private scheduleAutoRails(): void {
    // Panels register while the view is being checked, so settle the rails just after.
    Promise.resolve().then(() => this.updateAutoRails());
  }

  private requiredWidth(railed: ReadonlySet<string>): number {
    return (
      this.panels.reduce((sum, panel) => sum + this.widthNeeded(panel, railed), 0) + this.gapTotal()
    );
  }

  private widthNeeded(panel: PanelRegistration, railed: ReadonlySet<string>): number {
    const rail = panel.collapsible && (panel.collapsed || railed.has(panel.panelId));
    return rail ? PanelLayoutComponent.railWidth : panel.minWidth;
  }

  private gapTotal(): number {
    const count = this.panels.length;
    if (count < 2) {
      return 0;
    }
    const gap = parseFloat(getComputedStyle(this.host.nativeElement).columnGap);
    return (Number.isFinite(gap) ? gap : 12) * (count - 1);
  }

  private setFullscreen(panelId: string | null): void {
    if (this.fullscreenPanel === panelId) {
      return;
    }
    this.fullscreenPanel = panelId;
    this.fullscreenPanelChange.emit(panelId);
    this.updateAutoRails();
    this.notifyResize();
  }
}
