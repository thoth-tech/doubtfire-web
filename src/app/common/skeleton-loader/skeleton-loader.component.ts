import {NgxSkeletonLoaderModule} from 'ngx-skeleton-loader';
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';

export type SkeletonShape = 'row' | 'card' | 'line' | 'table-row' | 'list-row';

/** Shared presentation for loading collections. Callers own their loading and error states. */
@Component({
  selector: 'f-skeleton-loader',
  standalone: true,
  imports: [NgxSkeletonLoaderModule],
  templateUrl: './skeleton-loader.component.html',
  styleUrl: './skeleton-loader.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class SkeletonLoaderComponent {
  @Input() shape: SkeletonShape = 'row';
  @Input() count = 3;
  @Input() columns = 5;
  @Input() rowHeight = '60px';
  @Input() compact = false;
  @Input() theme: Record<string, string> = {};

  get placeholders(): number[] {
    return this.indices(this.count);
  }

  get tableColumns(): number[] {
    return this.indices(this.columns);
  }

  get placeholderTheme(): Record<string, string> {
    return {
      height: this.shape === 'card' ? '120px' : this.shape === 'line' ? '16px' : '48px',
      width: '100%',
      'border-radius': 'var(--ot-radius-sm)',
      margin: '0',
      ...this.theme,
    };
  }

  private indices(value: number): number[] {
    return Array.from(
      {length: Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0},
      (_unused, index) => index,
    );
  }
}
