import { Component, OnInit, Input, SimpleChanges, ChangeDetectorRef, HostListener, ElementRef, AfterViewInit, OnChanges, OnDestroy, ViewContainerRef } from '@angular/core';
import { ChartBaseComponent } from 'src/app/common/chart-base/chart-base-component/chart-base-component.component';
import { GradeService } from 'src/app/api/models/doubtfire-model';
import { OutcomeService } from 'src/app/common/services/outcome-service';
import { Subscription } from 'rxjs';
import { TooltipService } from '@swimlane/ngx-charts';

interface AlignmentChartData {
  name: string;
  series: {
    name: string;
    value: number;
  }[];
}

@Component({
  selector: 'f-alignment-bar-chart',
  templateUrl: './alignment-bar-chart.component.html',
  styleUrls: ['./alignment-bar-chart.component.scss'],
})
export class AlignmentBarChartComponent extends ChartBaseComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input() project: any;
  @Input() unit: any;
  @Input() source: any;
  @Input() taskStatusFactor: any;

  chartData: AlignmentChartData[] = [];
  originalData: AlignmentChartData[] = [];
  isLoading = false;
  hasError = false;
  errorMessage = '';
  stacked = false;
  colorScheme: any = { domain: [] };
  view: number[] = [700, 300];

  showXAxis = true;
  showYAxis = true;
  gradient = false;
  showLegend = true;
  showXAxisLabel = true;
  xAxisLabel = 'Learning Outcomes';
  showYAxisLabel = false;
  yAxisLabel = '';
  animations = true;
  tooltipDisabled = false;
  yAxisTicks = [];

  private subscriptions: Subscription[] = [];

  constructor(
    private gradeService: GradeService,
    private outcomeService: OutcomeService,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef,
    private chartToolTipService: TooltipService,
    public viewContainerRef: ViewContainerRef
  ) {
    super(null);
    this.setupColorScheme();
  }

  ngOnInit(): void {
    this.updateChartSize();
    this.setupTooltipContainer();
    setTimeout(() => this.updateData(), 0);

    if (this.outcomeService.alignmentChanged) {
      const subscription = this.outcomeService.alignmentChanged.subscribe(() => {
        this.updateData();
      });
      this.subscriptions.push(subscription);
    }
  }

  private setupTooltipContainer(): void {
    try {
      this.chartToolTipService.injectionService.setRootViewContainer(this.viewContainerRef);
    } catch (error) {
      console.warn('Failed to set tooltip container:', error);
    }
  }

  ngAfterViewInit(): void {
    this.updateChartSize();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateChartSize();
  }

  updateChartSize(): void {
    const container = this.elementRef.nativeElement.querySelector('.chart-area');
    if (container) {
      this.view = [Math.max(container.clientWidth, 300), 300];
      this.cdr.detectChanges();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (('unit' in changes && changes.unit.currentValue) ||
        ('source' in changes && changes.source.currentValue)) {
      this.updateData();
    }
  }

  setChartType(isStacked: boolean): void {
    this.stacked = isStacked;
    this.cdr.detectChanges();
  }

  /**
   * Handle legend filtering
   */
  onSelect(event: any): void {
    console.log('Chart selection event:', event);

    if (this.isLegend(event)) {
      // Legend click - toggle series visibility
      if (this.isDataShown(event)) {
        console.log('Hiding series:', event);
        this.hideSeriesData(event);
      } else {
        console.log('Showing series:', event);
        this.restoreSeriesData(event);
      }
    } else { /* empty */ }
  }

  private isLegend(event: any): boolean {
    return typeof event === 'string';
  }

  private isDataShown(seriesName: string): boolean {
    const visibleOutcome = this.chartData.find(outcome => {
      return outcome.series.find(series => {
        return series.name === seriesName && series.value !== 0;
      });
    });

    return typeof visibleOutcome !== 'undefined';
  }

  /**
   * Hide a series by setting all its values to 0
   */
  private hideSeriesData(seriesName: string): void {
    const tempData = JSON.parse(JSON.stringify(this.chartData));
    tempData.forEach(outcome => {
      outcome.series.forEach(series => {
        if (series.name === seriesName) {
          series.value = 0;
        }
      });
    });
    this.chartData = tempData;
    this.cdr.detectChanges();
  }

  /**
   * Restore a series by setting values back from original data
   */
  private restoreSeriesData(seriesName: string): void {
    this.originalData.forEach(originalOutcome => {
      originalOutcome.series.forEach(originalSeries => {
        if (originalSeries.name === seriesName) {
          this.setChartDataBackToOriginal(originalOutcome.name, originalSeries.name, originalSeries.value);
        }
      });
    });
  }

  private setChartDataBackToOriginal(outcomeName: string, seriesName: string, originalValue: number): void {
    const tempData = JSON.parse(JSON.stringify(this.chartData));
    const outcome = tempData.find(_outcome => _outcome.name === outcomeName);
    if (outcome) {
      const series = outcome.series.find(_series => _series.name === seriesName);
      if (series) {
        series.value = originalValue;
      }
    }
    this.chartData = tempData;
    this.cdr.detectChanges();
  }

  updateData(): void {
    this.isLoading = true;
    this.hasError = false;

    try {
      const actualUnit = this.resolveObject(this.unit);
      const actualSource = this.resolveObject(this.source);

      if (!this.isValidUnit(actualUnit)) {
        this.showError('No valid unit available');
        return;
      }

      if (!this.isValidSource(actualSource)) {
        this.showError('No valid source available');
        return;
      }

      const alignmentData = this.outcomeService.targetsByGrade(actualUnit, actualSource);
      console.log('Raw alignment data:', alignmentData);

      this.originalData = this.transformData(alignmentData);
      console.log('Transformed original data:', this.originalData);

      this.chartData = JSON.parse(JSON.stringify(this.originalData));

      this.isLoading = false;
      this.updateChartSize();
      this.cdr.detectChanges();
    } catch (error) {
      this.showError('An error occurred while updating the chart');
      console.error('Chart update error:', error);
    }
  }

  /**
   * Reset all series to visible
   */
  resetAllSeries(): void {
    this.chartData = JSON.parse(JSON.stringify(this.originalData));
    this.cdr.detectChanges();
  }

  /**
   * Hide all series except one
   */
  showOnlySeries(seriesName: string): void {
    const allSeriesNames = new Set<string>();
    this.originalData.forEach(outcome => {
      outcome.series.forEach(series => {
        allSeriesNames.add(series.name);
      });
    });

    allSeriesNames.forEach(name => {
      if (name !== seriesName) {
        this.hideSeriesData(name);
      }
    });
  }

  /**
   * Get list of currently hidden series names
   */
  private getHiddenSeries(): string[] {
    const hiddenSeries: string[] = [];

    this.originalData.forEach(originalOutcome => {
      const currentOutcome = this.chartData.find(outcome => outcome.name === originalOutcome.name);
      if (currentOutcome) {
        originalOutcome.series.forEach(originalSeries => {
          const currentSeries = currentOutcome.series.find(series => series.name === originalSeries.name);
          if (currentSeries && currentSeries.value === 0 && originalSeries.value !== 0) {
            if (!hiddenSeries.includes(originalSeries.name)) {
              hiddenSeries.push(originalSeries.name);
            }
          }
        });
      }
    });

    return hiddenSeries;
  }

  private resolveObject(obj: any): any {
    if (typeof obj !== 'string') {
      return obj;
    }

    try {
      const angularScope = (window as any).angular?.element(document.body).scope()?.$root;
      if (angularScope?.[obj]) {
        return angularScope[obj];
      }

      const element = document.querySelector('f-alignment-bar-chart');
      if (element) {
        const elementScope = (window as any).angular?.element(element).scope();
        if (elementScope?.[obj]) {
          return elementScope[obj];
        }
      }
    } catch (error) {
      // Handle error silently
    }

    return null;
  }

  private transformData(alignmentData: any[]): AlignmentChartData[] {
    if (!alignmentData?.length) {
      return [];
    }

    const outcomesMap = new Map<string, AlignmentChartData>();

    alignmentData.forEach(gradeData => {
      if (!gradeData?.key || !Array.isArray(gradeData.values)) {
        return;
      }

      const gradeName = gradeData.key;

      gradeData.values.forEach(valuePair => {
        if (!valuePair) return;

        const outcomeLabel = this.getOutcomeLabel(valuePair.label);

        if (!outcomesMap.has(outcomeLabel)) {
          outcomesMap.set(outcomeLabel, {
            name: outcomeLabel,
            series: []
          });
        }

        outcomesMap.get(outcomeLabel)?.series.push({
          name: gradeName,
          value: typeof valuePair.value === 'number' ? valuePair.value : 0
        });
      });
    });

    return Array.from(outcomesMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private setupColorScheme(): void {
    try {
      const gradeColors = this.gradeService.gradeColors;
      const gradeAcronyms = this.gradeService.gradeAcronyms;
      const colors = [];

      if (gradeAcronyms && typeof gradeAcronyms === 'object') {
        Object.keys(gradeAcronyms).forEach(key => {
          const acronym = gradeAcronyms[key];
          if (gradeColors && gradeColors[acronym]) {
            colors.push(gradeColors[acronym]);
          }
        });
      }

      if (colors.length > 0) {
        this.colorScheme = { domain: colors };
      } else {
        this.colorScheme = { domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA'] };
      }

      console.log('Setup color scheme:', this.colorScheme);
    } catch (error) {
      console.warn('Error setting up color scheme:', error);
      this.colorScheme = { domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA'] };
    }
  }

  private getOutcomeLabel(label: any): string {
    if (!label) return 'Unknown Outcome';

    if (typeof label === 'string') {
      return label;
    }

    try {
      if (label?.changingThisBreaksApplicationSecurity) {
        return label.changingThisBreaksApplicationSecurity;
      }
    } catch (error) {
      // Handle error silently
    }

    return 'Unknown Outcome';
  }

  private isValidUnit(unit: any): boolean {
    return unit && typeof unit === 'object' && 'id' in unit;
  }

  private isValidSource(source: any): boolean {
    return source && typeof source === 'object' && 'taskOutcomeAlignments' in source;
  }

  private showError(message: string): void {
    this.isLoading = false;
    this.hasError = true;
    this.errorMessage = message;
    this.chartData = [];
    this.cdr.detectChanges();
  }
}
