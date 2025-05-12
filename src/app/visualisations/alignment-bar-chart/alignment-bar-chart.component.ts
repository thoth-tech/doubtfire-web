import { Component, OnInit, Input, SimpleChanges, ChangeDetectorRef, HostListener, ElementRef, AfterViewInit, OnChanges } from '@angular/core';
import { ChartBaseComponent } from 'src/app/common/chart-base/chart-base-component/chart-base-component.component';
import { GradeService } from 'src/app/api/models/doubtfire-model';
import { OutcomeService } from 'src/app/common/services/outcome-service';

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
export class AlignmentBarChartComponent extends ChartBaseComponent implements OnInit, AfterViewInit, OnChanges {
  @Input() project: any;
  @Input() unit: any;
  @Input() source: any;
  @Input() taskStatusFactor: any;

  chartData: AlignmentChartData[] = [];
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
  tooltipDisabled = true;
  yAxisTicks = [];

  constructor(
    private gradeService: GradeService,
    private outcomeService: OutcomeService,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef
  ) {
    super(null);
    this.setupColorScheme();
  }

  ngOnInit(): void {
    this.updateChartSize();
    setTimeout(() => this.updateData(), 0);
  }

  ngAfterViewInit(): void {
    this.updateChartSize();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateChartSize();
  }

  /**
   * Update chart size based on container width
   */
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

  /**
   * Set the chart type based on radio selection
   */
  setChartType(isStacked: boolean): void {
    this.stacked = isStacked;
    this.cdr.detectChanges();
  }

  /**
   * Update chart data from the unit and source
   */
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

      // Since targetsByGrade returns an array directly, not an Observable
      const alignmentData = this.outcomeService.targetsByGrade(actualUnit, actualSource);
      this.chartData = this.transformData(alignmentData);
      this.isLoading = false;
      this.updateChartSize();
      this.cdr.detectChanges();
    } catch (error) {
      this.showError('An error occurred while updating the chart');
    }
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

  /**
   * Transform data for chart visualization
   */
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

      Object.keys(gradeAcronyms).forEach(key => {
        colors.push(gradeColors[gradeAcronyms[key]]);
      });

      this.colorScheme = { domain: colors };
    } catch (error) {
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
