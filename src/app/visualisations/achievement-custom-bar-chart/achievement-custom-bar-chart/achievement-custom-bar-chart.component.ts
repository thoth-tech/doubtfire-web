import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  ElementRef,
  NgZone,
} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
import {select, Selection} from 'd3-selection';
import * as d3Scale from 'd3-scale';
import * as d3Axis from 'd3-axis';
import {OutcomeService} from 'src/app/api/services/outcome.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {SafeHtml} from '@angular/platform-browser';

interface Target {
  offset: number;
  height: number;
  color: string;
}

interface AchievementValue {
  label: string;
  value: number;
  targets: Target[];
}

@Component({
  selector: 'f-achievement-custom-bar-chart',
  templateUrl: './achievement-custom-bar-chart.component.html',
  styleUrls: ['./achievement-custom-bar-chart.component.scss'],
})
export class AchievementCustomBarChartComponent implements OnChanges, AfterViewInit {
  @Input() unit: any;
  @Input() project: any;
  @Input() showValues = false;
  @Input() width = 960;
  @Input() height = 600;

  tooltip = {
    visible: false,
    x: 0,
    y: 0,
    content: '' as SafeHtml,
  };

  private overlayHoverIndex: number | null = null;
  private svg!: Selection<SVGSVGElement, unknown, null, undefined>;
  private achievementData: AchievementValue[] = [];
  private maxValue = 0;

  constructor(
    private el: ElementRef,
    private sanitizer: DomSanitizer,
    private outcomeService: OutcomeService,
    private gradeService: GradeService,
    private ngZone: NgZone,
  ) {}

  private resizeObserver?: ResizeObserver;

  ngAfterViewInit() {
    this.updateChartSize();
    this.createSvg();
    this.updateDataAndRender();

    // Responsive: update chart size and re-render on resize
    this.resizeObserver = new ResizeObserver(() => {
      this.updateChartSize();
      this.createSvg();
      this.updateDataAndRender();
    });
    const container = this.el.nativeElement.querySelector('.achievement-chart-container');
    if (container) this.resizeObserver.observe(container);
  }

  ngOnDestroy() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  private updateChartSize() {
    const container = this.el.nativeElement.querySelector('.achievement-chart-container');
    if (container) {
      this.width = container.offsetWidth;
      this.height = container.offsetHeight;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.unit || changes.project) {
      this.updateDataAndRender();
    }
  }

  private createSvg() {
    const svgElement = this.el.nativeElement.querySelector('svg') as SVGSVGElement;
    this.svg = select<SVGSVGElement, unknown>(svgElement)
      .attr('width', this.width)
      .attr('height', this.height);
  }

  private updateDataAndRender() {
    if (!this.unit || !this.project) return;
    const targets = this.outcomeService.calculateTargets(
      this.unit,
      this.unit,
      this.unit.taskStatusFactor,
    );
    const currentProgress = this.outcomeService.calculateProgress(this.unit, this.project);
    this.achievementData = [];
    this.maxValue = 0;
    for (const ilo of this.unit.ilos) {
      const iloTargets: Target[] = [
        {offset: 0, height: targets[ilo.id][0], color: this.gradeService.gradeColors.P},
        {
          offset: targets[ilo.id][0],
          height: targets[ilo.id][1],
          color: this.gradeService.gradeColors.C,
        },
        {
          offset: targets[ilo.id][0] + targets[ilo.id][1],
          height: targets[ilo.id][2],
          color: this.gradeService.gradeColors.D,
        },
        {
          offset: targets[ilo.id][0] + targets[ilo.id][1] + targets[ilo.id][2],
          height: targets[ilo.id][3],
          color: this.gradeService.gradeColors.HD,
        },
      ];
      const lastOffset = iloTargets[3].offset + iloTargets[3].height;
      if (lastOffset > this.maxValue) this.maxValue = lastOffset;
      this.achievementData.push({
        label: this.sanitizer.sanitize(1, ilo.name) || ilo.name,
        value: currentProgress[0][ilo.id],
        targets: iloTargets,
      });
    }
    this.renderChart();
  }

  private renderChart() {
    if (!this.achievementData || this.achievementData.length === 0) return;
    const margin = {top: 20, right: 20, bottom: 50, left: 60};
    const w = this.width - margin.left - margin.right;
    const h = this.height - margin.top - margin.bottom;
    this.svg.selectAll('*').remove();
    const chart = this.svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = d3Scale
      .scaleBand()
      .domain(this.achievementData.map((d) => d.label))
      .range([0, w])
      .padding(0.2);
    const y = d3Scale.scaleLinear().domain([0, this.maxValue]).range([h, 0]);

    // Draw stacked target bars with tooltip
    const groups = chart
      .selectAll('g.target-group')
      .data(this.achievementData)
      .enter()
      .append('g')
      .attr('class', 'target-group')
      .attr('transform', (d) => `translate(${x(d.label)},0)`);

    groups.each((d, i, nodes) => {
      d.targets.forEach((t, idx) => {
        select(nodes[i])
          .append('rect')
          .attr('y', y(t.offset + t.height))
          .attr('height', y(t.offset) - y(t.offset + t.height))
          .attr('width', x.bandwidth())
          .attr('fill', t.color)
          .attr('opacity', 0.2)
          .style('pointer-events', 'all')
          .on('mouseenter', (event) => {
            const gradeLabels = ['Pass', 'Credit', 'Distinction', 'High Distinction'];
            this.showTargetTooltip(event, gradeLabels[idx], t.color);
          })
          .on('mousemove', (event) => {
            const gradeLabels = ['Pass', 'Credit', 'Distinction', 'High Distinction'];
            this.showTargetTooltip(event, gradeLabels[idx], t.color);
          })
          .on('mouseleave', () => this.hideTooltip());
      });
    });

    groups
      .append('rect')
      .attr('y', (d) => y(d.value))
      .attr('height', (d) => h - y(d.value))
      .attr('width', x.bandwidth() * 0.5)
      .attr('fill', '#373737')
      .attr('x', x.bandwidth() * 0.25)
      .attr('opacity', 0.5) // always start at 0.5
      .style('transition', 'opacity 0.5s')
      .style('pointer-events', 'all')
      .on('mouseenter', (event, d) => {
        select(event.target).attr('opacity', 1);
        this.showProgressTooltip(event, d.label, '#373737');
      })
      .on('mousemove', (event, d) => {
        this.showProgressTooltip(event, d.label, '#373737');
      })
      .on('mouseleave', (event, d) => {
        select(event.target).attr('opacity', 0.5);
        this.hideTooltip();
      });

    // Optional value labels
    if (this.showValues) {
      groups
        .append('text')
        .text((d) => d.value)
        .attr('x', x.bandwidth() / 2)
        .attr('y', (d) => y(d.value) - 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px');
    }
    chart
      .append('g')
      .attr('transform', `translate(0,${h})`)
      .call(d3Axis.axisBottom(x))
      .selectAll('text')
      .style('font-size', '16px');
  }

  showTargetTooltip(event: MouseEvent, grade: string, color: string) {
    const containerRect = this.el.nativeElement
      .querySelector('.achievement-chart-container')
      .getBoundingClientRect();
    this.ngZone.run(() => {
      // <-- wrap in NgZone.run
      this.tooltip.content = this.sanitizer.bypassSecurityTrustHtml(
        `<span style="display:inline-block;width:12px;height:12px;background:${color};border-radius:2px;margin-right:8px;vertical-align:middle;"></span><span>${grade} task range</span>`,
      );
      this.tooltip.x = event.clientX - containerRect.left + 20;
      this.tooltip.y = event.clientY - containerRect.top - 10;
      this.tooltip.visible = true;
    });
  }

  showProgressTooltip(event: MouseEvent, iloName: string, color: string) {
    const containerRect = this.el.nativeElement
      .querySelector('.achievement-chart-container')
      .getBoundingClientRect();
    this.ngZone.run(() => {
      // <-- wrap in NgZone.run
      this.tooltip.content = this.sanitizer.bypassSecurityTrustHtml(
        `<span style="display:inline-block;width:12px;height:12px;background:${color};border-radius:2px;margin-right:8px;vertical-align:middle;"></span><span>Your progress with ${iloName}</span>`,
      );
      this.tooltip.x = event.clientX - containerRect.left + 20;
      this.tooltip.y = event.clientY - containerRect.top - 10;
      this.tooltip.visible = true;
    });
  }

  hideTooltip() {
    this.ngZone.run(() => {
      // <-- wrap in NgZone.run
      this.tooltip.visible = false;
    });
  }
}
