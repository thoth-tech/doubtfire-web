import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {BehaviorSubject, Observable} from 'rxjs';
import {of} from 'rxjs';
import {TaskDefinition, Unit} from 'src/app/api/models/doubtfire-model';

@Component({
  selector: 'f-task-viewer-state',
  templateUrl: './task-viewer-state.component.html',
  styleUrl: './task-viewer-state.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TaskViewerStateComponent {
  @Input() public unit$: Observable<Unit>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.unit$ = of(this.route.parent.snapshot.data.unit);

    // The task abbreviation is deliberately not read here. This component is
    // reused when only the route parameter changes, so a snapshot read runs once
    // and leaves the first task selected for the life of the screen. The child
    // task list follows route.paramMap instead, and it is the one component
    // shared by all three routes that carry a :taskAbbreviation, so the read
    // belongs there and only there.
  }

  /**
   * Monitor and publish the selected task definition for child components.
   * We monitor the task definition list for changes in selected task definition.
   */
  selectedTaskDefinition$: BehaviorSubject<TaskDefinition> = new BehaviorSubject<TaskDefinition>(
    null,
  );

  public get taskSelected(): boolean {
    return this.selectedTaskDef !== null;
  }

  public get selectedTaskDef(): TaskDefinition {
    return this.selectedTaskDefinition$.value;
  }

  public clearTaskSelection(): void {
    this.selectedTaskDefinition$.next(null);
    if (this.route.parent?.snapshot.data.unit) {
      this.router.navigate(['../tasks'], {relativeTo: this.route, replaceUrl: true});
      return;
    }
  }
}
