import {DOCUMENT} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import {DemoModeStore} from '../demo-mode.store';

const BANNER_HEIGHT_PROPERTY = '--ot-demo-banner-height';

@Component({
  selector: 'f-demo-mode-banner',
  templateUrl: './demo-mode-banner.component.html',
  styleUrls: ['./demo-mode-banner.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class DemoModeBannerComponent implements OnDestroy {
  private resizeObserver?: ResizeObserver;

  constructor(
    readonly demoMode: DemoModeStore,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  // Full-height screens size themselves from the viewport minus a fixed header
  // allowance. The banner sits above the header and wraps to several lines on a
  // phone, so it publishes its measured height for those screens to take off too.
  @ViewChild('banner')
  set banner(ref: ElementRef<HTMLElement> | undefined) {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;

    const element = ref?.nativeElement;
    this.publishHeight(element?.offsetHeight ?? 0);
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => this.publishHeight(element.offsetHeight));
    this.resizeObserver.observe(element);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.publishHeight(0);
  }

  exitDemo(): void {
    this.demoMode.setEnabled(false);
  }

  private publishHeight(height: number): void {
    this.document.documentElement.style.setProperty(BANNER_HEIGHT_PROPERTY, `${height}px`);
  }
}
