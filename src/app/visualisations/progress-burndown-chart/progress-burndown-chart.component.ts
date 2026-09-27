import {Color, LineChartComponent, ScaleType} from '@swimlane/ngx-charts';
import {formatDate} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DoCheck,
  ElementRef,
  HostListener,
  Inject,
  Input,
  LOCALE_ID,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Optional,
  SimpleChanges,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {Subscription} from 'rxjs';
import {
  PeerMedianPoint,
  PeerProgressResponse,
  PeerProgressService,
  PeerProgressState,
  Project,
  Unit,
} from 'src/app/api/models/doubtfire-model';
import {ChartBaseComponent} from 'src/app/common/chart-base/chart-base-component/chart-base-component.component';
import {ThemeColorService} from 'src/app/common/theme/theme-color.service';
import {DemoModeStore} from 'src/app/demo/demo-mode.store';
import {
  BurndownPoint,
  BurndownSeries,
  BurndownTooltip,
  TARGET_SERIES,
  buildTooltip,
  burndownDates,
  describeTooltip,
  nearestIndex,
  nearestSeriesAt,
  stepIndex,
} from './burndown-hover';

interface BurndownDot {
  name: string;
  color: string;
  transform: string;
  visible: boolean;
}

/** Where the plot sits inside the chart wrapper, in CSS pixels. */
interface PlotGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
  wrapperWidth: number;
  wrapperLeft: number;
  wrapperTop: number;
  dates: string[];
  positions: number[];
  /** ys[series][date] for each series in `data`; undefined where it has no point. */
  ys: (number | undefined)[][];
}

interface PendingPointer {
  clientX: number;
  clientY: number;
  pointerType: string;
}

/** How close, in pixels, the pointer has to be to a line to emphasise it. */
const LINE_HIT_TOLERANCE = 8;
const TOOLTIP_OFFSET = 12;
const TOOLTIP_FALLBACK_WIDTH = 200;
const TOOLTIP_FALLBACK_HEIGHT = 120;

interface BurndownSummary {
  name: 'Projected' | 'To Submit' | 'To Complete';
  remaining: number;
  color: string;
}

type PeerMedianState = 'loading' | 'error' | PeerProgressState;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

@Component({
  selector: 'f-progress-burndown-chart',
  templateUrl: './progress-burndown-chart.component.html',
  styleUrls: ['./progress-burndown-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ProgressBurndownChartComponent
  extends ChartBaseComponent
  implements AfterViewInit, DoCheck, OnChanges, OnDestroy, OnInit
{
  @ViewChild('root', {static: true}) rootRef?: ElementRef<HTMLElement>;
  @ViewChild('plot', {static: true}) plotRef?: ElementRef<HTMLElement>;
  @ViewChild('tooltipPanel', {static: true}) tooltipRef?: ElementRef<HTMLElement>;
  @ViewChild(LineChartComponent, {static: true}) lineChart?: LineChartComponent;

  @Input() project: Project;
  @Input() unit: Unit;
  @Input() grade: number;

  data: BurndownSeries[] = [];
  temp: BurndownSeries[] = [];

  // Chart options
  legend: boolean = false;
  showLabels: boolean = true;
  // ngx-charts animates in JS, which the global reduced-motion CSS cannot reach.
  animations: boolean = !prefersReducedMotion();
  xAxis: boolean = true;
  yAxis: boolean = true;
  showYAxisLabel: boolean = true;
  showXAxisLabel: boolean = true;
  xAxisLabel: string = 'Time';
  yAxisLabel: string = 'Work Remaining';
  // ngx-charts hands the scheme domain to the series by position, so the full palette is
  // kept here and the scheme is narrowed to whatever is on show. These are token names,
  // resolved to concrete colours at render time (seriesColor) so the lines flip with the
  // theme; ngx-charts needs a real colour string, not a var().
  private readonly seriesPalette: string[] = [
    '--ot-color-text-muted',
    '--ot-chart-axis',
    '--ot-chart-2',
    '--ot-chart-5',
    '--ot-chart-1',
  ];
  colorScheme: Color = {
    name: 'Burndown',
    selectable: true,
    group: ScaleType.Ordinal,
    // Light fallbacks; replaced with resolved tokens on the first applyVisibility().
    domain: ['#AAAAAA', '#777777', '#0079d8', '#E01B5D', '#7C3AED'],
  };

  yScaleMin: number = 0;
  yScaleMax: number = 100;

  /** Drives the privacy-safe status message below the chart. */
  peerMedianState: PeerMedianState = 'disabled';

  private seriesVisibility: Record<string, boolean> = {};
  private peerMedian: PeerMedianPoint[] = [];
  private activePeerMedianRequest?: Subscription;
  private peerMedianRequestVersion: number = 0;
  private initialised: boolean = false;
  private renderedTheme?: string;

  // Hover state. Everything the template reads is only replaced when the snapped date
  // or the emphasised series changes, so pointer movement does not run change detection.
  /** Index into the current dates of the crosshair, or null when it is hidden. */
  hoverIndex: number | null = null;
  crosshairVisible: boolean = false;
  crosshairTransform: string = 'translate3d(0, 0, 0)';
  crosshairHeight: number = 0;
  dots: BurndownDot[] = [];
  /** Kept after hiding so the panel can fade out with its last content. */
  tooltip: BurndownTooltip | null = null;
  tooltipTransform: string = 'translate3d(0, 0, 0)';
  tooltipFlipped: boolean = false;
  liveText: string = '';
  /** Bound to the chart; ngx-charts marks the listed series active and the rest inactive. */
  activeEntries: {name: string}[] = [];

  private legendEmphasis: string | null = null;
  private lineEmphasis: string | null = null;
  private pendingPointer: PendingPointer | null = null;
  private pendingLeave: boolean = false;
  private frame: number = 0;
  private readonly teardown: (() => void)[] = [];

  constructor(
    public viewContainerRef: ViewContainerRef,
    private peerProgressService: PeerProgressService,
    readonly demoMode: DemoModeStore,
    @Inject(LOCALE_ID) private locale: string,
    private themeColor: ThemeColorService,
    @Optional() private zone?: NgZone,
  ) {
    super(viewContainerRef);
    this.data = [];
    this.temp = [];
  }

  ngOnInit(): void {
    this.initialised = true;
    this.updateResponsiveAxisLabels();

    this.project.refreshBurndownChartData();
    this.updateData();

    this.data.forEach((item) => {
      this.seriesVisibility[item.name] = true;
    });

    if (this.demoMode.enabled) {
      this.loadPeerMedian();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    const projectChanged =
      !!changes.project &&
      !changes.project.firstChange &&
      changes.project.currentValue !== changes.project.previousValue;
    const unitChanged =
      !!changes.unit &&
      !changes.unit.firstChange &&
      changes.unit.currentValue !== changes.unit.previousValue;
    const gradeChanged =
      !!changes.grade &&
      !changes.grade.firstChange &&
      changes.grade.currentValue !== undefined &&
      changes.grade.currentValue !== changes.grade.previousValue;

    // Angular calls ngOnChanges before ngOnInit. Ignore that first call so the
    // initial peer request is made exactly once from ngOnInit. Refresh for
    // project and unit input changes as well as target-grade changes because
    // Angular can reuse this component while switching between project routes.
    if (!this.initialised || (!projectChanged && !unitChanged && !gradeChanged)) {
      return;
    }

    this.project.refreshBurndownChartData();
    this.updateData();

    // The comparison cohort changes with the project, unit, or target grade.
    if (this.demoMode.enabled) {
      this.loadPeerMedian();
    } else {
      this.peerMedianState = 'disabled';
      this.peerMedian = [];
      this.updateData();
    }
  }

  // Series colours are resolved token strings, so read them again when the theme flips
  // while the chart is on screen. Axis and legend text follow the tokens in CSS
  // (styles/_theme-special-surfaces.scss).
  ngDoCheck(): void {
    const theme = this.themeColor?.resolved?.();
    if (this.initialised && theme !== this.renderedTheme) {
      this.renderedTheme = theme;
      this.applyVisibility();
    }
  }

  @HostListener('window:resize')
  onViewportResize(): void {
    this.updateResponsiveAxisLabels();
    // The scale is rebuilt on resize, so the crosshair would point at stale pixels.
    this.hideCrosshair();
  }

  ngAfterViewInit(): void {
    this.listenForPointer();
  }

  ngOnDestroy(): void {
    this.peerMedianRequestVersion++;
    this.activePeerMedianRequest?.unsubscribe();
    this.teardown.splice(0).forEach((remove) => remove());

    if (this.frame && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.frame);
    }
    this.frame = 0;
  }

  private updateResponsiveAxisLabels(): void {
    const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth;

    const showAxisTitles = viewportWidth >= 640;

    this.showYAxisLabel = showAxisTitles;
    this.showXAxisLabel = showAxisTitles;
  }

  private loadPeerMedian(): void {
    const requestVersion = ++this.peerMedianRequestVersion;
    const requestedProjectId = this.project.id;
    const requestedGrade = this.grade ?? this.project.targetGrade;

    // Remove the old peer line immediately and cancel the previous request.
    // This prevents an old grade result from overwriting the current grade.
    this.activePeerMedianRequest?.unsubscribe();

    this.peerMedianState = 'loading';
    this.peerMedian = [];
    this.updateData();

    this.activePeerMedianRequest = this.peerProgressService
      .getCohortMedian(this.project, requestedGrade)
      .subscribe({
        next: (response) => {
          if (requestVersion !== this.peerMedianRequestVersion) {
            return;
          }

          // Fail safely if an adapter returns data for a different project or
          // grade than the one currently displayed.
          if (
            response.project_id !== requestedProjectId ||
            response.target_grade !== requestedGrade
          ) {
            this.peerMedian = [];
            this.peerMedianState = 'unavailable';
            this.updateData();
            return;
          }

          this.applyPeerMedianResponse(response);
          this.updateData();
        },

        error: () => {
          if (requestVersion !== this.peerMedianRequestVersion) {
            return;
          }

          this.peerMedian = [];
          this.peerMedianState = 'error';
          this.updateData();
        },
      });
  }

  private applyPeerMedianResponse(response: PeerProgressResponse): void {
    this.peerMedian = [];

    switch (response.state) {
      case 'ready':
        if (response.median_burndown.length === 0) {
          this.peerMedianState = 'unavailable';
          return;
        }

        this.peerMedian = [...response.median_burndown];
        this.peerMedianState = 'ready';
        return;

      case 'suppressed':
      case 'unavailable':
      case 'disabled':
        this.peerMedianState = response.state;
        return;
    }
  }

  updateData(): void {
    const chartData = this.project?.burndownChartData;
    const locale = this.locale;
    const startDate: Date = this.project.unit.startDate;
    const endDate: Date = this.project.unit.endDate;

    if (!chartData) {
      this.temp = [];
      this.data = [];
      return;
    }

    // Preserve the existing OnTrack burndown series. New chart values are
    // created instead of changing project.burndownChartData in place.
    const formattedData: BurndownSeries[] = chartData.map((series) => ({
      name: series.key,
      series: series.values
        .filter((value) => value[0] >= startDate.getTime() && value[0] <= endDate.getTime())
        .map((value) => ({
          name: formatDate(new Date(value[0]), 'd MMM', locale),
          value: Math.round(Math.max(0, value[1]) * 100),
        })),
    }));

    // Keep the existing workaround for the chart's y-axis bounds.
    const target = formattedData.find((series) => series.name === 'Target');

    if (target) {
      const start = target.series.find(
        (point) => point.name === formatDate(new Date(startDate), 'd MMM', locale),
      );

      const end = target.series.find(
        (point) => point.name === formatDate(new Date(endDate), 'd MMM', locale),
      );

      if (start) {
        start.value = 100;
      }

      if (end) {
        end.value = 0;
      }
    }

    // This label is intentionally explicit while the adapter uses mock data.
    if (this.peerMedianState === 'ready' && this.peerMedian.length > 0) {
      formattedData.push(
        this.toSeries('Peer median (demo)', this.peerMedian, startDate, endDate, locale),
      );
    }

    this.temp = JSON.parse(JSON.stringify(formattedData));
    this.seriesVisibility = Object.fromEntries(
      formattedData.map((series) => [series.name, this.seriesVisibility[series.name] !== false]),
    );
    this.applyVisibility();
  }

  private toSeries(
    name: string,
    points: PeerMedianPoint[],
    startDate: Date,
    endDate: Date,
    locale: string,
  ): BurndownSeries {
    return {
      name,
      series: points
        .filter((point) => {
          const time = new Date(point.date).getTime();

          return time >= startDate.getTime() && time <= endDate.getTime();
        })
        .map((point) => ({
          name: formatDate(new Date(point.date), 'd MMM', locale),
          value: Math.round(point.remaining * 100),
        })),
    };
  }

  onSelect(event: string | BurndownPoint): void {
    if (!this.isLegend(event)) {
      return;
    }

    this.toggleSeries(event);
  }

  toggleSeries(name: string): void {
    if (!this.temp.some((series) => series.name === name)) {
      return;
    }

    this.seriesVisibility[name] = !this.isDataShown(name);
    this.applyVisibility();
  }

  get summaries(): BurndownSummary[] {
    const names: BurndownSummary['name'][] = ['Projected', 'To Submit', 'To Complete'];

    return names.flatMap((name) => {
      const index = this.temp.findIndex((series) => series.name === name);
      const series = index >= 0 ? this.temp[index] : undefined;
      const latest = series?.series.at(-1)?.value;

      return latest === undefined
        ? []
        : [{name, remaining: latest, color: this.seriesColor(index)}];
    });
  }

  // A hidden series is dropped from the chart data. Zeroing its points instead left the
  // line drawn flat along the x axis while its legend button said it was off.
  private applyVisibility(): void {
    const shown = this.temp
      .map((series, index) => ({series, index}))
      .filter((entry) => this.isDataShown(entry.series.name));

    this.data = shown.map((entry) => ({
      name: entry.series.name,
      series: entry.series.series.map((point) => ({...point})),
    }));
    this.colorScheme = {
      ...this.colorScheme,
      domain: shown.map((entry) => this.seriesColor(entry.index)),
    };

    // One dot per line on show, kept in the DOM so it can fade in and out.
    this.dots = this.data.map((series, index) => ({
      name: series.name,
      color: this.colorScheme.domain[index],
      transform: 'translate3d(0, 0, 0)',
      visible: false,
    }));
    this.hideCrosshair();
    this.syncEmphasis();
  }

  isLegend(event: string | BurndownPoint): event is string {
    return typeof event === 'string';
  }

  isDataShown(name: string): boolean {
    return this.seriesVisibility[name] !== false;
  }

  seriesColor(index: number): string {
    return this.themeColor.token(this.seriesPalette[index % this.seriesPalette.length]);
  }

  public formatPerc(input: number): string {
    return `${input}%`;
  }

  /** Name the plot by what it currently says, for anyone who cannot see the lines. */
  get plotAriaLabel(): string {
    const summary = this.summaries
      .map((entry) => `${entry.name} ${entry.remaining}% remaining`)
      .join(', ');

    return [
      'Progress burndown chart of work remaining over time',
      summary,
      'Use the left and right arrow keys to read the values for each date',
    ]
      .filter((part) => part.length > 0)
      .join('. ');
  }

  /** The series drawn at full strength while the others fade, or null. */
  get emphasisedSeries(): string | null {
    return this.activeEntries[0]?.name ?? null;
  }

  isDimmed(name: string): boolean {
    const emphasised = this.emphasisedSeries;

    return emphasised !== null && emphasised !== name;
  }

  /** Legend chip or summary tile hover. Pass null when the pointer leaves it. */
  emphasiseSeries(name: string | null): void {
    this.legendEmphasis = name;
    this.syncEmphasis();
  }

  /**
   * ngx-charts clears its own active entries when the pointer leaves the chart. Its
   * mouseleave fires after the pointerover that set a legend emphasis, so hand it a
   * fresh array to put the emphasis back.
   */
  onChartDeactivate(): void {
    if (this.emphasisedSeries !== null) {
      this.activeEntries = [...this.activeEntries];
    }
  }

  onPlotKeydown(event: KeyboardEvent): void {
    const count = burndownDates(this.data).length;
    let next: number | null;

    switch (event.key) {
      case 'ArrowRight':
        next = stepIndex(this.crosshairVisible ? this.hoverIndex : null, 1, count);
        break;
      case 'ArrowLeft':
        next = stepIndex(this.crosshairVisible ? this.hoverIndex : null, -1, count);
        break;
      case 'Home':
        next = count > 0 ? 0 : null;
        break;
      case 'End':
        next = count > 0 ? count - 1 : null;
        break;
      case 'Escape':
        if (this.crosshairVisible) {
          event.preventDefault();
          this.hideCrosshair();
        }
        return;
      default:
        return;
    }

    if (next === null) {
      return;
    }

    event.preventDefault();
    this.showCrosshairAt(next);
  }

  onPlotBlur(): void {
    this.hideCrosshair();
  }

  /** Snap the crosshair, dots and tooltip to a date index. */
  showCrosshairAt(index: number, geometry: PlotGeometry | null = this.measurePlot()): void {
    const dates = geometry?.dates ?? burndownDates(this.data);
    const target = this.temp.find((series) => series.name === TARGET_SERIES);
    const tooltip = buildTooltip(this.data, this.colorScheme.domain, dates, index, target);

    if (!tooltip) {
      this.hideCrosshair();
      return;
    }

    this.hoverIndex = index;
    this.tooltip = tooltip;
    this.liveText = describeTooltip(tooltip);
    this.crosshairVisible = true;

    if (!geometry) {
      this.dots = this.dots.map((dot) => ({
        ...dot,
        visible: tooltip.rows.some((row) => row.name === dot.name),
      }));
      return;
    }

    const x = geometry.left + geometry.positions[index];
    this.crosshairTransform = `translate3d(${x}px, ${geometry.top}px, 0)`;
    this.crosshairHeight = geometry.height;

    const pointYs: number[] = [];
    this.dots = this.dots.map((dot, seriesIndex) => {
      const y = geometry.ys[seriesIndex]?.[index];

      if (y === undefined) {
        return {...dot, visible: false};
      }

      pointYs.push(geometry.top + y);

      return {...dot, visible: true, transform: `translate3d(${x}px, ${geometry.top + y}px, 0)`};
    });

    const panel = this.tooltipRef?.nativeElement;
    const width = Math.max(panel?.offsetWidth || 0, TOOLTIP_FALLBACK_WIDTH);
    const height = Math.max(panel?.offsetHeight || 0, TOOLTIP_FALLBACK_HEIGHT);
    const middle =
      pointYs.length > 0
        ? (Math.min(...pointYs) + Math.max(...pointYs)) / 2
        : geometry.top + geometry.height / 2;
    const maxTop = Math.max(geometry.top, geometry.top + geometry.height - height);
    const top = Math.min(maxTop, Math.max(geometry.top, middle - height / 2));

    this.tooltipFlipped = x + TOOLTIP_OFFSET + width > geometry.wrapperWidth;
    this.tooltipTransform = this.tooltipFlipped
      ? `translate3d(${x - TOOLTIP_OFFSET}px, ${top}px, 0) translateX(-100%)`
      : `translate3d(${x + TOOLTIP_OFFSET}px, ${top}px, 0)`;
  }

  hideCrosshair(): void {
    if (!this.crosshairVisible && this.hoverIndex === null) {
      return;
    }

    this.hoverIndex = null;
    this.crosshairVisible = false;
    this.liveText = '';
    this.dots = this.dots.map((dot) => (dot.visible ? {...dot, visible: false} : dot));
  }

  private syncEmphasis(): void {
    const name = this.legendEmphasis ?? this.lineEmphasis;
    const shown = name !== null && this.data.some((series) => series.name === name);
    const next = shown ? name : null;

    if (next !== this.emphasisedSeries) {
      this.activeEntries = next === null ? [] : [{name: next}];
    }
  }

  private inZone(work: () => void): void {
    if (this.zone) {
      this.zone.run(work);
    } else {
      work();
    }
  }

  private listenForPointer(): void {
    const plot = this.plotRef?.nativeElement;
    const root = this.rootRef?.nativeElement;

    if (!plot || !root || typeof document === 'undefined') {
      return;
    }

    const listen = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement | Document,
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ): void => {
      target.addEventListener(type, handler as EventListener, options);
      this.teardown.push(() => target.removeEventListener(type, handler as EventListener, options));
    };

    const register = (): void => {
      listen(plot, 'pointermove', (event) => this.queuePointer(event), {passive: true});
      listen(plot, 'pointerdown', (event) => this.queuePointer(event), {passive: true});
      listen(plot, 'pointerleave', (event) => {
        // A finger lifting also fires pointerleave; touch keeps the reading until a tap elsewhere.
        if (event.pointerType === 'mouse') {
          this.pendingPointer = null;
          this.pendingLeave = true;
          this.scheduleFrame();
        }
      });
      listen(
        document,
        'pointerdown',
        (event) => {
          if (this.crosshairVisible && !plot.contains(event.target as Node)) {
            this.inZone(() => this.hideCrosshair());
          }
        },
        {passive: true, capture: true},
      );
      listen(root, 'pointerover', (event) => this.onSeriesPointer(event, true));
      listen(root, 'pointerout', (event) => this.onSeriesPointer(event, false));
    };

    if (this.zone) {
      this.zone.runOutsideAngular(register);
    } else {
      register();
    }
  }

  /** Legend chips and summary tiles carry data-series; hovering one emphasises its line. */
  private onSeriesPointer(event: PointerEvent, entering: boolean): void {
    if (event.pointerType !== 'mouse' || !this.canHover()) {
      return;
    }

    const from = (event.target as Element | null)?.closest?.('[data-series]');

    if (!from) {
      return;
    }

    const related = (event.relatedTarget as Element | null)?.closest?.('[data-series]');

    if (!entering && related === from) {
      return;
    }

    const name = entering ? from.getAttribute('data-series') : null;

    if (name !== this.legendEmphasis) {
      this.inZone(() => this.emphasiseSeries(name));
    }
  }

  private canHover(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
    );
  }

  private queuePointer(event: PointerEvent): void {
    this.pendingPointer = {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerType: event.pointerType,
    };
    this.pendingLeave = false;
    this.scheduleFrame();
  }

  private scheduleFrame(): void {
    if (this.frame || typeof requestAnimationFrame !== 'function') {
      return;
    }

    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.flushPointer();
    });
  }

  private flushPointer(): void {
    const pointer = this.pendingPointer;
    this.pendingPointer = null;

    if (this.pendingLeave || !pointer) {
      this.pendingLeave = false;

      if (this.crosshairVisible || this.lineEmphasis !== null) {
        this.inZone(() => {
          this.lineEmphasis = null;
          this.syncEmphasis();
          this.hideCrosshair();
        });
      }
      return;
    }

    const geometry = this.measurePlot();

    if (!geometry || geometry.positions.length === 0) {
      return;
    }

    const x = pointer.clientX - geometry.wrapperLeft - geometry.left;
    const y = pointer.clientY - geometry.wrapperTop - geometry.top;
    const {positions} = geometry;
    const halfStep = positions.length > 1 ? (positions[1] - positions[0]) / 2 : LINE_HIT_TOLERANCE;
    const inside =
      x >= positions[0] - halfStep &&
      x <= positions[positions.length - 1] + halfStep &&
      y >= 0 &&
      y <= geometry.height;

    if (!inside) {
      if (
        pointer.pointerType === 'mouse' &&
        (this.crosshairVisible || this.lineEmphasis !== null)
      ) {
        this.inZone(() => {
          this.lineEmphasis = null;
          this.syncEmphasis();
          this.hideCrosshair();
        });
      }
      return;
    }

    const index = nearestIndex(positions, x);
    const lineIndex =
      pointer.pointerType === 'mouse' && this.canHover()
        ? nearestSeriesAt(positions, geometry.ys, x, y, LINE_HIT_TOLERANCE)
        : -1;
    const lineName = lineIndex >= 0 ? this.data[lineIndex].name : null;

    if (index === this.hoverIndex && this.crosshairVisible && lineName === this.lineEmphasis) {
      return;
    }

    this.inZone(() => {
      this.lineEmphasis = lineName;
      this.syncEmphasis();
      this.showCrosshairAt(index, geometry);
    });
  }

  /** Reads the chart's own scales, so the overlay lines up with what ngx-charts drew. */
  private measurePlot(): PlotGeometry | null {
    const chart = this.lineChart;
    const plot = this.plotRef?.nativeElement;
    const svg = plot?.querySelector('svg.ngx-charts');

    if (!chart?.xScale || !chart.yScale || !chart.dims || !plot || !svg) {
      return null;
    }

    const dates = burndownDates(this.data);
    const positions = dates.map((date) => chart.xScale(date) as number | undefined);

    // The chart redraws after change detection, so its scale can briefly trail the data.
    if (positions.some((position) => typeof position !== 'number' || Number.isNaN(position))) {
      return null;
    }

    const wrapperRect = plot.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const ys = this.data.map((series) => {
      const values = new Map(series.series.map((point) => [point.name, point.value]));

      return dates.map((date) => {
        const value = values.get(date);

        return value === undefined ? undefined : (chart.yScale(value) as number);
      });
    });

    return {
      left: svgRect.left - wrapperRect.left + chart.dims.xOffset,
      top: svgRect.top - wrapperRect.top + (chart.margin?.[0] ?? 0),
      width: chart.dims.width,
      height: chart.dims.height,
      wrapperWidth: wrapperRect.width,
      wrapperLeft: wrapperRect.left,
      wrapperTop: wrapperRect.top,
      dates,
      positions: positions as number[],
      ys,
    };
  }
}
