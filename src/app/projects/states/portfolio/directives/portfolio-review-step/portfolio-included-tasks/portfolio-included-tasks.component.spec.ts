import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {Subject} from 'rxjs';
import {Project} from 'src/app/api/models/project';
import {Task} from 'src/app/api/models/task';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {Unit} from 'src/app/api/models/unit';
import {AlertService} from 'src/app/common/services/alert.service';
import {SkeletonLoaderComponent} from 'src/app/common/skeleton-loader/skeleton-loader.component';
import {PortfolioIncludedTasksComponent} from './portfolio-included-tasks.component';

describe('PortfolioIncludedTasksComponent', () => {
  let component: PortfolioIncludedTasksComponent;
  let fixture: ComponentFixture<PortfolioIncludedTasksComponent>;
  let includedTasks: Subject<number[]>;
  let processingTasks: Subject<number[]>;

  const unit = new Unit();
  unit.id = 1;

  const buildTask = (id: number): Task => {
    const definition = new TaskDefinition(unit);
    definition.id = id;
    definition.abbreviation = `${id}.1P`;
    definition.name = `Task ${id}`;
    const task = new Task(unit);
    task.id = id;
    task.definition = definition;
    task.status = 'not_started';
    return task;
  };

  const buildProject = (tasks: Task[]): Project => {
    const project = new Project(unit);
    tasks.forEach((task) => project.taskCache.add(task));
    project.getTasksIncludedInPortfolio = vi.fn().mockReturnValue(includedTasks);
    project.getTasksStillProcessing = vi.fn().mockReturnValue(processingTasks);
    return project;
  };

  const skeleton = (): SkeletonLoaderComponent | null =>
    fixture.debugElement.query(By.css('f-skeleton-loader'))?.componentInstance ?? null;

  beforeEach(async () => {
    includedTasks = new Subject<number[]>();
    processingTasks = new Subject<number[]>();

    await TestBed.configureTestingModule({
      declarations: [PortfolioIncludedTasksComponent],
      imports: [SkeletonLoaderComponent],
      providers: [{provide: AlertService, useValue: {error: vi.fn()}}],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PortfolioIncludedTasksComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a 4-row skeleton while the included tasks are still loading', () => {
    component.project = buildProject([buildTask(1)]);
    fixture.detectChanges();

    const loader = skeleton();
    expect(loader).not.toBeNull();
    expect(loader.count).toBe(4);
    expect(loader.shape).toBe('row');
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'Loading tasks',
    );
  });

  // Discriminating: this fails if the skeleton were left on screen once the
  // tasks have actually arrived, which is exactly the bug a hard-coded
  // "always show the skeleton" edit would introduce.
  it('replaces the skeleton with the task list once loading finishes', () => {
    component.project = buildProject([buildTask(1)]);
    fixture.detectChanges();
    expect(skeleton()).not.toBeNull();

    includedTasks.next([1]);
    processingTasks.next([]);
    fixture.detectChanges();

    expect(skeleton()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Task 1');
  });

  it('does not show the skeleton once loading has finished with nothing included', () => {
    component.project = buildProject([]);
    fixture.detectChanges();

    includedTasks.next([]);
    processingTasks.next([]);
    fixture.detectChanges();

    expect(skeleton()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No tasks found');
  });
});
