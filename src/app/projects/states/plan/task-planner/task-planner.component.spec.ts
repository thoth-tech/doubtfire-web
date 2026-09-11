import {GanttPrintService} from '@worktile/gantt';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {CommonModule} from '@angular/common';
import {EmbeddedViewRef, NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, Router} from '@angular/router';
import {EMPTY} from 'rxjs';
import {Project, TaskDefinition} from 'src/app/api/models/doubtfire-model';
import {TaskPrerequisiteService} from 'src/app/api/services/task-prerequisite.service';
import {ConfirmationModalService} from 'src/app/common/modals/confirmation-modal/confirmation-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {TaskPlannerPrerequisitesModalService} from './task-planner-prerequisites-modal/task-planner-prerequisites-modal.service';
import {TaskPlannerComponent} from './task-planner.component';

const taskDefinition = (id: number, targetGrade: number): TaskDefinition =>
  ({
    id,
    targetGrade,
    startDate: new Date(2026, 0, id),
  }) as TaskDefinition;

describe('TaskPlannerComponent target-grade filtering', () => {
  it('shows tasks beyond the target grade only when the student opts in', () => {
    const passTask = taskDefinition(1, 0);
    const creditTask = taskDefinition(2, 1);
    const component = Object.create(TaskPlannerComponent.prototype) as TaskPlannerComponent;
    component.project = {
      unit: {taskDefinitions: [passTask, creditTask]},
      findTaskForDefinition: () => null,
    } as unknown as Project;
    component.targetGrade = 0;
    component.showTasksAboveTargetGrade = false;

    expect(component.taskDefs()).toEqual([passTask]);

    component.showTasksAboveTargetGrade = true;

    expect(component.taskDefs()).toEqual([passTask, creditTask]);
  });

  it('reveals an above-target task requested by a direct planner link', () => {
    const passTask = taskDefinition(1, 0);
    const creditTask = taskDefinition(2, 1);
    const component = Object.create(TaskPlannerComponent.prototype) as TaskPlannerComponent;
    component.project = {
      id: 15,
      unit: {taskDefinitions: [passTask, creditTask]},
      findTaskForDefinition: () => null,
    } as unknown as Project;
    component.targetGrade = 0;
    component.showTasksAboveTargetGrade = false;

    const plannerInternals = component as unknown as {
      revealRequestedTaskDefinition(taskDefinitionId: string | null): void;
    };
    plannerInternals.revealRequestedTaskDefinition('2');

    expect(component.showTasksAboveTargetGrade).toBe(true);
    expect(component.taskDefs()).toEqual([passTask, creditTask]);
  });
});

const emptyProvider = {};

/** Records what barClick asks the modal to open, so the keyboard path can be checked. */
class RecordingPrerequisitesModal {
  public shown: unknown[][] = [];

  public show(...args: unknown[]) {
    this.shown.push(args);
  }
}

/**
 * Two tasks where the second depends on the first, which is the shape the planner
 * highlights when a bar is hovered or focused.
 */
function twoLinkedItems() {
  return [
    {
      id: 'a',
      links: [{link: 'b', color: {active: 'rgba(0,0,0,1)', default: 'rgba(0,0,0,1)'}}],
    },
    {
      id: 'b',
      links: [],
    },
  ];
}

describe('TaskPlannerComponent', () => {
  let component: TaskPlannerComponent;
  let fixture: ComponentFixture<TaskPlannerComponent>;
  let prerequisitesModal: RecordingPrerequisitesModal;

  beforeEach(async () => {
    prerequisitesModal = new RecordingPrerequisitesModal();

    await TestBed.configureTestingModule({
      declarations: [TaskPlannerComponent],
      providers: [
        {provide: GradeService, useValue: emptyProvider},
        {provide: AlertService, useValue: emptyProvider},
        {provide: ConfirmationModalService, useValue: emptyProvider},
        {provide: TaskPlannerPrerequisitesModalService, useValue: prerequisitesModal},
        {provide: TaskPrerequisiteService, useValue: emptyProvider},
        {provide: Router, useValue: emptyProvider},
        {provide: ActivatedRoute, useValue: emptyProvider},
        {provide: GanttPrintService, useValue: emptyProvider},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(TaskPlannerComponent, {set: {template: '', providers: []}})
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TaskPlannerComponent);
    component = fixture.componentInstance;
    component.items = twoLinkedItems() as never;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('prerequisite highlighting', () => {
    it('lights up the dependency links when the pointer is over a bar', () => {
      component.onBarLeave(component.items[0]);
      component.onBarHover(component.items[0]);

      expect(component.overlayLines).toBe(true);
      expect(component.items[0].links[0]).toMatchObject({color: {default: 'rgba(0,0,0,1)'}});
    });

    it('lights up the same links when a bar takes keyboard focus', () => {
      component.onBarLeave(component.items[0]);
      const dimmed = structuredClone(component.items[0].links[0]);

      // The template binds (focus) to onBarHover, the same handler as (mouseover).
      component.onBarHover(component.items[0]);

      expect(component.overlayLines).toBe(true);
      expect(component.items[0].links[0]).not.toMatchObject(dimmed as object);
    });

    it('does not apply the highlight twice when hover and focus both fire', () => {
      component.onBarHover(component.items[0]);
      const afterFirst = structuredClone(component.items[0].links[0]);

      component.onBarHover(component.items[0]);

      expect(component.items[0].links[0]).toMatchObject(afterFirst as object);
    });

    it('does not dim twice when blur and mouseleave both fire', () => {
      component.onBarLeave(component.items[0]);
      const afterFirst = structuredClone(component.items[0].links[0]);

      component.onBarLeave(component.items[0]);

      expect(component.items[0].links[0]).toMatchObject(afterFirst as object);
      expect(component.overlayLines).toBe(false);
    });
  });

  describe('keyboard activation', () => {
    beforeEach(() => {
      component.taskPrerequisites = [];
      component.items[0].taskDefinition = {id: 1} as never;
    });

    it('opens the prerequisites modal from a key press, the way a click does', () => {
      const event = new KeyboardEvent('keydown', {key: 'Enter'});

      component.onBarKeydown(event, component.items[0]);

      expect(prerequisitesModal.shown.length).toBe(1);
      expect(prerequisitesModal.shown[0][1]).toBe(component.items[0].taskDefinition);
    });

    it('swallows the key press so space does not scroll the planner', () => {
      const event = new KeyboardEvent('keydown', {cancelable: true, key: ' '});

      component.onBarKeydown(event, component.items[0]);

      expect(event.defaultPrevented).toBe(true);
    });
  });
});

function plannerItem(id: string) {
  const day = 24 * 60 * 60;
  const start = Math.floor(Date.UTC(2026, 0, 5) / 1000);

  return {
    id,
    title: `Task ${id}`,
    start,
    end: start + day,
    links: [] as {link: string; color: {active: string; default: string}}[],
    taskDefinition: {id: 1, targetGrade: 0},
    task: {
      status: 'not_started',
      startDate: new Date(start * 1000),
      localDueDate: () => new Date((start + day) * 1000),
      localDeadlineDate: () => new Date((start + 30 * day) * 1000),
    },
  };
}

/**
 * Renders the real #bar template out of the real component template, rather than a copy of
 * the markup pasted into the spec. ngx-gantt normally stamps that template, but it sizes the
 * chart from real layout and so draws no bars under jsdom, which is why the template is
 * stamped directly here. Deleting role, tabindex or either keydown binding from
 * task-planner.component.html fails these tests.
 */
describe('TaskPlannerComponent gantt bar keyboard access', () => {
  let fixture: ComponentFixture<TaskPlannerComponent>;
  let component: TaskPlannerComponent;
  let prerequisitesModal: RecordingPrerequisitesModal;
  let view: EmbeddedViewRef<{item: unknown}>;
  let bar: HTMLElement;

  function stampBar(item: unknown) {
    view = component.barTemplate.createEmbeddedView({item} as never);
    view.detectChanges();

    const rendered = view.rootNodes.find(
      (node: Node): node is HTMLElement =>
        node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).matches('span.gantt-bar'),
    );

    if (!rendered) {
      throw new Error('the gantt bar did not render from the #bar template');
    }

    // Events only reach Angular's listeners once the node is in a document.
    document.body.appendChild(rendered);
    return rendered;
  }

  beforeEach(async () => {
    prerequisitesModal = new RecordingPrerequisitesModal();

    await TestBed.configureTestingModule({
      declarations: [TaskPlannerComponent],
      imports: [CommonModule],
      providers: [
        {provide: GradeService, useValue: emptyProvider},
        {provide: AlertService, useValue: emptyProvider},
        {provide: ConfirmationModalService, useValue: emptyProvider},
        {provide: TaskPlannerPrerequisitesModalService, useValue: prerequisitesModal},
        {provide: TaskPrerequisiteService, useValue: emptyProvider},
        {provide: Router, useValue: emptyProvider},
        {provide: ActivatedRoute, useValue: emptyProvider},
        {provide: GanttPrintService, useValue: emptyProvider},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskPlannerComponent);
    component = fixture.componentInstance;
    component.project = {
      id: 1,
      unit: {
        allowFlexibleDates: false,
        taskDefinitions: [],
        gradeDefinitions: [],
        getTaskPrerequisites: () => EMPTY,
      },
      findTaskForDefinition: () => null,
    } as never;
    component.targetGrade = 0;
    component.taskPrerequisites = [];
    component.items = [plannerItem('a')] as never;

    fixture.detectChanges();
    bar = stampBar(component.items[0]);
  });

  afterEach(() => {
    bar?.remove();
    view?.destroy();
  });

  it('gives the bar a role and a tab stop, so a keyboard can reach it', () => {
    expect(bar.getAttribute('role')).toBe('button');
    expect(bar.getAttribute('tabindex')).toBe('0');
  });

  it('opens the prerequisites modal when Enter is pressed on the bar', () => {
    bar.dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, key: 'Enter'}));

    expect(prerequisitesModal.shown.length).toBe(1);
    expect(prerequisitesModal.shown[0][1]).toBe(component.items[0].taskDefinition);
  });

  it('opens the prerequisites modal on Space, and swallows the page scroll', () => {
    const event = new KeyboardEvent('keydown', {bubbles: true, cancelable: true, key: ' '});

    bar.dispatchEvent(event);

    expect(prerequisitesModal.shown.length).toBe(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('lights the dependency links on focus, the way it does on hover', () => {
    const linked = plannerItem('a');
    linked.links = [{link: 'b', color: {active: 'rgba(0,0,0,1)', default: 'rgba(0,0,0,1)'}}];
    component.items = [linked, plannerItem('b')] as never;

    bar.remove();
    view.destroy();
    bar = stampBar(component.items[0]);

    component.onBarLeave(component.items[0]);
    expect(component.overlayLines).toBe(false);

    bar.dispatchEvent(new FocusEvent('focus'));

    expect(component.overlayLines).toBe(true);
  });
});
