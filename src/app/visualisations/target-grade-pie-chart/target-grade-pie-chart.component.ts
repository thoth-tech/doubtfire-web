import {ChangeDetectionStrategy, Component, Input, OnChanges, effect} from '@angular/core';
import {Unit} from 'src/app/api/models/unit';
import {TargetGradeStat} from 'src/app/api/services/unit.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {ThemeColorService} from 'src/app/common/theme/theme-color.service';

// Slices are marks on the card, so each grade takes a chart token that clears 3:1 on
// the surface in both themes. The hues follow the legacy grade colours: grey, red,
// orange, blue and green. ngx-charts needs a real colour, so these are resolved, and
// the legacy colour is only the fallback when no stylesheet is loaded.
const GRADE_COLOUR_TOKENS: Record<number, string> = {
  [-1]: '--ot-color-text-muted',
  0: '--ot-chart-4',
  1: '--ot-chart-6',
  2: '--ot-chart-2',
  3: '--ot-chart-3',
};
const UNKNOWN_GRADE_TOKEN = '--ot-color-text-muted';

@Component({
  selector: 'f-target-grade-pie-chart',
  templateUrl: './target-grade-pie-chart.component.html',
  styleUrls: ['../unit-analytics-chart.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TargetGradePieChartComponent implements OnChanges {
  @Input() unit: Unit;
  @Input() data: TargetGradeStat[] = [];
  @Input() tutorialId: number | null = null;
  series: {name: string; value: number}[] = [];
  colors: {name: string; value: string}[] = [];
  total = 0;
  private shownGrades: number[] = [];

  constructor(
    private grades: GradeService,
    private themeColor: ThemeColorService,
  ) {
    // Re-resolve the slice colours when the theme flips while the chart is on screen.
    effect(() => {
      this.themeColor.resolved();
      this.colors = this.sliceColors();
    });
  }

  ngOnChanges(): void {
    const counts: Map<number, number> = new Map();
    (this.data ?? []).forEach(({tutorial_id, grade, num}) => {
      if (
        (this.tutorialId === null || tutorial_id === this.tutorialId) &&
        Number.isFinite(num) &&
        num > 0
      ) {
        counts.set(grade, (counts.get(grade) ?? 0) + num);
      }
    });
    this.series = Array.from(counts)
      .sort(([a], [b]) => a - b)
      .map(([grade, value]) => ({
        name: this.gradeName(grade),
        value,
      }));
    this.shownGrades = Array.from(counts.keys());
    this.colors = this.sliceColors();
    this.total = this.series.reduce((sum, row) => sum + row.value, 0);
  }

  percentage(value: number): number {
    return this.total ? Math.round((value / this.total) * 100) : 0;
  }

  private gradeName(grade: number): string {
    return this.grades.gradeLabel(grade, this.unit) ?? `Grade ${grade}`;
  }

  private sliceColors(): {name: string; value: string}[] {
    return this.shownGrades.map((grade) => ({
      name: this.gradeName(grade),
      value: this.themeColor.token(
        GRADE_COLOUR_TOKENS[grade] ?? UNKNOWN_GRADE_TOKEN,
        this.grades.gradeColors[grade] ?? this.grades.gradeColors[-1],
      ),
    }));
  }
}
