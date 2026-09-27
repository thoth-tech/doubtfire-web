import {
  GanttConfigService,
  GanttPrintService,
  GanttViewType,
  NgxGanttTableComponent,
} from '@worktile/gantt';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CommonModule} from '@angular/common';
import {EmbeddedViewRef, NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
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

describe('TaskPlannerComponent bar states', () => {
  const planner = (status: string, targetGrade = 0) => {
    const component = Object.create(TaskPlannerComponent.prototype) as TaskPlannerComponent;
    component.targetGrade = 0;
    const item = {
      taskDefinition: {targetGrade},
      task: {status},
    } as never;
    return {component, item};
  };

  it('shows a complete task as done instead of a deadline warning', () => {
    const {component, item} = planner('complete');
    // Even past its feedback deadline, a finished task has nothing left to warn about.
    component.isPastFeedbackDeadline = () => true;

    expect(component.getItemClasses(item)).toContain('[--bar-bg:var(--ot-status-complete)]');
  });

  it('keeps the deadline warning on a task that is still open', () => {
    const {component, item} = planner('working_on_it');
    component.isPastFeedbackDeadline = () => true;

    expect(component.getItemClasses(item)).toContain('[--bar-bg:var(--ot-status-time-exceeded)]');
  });

  it('sizes the chart from its row count', () => {
    const {component} = planner('not_started');
    component.items = [{}, {}, {}] as never;

    // 52px date header, three 44px rows and room for the timeline scrollbar.
    expect(component.ganttHeight).toBe(52 + 3 * 44 + 18);
  });
});

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

  it('rebuilds the visible planner data when the beyond-target toggle changes', () => {
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
    const refreshItems = vi.spyOn(component, 'refreshItems').mockImplementation(() => undefined);

    component.setShowTasksAboveTargetGrade(true);

    expect(component.taskDefs()).toEqual([passTask, creditTask]);
    expect(refreshItems).toHaveBeenCalledWith(false);
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

describe('TaskPlannerComponent chart download', () => {
  it('holds the chart at full size while it is captured and restores it after', async () => {
    const ganttEl = document.createElement('div');
    ganttEl.style.flex = '1 1 auto';
    const side = document.createElement('div');
    side.className = 'gantt-side';
    const mainContainer = document.createElement('div');
    mainContainer.className = 'gantt-main-container';
    // jsdom has no element scrolling.
    mainContainer.scrollTo = () => undefined;
    ganttEl.append(side, mainContainer);

    let flexDuringCapture = '';
    const component = Object.create(TaskPlannerComponent.prototype) as TaskPlannerComponent;
    Object.defineProperty(component, 'unit', {value: {code: 'SIT101'}});
    Object.assign(component, {
      ganttComponent: {element: ganttEl, view: {width: 400}},
      ganttPrintService: {
        html2canvas: async () => {
          flexDuringCapture = ganttEl.style.flex;
          return document.createElement('canvas');
        },
      },
      alertService: {error: () => undefined},
      renderAllGanttBars: async () => undefined,
      waitForStableLayout: async () => undefined,
      nextAnimationFrame: async () => undefined,
      downloadCanvas: () => undefined,
    });

    await component.saveImage();

    expect(flexDuringCapture).toBe('0 0 auto');
    expect(ganttEl.style.flex).toBe('1 1 auto');
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
    taskDefinition: {id: 1, abbreviation: 'A1', name: 'Assignment 1', targetGrade: 0},
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
      imports: [CommonModule, NgxGanttTableComponent],
      providers: [
        {
          provide: GradeService,
          useValue: {
            gradeLabel: () => 'Pass',
            gradeValuesFor: () => [0],
          },
        },
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
        taskDefinitions: [{id: 1, abbreviation: 'A1', name: 'Assignment 1', targetGrade: 0}],
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

  // The token sheets are not loaded under jsdom, so contrast is checked by pairing: each
  // fill must carry the text token designed for it, whose ratio is set with the tokens.
  it.each([
    {state: 'highlighted', background: '--ot-color-info', foreground: '--ot-color-inverse-text'},
    {
      state: 'above-target',
      background: '--ot-color-disabled-surface',
      foreground: '--ot-color-text-muted',
    },
    {state: 'complete', background: '--ot-status-complete', foreground: '--ot-status-complete-on'},
    {
      state: 'past-deadline',
      background: '--ot-status-time-exceeded',
      foreground: '--ot-status-time-exceeded-on',
    },
    {
      state: 'blocked',
      background: '--ot-status-attention-required',
      foreground: '--ot-status-attention-required-on',
    },
    {
      state: 'close-deadline',
      background: '--ot-status-fix-and-resubmit',
      foreground: '--ot-status-fix-and-resubmit-on',
    },
    {state: 'normal', background: '--ot-color-primary', foreground: '--ot-color-on-primary'},
  ])('renders one contrasting foreground for $state bars', ({state, background, foreground}) => {
    const item = Object.assign(plannerItem('contrast'), {highlighted: state === 'highlighted'});
    vi.spyOn(component, 'isAboveTargetGrade').mockReturnValue(state === 'above-target');
    vi.spyOn(component, 'isComplete').mockReturnValue(state === 'complete');
    vi.spyOn(component, 'isPastFeedbackDeadline').mockReturnValue(state === 'past-deadline');
    vi.spyOn(component, 'isBlockedByPrerequisite').mockReturnValue(state === 'blocked');
    vi.spyOn(component, 'isCloseToFeedbackDeadline').mockReturnValue(state === 'close-deadline');
    component.items = [item] as never;
    bar.remove();
    view.destroy();
    bar = stampBar(item);

    const classes = [...bar.classList];
    expect(classes.filter((name) => name.startsWith('[--bar-bg:'))).toEqual([
      `[--bar-bg:var(${background})]`,
    ]);
    // A fixed text colour on the template would fight the per-state one, so only a
    // single colour class may be present.
    expect(
      classes.filter((name) => name.startsWith('[color:') || /^text-(black|white|ot-)/.test(name)),
    ).toEqual([`[color:var(${foreground})]`]);
  });

  it('uses English labels and date formats for every Gantt view', () => {
    const config = fixture.debugElement.injector.get(GanttConfigService);
    const views = config.getViewsLocale();
    expect(views[GanttViewType.hour].label).toBe('Hourly');
    expect(views[GanttViewType.day].label).toBe('Daily');
    expect(views[GanttViewType.week].label).toBe('Weekly');
    expect(views[GanttViewType.month].label).toBe('Monthly');
    expect(views[GanttViewType.quarter].label).toBe('Quarterly');
    expect(views[GanttViewType.year].label).toBe('Yearly');
    expect(views[GanttViewType.day].tickFormats.period).toBe('MMM yyyy');
    expect(JSON.stringify(views)).not.toMatch(/[\u3400-\u9fff]/);
  });

  it('supplies the real Gantt empty slot with an English target-grade explanation', () => {
    const table = fixture.debugElement.query(By.directive(NgxGanttTableComponent))
      .componentInstance as NgxGanttTableComponent;
    const emptyTemplate = table.tableEmptyTemplate();
    expect(emptyTemplate).toBeDefined();
    const emptyView = emptyTemplate.createEmbeddedView({});
    emptyView.detectChanges();
    const content = emptyView.rootNodes.map((node: Node) => node.textContent).join(' ');
    expect(content).toContain('No tasks to show for this target grade.');
    expect(content).not.toMatch(/[\u3400-\u9fff]/);
    emptyView.destroy();
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

  it('keeps a phone-first task card alongside the richer desktop timeline', () => {
    component.showDatesColumn = true;
    fixture.detectChanges();

    const mobileCard: HTMLElement = fixture.nativeElement.querySelector('.mobile-task-card');
    const desktopPlanner: HTMLElement = fixture.nativeElement.querySelector('.desktop-planner');
    const text = mobileCard.textContent.replace(/\s+/g, ' ').trim();

    expect(mobileCard).not.toBeNull();
    expect(desktopPlanner).not.toBeNull();
    expect(text).toContain('Pass task');
    expect(text).toContain('A1 Assignment 1');
    expect(text).toContain('Not Started');
    expect(text).toContain('Start date');
    expect(text).toContain('Target / due date');
    expect(text).toContain('Deadline');
    expect(text).toContain('No prerequisite or dependent tasks');
  });

  it('shows a compact date range when task-date detail is off and labelled dates when it is on', () => {
    component.showDatesColumn = false;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.mobile-task-card__date-summary')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.mobile-task-card__dates')).toBeNull();

    component.showDatesColumn = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.mobile-task-card__dates dt').length).toBe(3);
  });

  it('summarises both directions and opens the full task-connections view', () => {
    const prerequisiteDefinition = {
      id: 2,
      abbreviation: 'P1',
      name: 'Prerequisite',
      targetGrade: 0,
    };
    const dependentDefinition = {
      id: 3,
      abbreviation: 'D1',
      name: 'Dependent',
      targetGrade: 0,
    };
    const mutableUnit = component.project.unit as unknown as {
      taskDefinitions: TaskDefinition[];
    };
    mutableUnit.taskDefinitions = [
      component.items[0].taskDefinition,
      prerequisiteDefinition,
      dependentDefinition,
    ] as never;
    component.taskPrerequisites = [
      {
        id: 1,
        taskDefinitionId: 1,
        prerequisiteId: 2,
        prerequisite: prerequisiteDefinition,
      },
      {
        id: 2,
        taskDefinitionId: 3,
        prerequisiteId: 1,
        taskDefinition: dependentDefinition,
      },
    ] as never;
    fixture.detectChanges();

    const connections: HTMLElement = fixture.nativeElement.querySelector(
      '.mobile-task-card__connections',
    );
    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label^="View prerequisites"]',
    );

    expect(connections.textContent).toContain('1 prerequisite; 1 dependent');
    button.click();
    expect(prerequisitesModal.shown.length).toBe(1);
    expect(prerequisitesModal.shown[0][1]).toBe(component.items[0].taskDefinition);
  });
});

describe('TaskPlannerComponent ink-safe image export', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([false, true])('restores the screen after export (capture fails: %s)', async (fails) => {
    const component = Object.create(TaskPlannerComponent.prototype) as TaskPlannerComponent;
    const root = document.createElement('ngx-gantt');
    root.style.cssText = 'width: 640px; height: 400px; overflow: hidden;';
    root.innerHTML = '<div class="gantt-side"></div><div class="gantt-main-container"></div>';
    const scroll = root.querySelector<HTMLElement>('.gantt-main-container')!;
    scroll.scrollLeft = 31;
    scroll.scrollTop = 47;
    scroll.scrollTo = vi.fn((left: number, top: number) => {
      scroll.scrollLeft = left;
      scroll.scrollTop = top;
    }) as unknown as typeof scroll.scrollTo;
    const windowScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const rootTheme = document.documentElement.getAttribute('data-ot-theme');
    const savedTheme = localStorage.getItem('ontrack.theme.preference');
    const download = vi.fn();
    const reportError = vi.fn();
    const capture = vi.fn(async () => {
      expect(root.classList.contains('ot-gantt-export')).toBe(true);
      expect(document.documentElement.getAttribute('data-ot-theme')).toBe(rootTheme);
      expect(localStorage.getItem('ontrack.theme.preference')).toBe(savedTheme);
      if (fails) {
        throw new Error('synthetic capture failure');
      }
      return document.createElement('canvas');
    });
    Object.assign(component, {
      ganttComponent: {element: root, view: {width: 1000}},
      project: {unit: {code: 'TEST'}},
      ganttPrintService: {html2canvas: capture},
      alertService: {error: reportError},
      renderAllGanttBars: async () => {},
      waitForStableLayout: async () => {},
      nextAnimationFrame: async () => {},
      downloadCanvas: download,
    });

    await component.saveImage();

    expect(capture).toHaveBeenCalledOnce();
    expect(root.classList.contains('ot-gantt-export')).toBe(false);
    expect(root.style.width).toBe('640px');
    expect(root.style.height).toBe('400px');
    expect(root.style.overflow).toBe('hidden');
    expect(scroll.scrollLeft).toBe(31);
    expect(scroll.scrollTop).toBe(47);
    expect(windowScroll).toHaveBeenCalled();
    expect(document.documentElement.getAttribute('data-ot-theme')).toBe(rootTheme);
    expect(localStorage.getItem('ontrack.theme.preference')).toBe(savedTheme);
    expect(download).toHaveBeenCalledTimes(fails ? 0 : 1);
    expect(reportError).toHaveBeenCalledTimes(fails ? 1 : 0);
  });
});
