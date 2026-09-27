import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {Project} from 'src/app/api/models/project';
import {Unit} from 'src/app/api/models/unit';

@Component({
  selector: 'f-portfolios-project-progress',
  templateUrl: './portfolios-project-progress.component.html',
  styleUrl: './portfolios-project-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class PortfoliosProjectProgressComponent implements OnChanges {
  @Input() project: Project;
  @Input() unit: Unit;
  @Input() taskSelectionUrlBase: unknown[] | null = null;
  @Input() showSubmittedGrade?: boolean = false;

  @Input()
  public project$: BehaviorSubject<Project> = new BehaviorSubject(null);

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  @HostListener('wheel', ['$event'])
  public prioritisePageScroll(event: WheelEvent): void {
    if (event.deltaY === 0 || !(event.target instanceof HTMLElement)) {
      return;
    }

    const projectDashboard = event.target.closest('f-project-dashboard');
    if (!projectDashboard || !this.elementRef.nativeElement.contains(projectDashboard)) {
      return;
    }

    if (event.target.closest('f-unit-task-list')) {
      return;
    }

    const innerScrollContainer = this.findInnerScrollContainer(event.target, projectDashboard);
    if (
      event.deltaY < 0 &&
      innerScrollContainer &&
      this.canScroll(innerScrollContainer, event.deltaY)
    ) {
      return;
    }

    const scrollContainer = this.findOuterScrollContainer(projectDashboard);
    if (!scrollContainer || !this.canScroll(scrollContainer, event.deltaY)) {
      return;
    }

    event.preventDefault();
    scrollContainer.scrollBy({top: event.deltaY});
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.project && this.project) {
      this.project$.next(this.project);
    }
  }

  private findInnerScrollContainer(target: HTMLElement, root: Element): HTMLElement | null {
    let element: HTMLElement | null = target;

    while (element && element !== root) {
      if (this.isScrollable(element)) {
        return element;
      }

      element = element.parentElement;
    }

    return null;
  }

  private findOuterScrollContainer(projectDashboard: Element): HTMLElement {
    let parent = projectDashboard.parentElement;

    while (parent) {
      if (this.isScrollable(parent)) {
        return parent;
      }

      parent = parent.parentElement;
    }

    return document.scrollingElement as HTMLElement;
  }

  private isScrollable(element: HTMLElement): boolean {
    if (element.scrollHeight <= element.clientHeight) {
      return false;
    }

    const overflowY = getComputedStyle(element).overflowY;
    return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
  }

  private canScroll(element: HTMLElement, deltaY: number): boolean {
    if (deltaY > 0) {
      return element.scrollTop + element.clientHeight < element.scrollHeight;
    }

    return element.scrollTop > 0;
  }
}
