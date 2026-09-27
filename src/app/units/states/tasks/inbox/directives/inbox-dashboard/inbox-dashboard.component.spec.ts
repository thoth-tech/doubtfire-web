import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA, SimpleChange} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatMenuModule} from '@angular/material/menu';
import {Project} from 'src/app/api/models/project';
import {Task} from 'src/app/api/models/task';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {TutorialStream} from 'src/app/api/models/tutorial-stream/tutorial-stream';
import {Tutorial} from 'src/app/api/models/tutorial/tutorial';
import {Unit} from 'src/app/api/models/unit';
import {UnitRole} from 'src/app/api/models/unit-role';
import {User} from 'src/app/api/models/user/user';
import {UserService} from 'src/app/api/services/user.service';
import {EmptyStateComponent} from 'src/app/common/empty-state/empty-state.component';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {PanelFullscreenButtonComponent} from 'src/app/common/panel-layout/panel-fullscreen-button.component';
import {PanelComponent} from 'src/app/common/panel-layout/panel.component';
import {InboxDashboardComponent} from './inbox-dashboard.component';

function user(id: number, name: string): User {
  return {id, name} as User;
}

function staffRole(unit: Unit, id: number, member: User, role: string): UnitRole {
  const unitRole = new UnitRole();
  unitRole.id = id;
  unitRole.user = member;
  unitRole.role = role;
  unitRole.unit = unit;
  unit.staffCache.add(unitRole);
  return unitRole;
}

/**
 * A task the way the inbox gets one in a unit that does not use tutorial streams: the
 * student's tutorial and the task definition both have no stream.
 */
function unstreamedTask(unit: Unit, tutor: User): Task {
  const tutorial = new Tutorial(unit);
  tutorial.id = 30;
  tutorial.tutor = tutor;

  const project = new Project(unit);
  project.id = 40;
  project.tutorialEnrolmentsCache.add(tutorial);

  const definition = new TaskDefinition(unit);
  definition.id = 50;

  const task = new Task(project);
  task.definition = definition;
  return task;
}

describe('InboxDashboardComponent', () => {
  let component: InboxDashboardComponent;
  let fixture: ComponentFixture<InboxDashboardComponent>;
  let currentUser: User | null;

  beforeEach(async () => {
    currentUser = null;

    await TestBed.configureTestingModule({
      declarations: [InboxDashboardComponent],
      providers: [
        {
          provide: UserService,
          useValue: {
            get currentUser() {
              return currentUser;
            },
          },
        },
        {provide: FileDownloaderService, useValue: {}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(InboxDashboardComponent, {set: {template: ''}})
      .compileComponents();

    fixture = TestBed.createComponent(InboxDashboardComponent);
    component = fixture.componentInstance;
  });

  // The live inbox threw "reading 'name'" from Task.tutor on every change detection,
  // which blanked the task pane and left the marking bar as grey skeletons.
  it('works out tutor notes access when neither the tutorial nor the task has a stream', () => {
    const unit = new Unit();
    const tutorUser = user(7, 'Tess Tutor');
    const convenorUser = user(8, 'Cam Convenor');
    const tutorRole = staffRole(unit, 70, tutorUser, 'Tutor');
    staffRole(unit, 80, convenorUser, 'Convenor');
    currentUser = convenorUser;
    component.task = unstreamedTask(unit, tutorUser);

    expect(() => component.canAccessTutorNotes).not.toThrow();
    expect(component.task.tutor).toBe(tutorRole);
    expect(component.canAccessTutorNotes).toBe(true);
  });

  it('matches a streamed task to a tutorial that has no stream', () => {
    const unit = new Unit();
    const tutorUser = user(7, 'Tess Tutor');
    const tutorRole = staffRole(unit, 70, tutorUser, 'Tutor');
    const task = unstreamedTask(unit, tutorUser);
    task.definition.tutorialStream = {name: 'Workshop'} as TutorialStream;

    expect(task.tutor).toBe(tutorRole);
  });

  it('denies tutor notes, without throwing, to someone with no role in the unit', () => {
    const unit = new Unit();
    const tutorUser = user(7, 'Tess Tutor');
    staffRole(unit, 70, tutorUser, 'Tutor');
    currentUser = user(99, 'An Admin');
    component.task = unstreamedTask(unit, tutorUser);

    expect(component.currentUnitRole).toBeUndefined();
    expect(component.canAccessTutorNotes).toBe(false);
  });

  it('denies tutor notes when the tutorial has no tutor', () => {
    const unit = new Unit();
    const convenorUser = user(8, 'Cam Convenor');
    staffRole(unit, 80, convenorUser, 'Convenor');
    currentUser = convenorUser;
    component.task = unstreamedTask(unit, null);

    expect(component.task.tutor).toBeUndefined();
    expect(component.canAccessTutorNotes).toBe(false);
  });

  it('has no staff role and no tutor notes when no task is selected', () => {
    currentUser = user(8, 'Cam Convenor');
    component.task = null;

    expect(component.currentUnitRole).toBeUndefined();
    expect(component.canAccessTutorNotes).toBe(false);
  });

  describe('the document on show', () => {
    // The emitter is async, so a listener hears about a change on the next tick.
    const nextTick = () => new Promise((resolve) => setTimeout(resolve));

    function selectTask(task: Task | null): void {
      const previous = component.task;
      component.task = task;
      component.ngOnChanges({task: new SimpleChange(previous, task, previous === undefined)});
    }

    // The details that say whether there is a PDF land after the task is selected. The
    // URL used to be worked out only when the tab changed, so on a phone the download
    // button stayed off for a submission that had already loaded.
    it('announces the submission PDF once the submission details arrive', async () => {
      const unit = new Unit();
      const task = unstreamedTask(unit, user(7, 'Tess Tutor'));
      vi.spyOn(task, 'submissionUrl').mockReturnValue('https://api.test/submission');
      task.loadingSubmissionDetails = true;
      const urls: (string | null)[] = [];
      component.visiblePdfUrlChange.subscribe((url) => urls.push(url));

      selectTask(task);
      await nextTick();
      expect(urls).toEqual([null]);

      task.loadingSubmissionDetails = false;
      task.hasPdf = true;
      component.ngDoCheck();
      await nextTick();

      expect(urls).toEqual([null, 'https://api.test/submission']);
    });

    it('announces again for every newly selected task, even with no PDF on either', async () => {
      const unit = new Unit();
      const urls: (string | null)[] = [];
      component.visiblePdfUrlChange.subscribe((url) => urls.push(url));

      selectTask(unstreamedTask(unit, null));
      selectTask(unstreamedTask(unit, null));
      component.ngDoCheck();
      await nextTick();

      expect(urls).toEqual([null, null]);
    });
  });
});

describe('InboxDashboardComponent full screen', () => {
  let fixture: ComponentFixture<InboxDashboardComponent>;
  let panel: {
    panelTitle: string;
    isFullscreen: boolean;
    stacked: boolean;
    toggleFullscreen: ReturnType<typeof vi.fn>;
  } | null;

  async function render(withPanel: boolean): Promise<void> {
    panel = withPanel
      ? {
          panelTitle: 'Selected task',
          isFullscreen: false,
          stacked: false,
          toggleFullscreen: vi.fn(),
        }
      : null;
    await TestBed.configureTestingModule({
      declarations: [InboxDashboardComponent],
      imports: [MatMenuModule, PanelFullscreenButtonComponent],
      providers: [
        {provide: UserService, useValue: {currentUser: null}},
        {provide: FileDownloaderService, useValue: {}},
        ...(panel ? [{provide: PanelComponent, useValue: panel}] : []),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(InboxDashboardComponent);
    fixture.componentInstance.task = unstreamedTask(new Unit(), null);
    fixture.detectChanges();
  }

  const toggle = (): HTMLButtonElement | null =>
    fixture.nativeElement.querySelector('app-panel-fullscreen-button button');

  it('puts the full-screen button in the tab bar, just before the more actions menu', async () => {
    await render(true);

    expect(toggle().getAttribute('aria-label')).toBe('Open Selected task full screen');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(toggle().classList).toContain('text-ot-muted');
    expect(
      toggle().closest('app-panel-fullscreen-button').nextElementSibling.getAttribute('aria-label'),
    ).toBe('More actions for this task');

    toggle().click();
    expect(panel.toggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it('renders no full-screen button when the dashboard is not in a panel', async () => {
    await render(false);

    expect(fixture.nativeElement.querySelector('app-panel-fullscreen-button')).not.toBeNull();
    expect(toggle()).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[aria-label="More actions for this task"]'),
    ).not.toBeNull();
  });

  it('keeps Student notes to a reading width only while full screen', async () => {
    await render(true);
    const component = fixture.componentInstance;
    component.onTabChange({index: 4} as never);
    fixture.detectChanges();
    const notes = () =>
      fixture.nativeElement.querySelector('f-staff-notes-view').parentElement as HTMLElement;
    expect(notes().classList).not.toContain('dashboard-reading-measure');

    panel.isFullscreen = true;
    fixture.detectChanges();
    expect(notes().classList).toContain('dashboard-reading-measure');
    expect(component.currentTab).toBe(4);
  });
});

describe('InboxDashboardComponent empty-state colour tokens (THM-M03)', () => {
  let fixture: ComponentFixture<InboxDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InboxDashboardComponent],
      imports: [EmptyStateComponent],
      providers: [
        {provide: FileDownloaderService, useValue: {}},
        {provide: UserService, useValue: {}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(InboxDashboardComponent);
    // No task input set: renders the "Select a task to review" empty state,
    // the only state reachable without a fully-populated Task/Unit/Project mock.
    fixture.detectChanges();
  });

  it('carries the theme token (not a bare hex) on the empty-state icon and message', () => {
    // The shared empty state sets the muted text token once, and the icon and
    // message inherit it.
    const state: HTMLElement = fixture.nativeElement.querySelector('f-empty-state > div');

    expect(state.className).toContain('text-ot-muted');
    expect(state.querySelector('mat-icon')).not.toBeNull();
    expect(state.querySelector('p')).not.toBeNull();
    // Regression guard: a plain arbitrary hex class with no token reference
    // would mean the THM-M03 migration was reverted.
    expect(fixture.nativeElement.innerHTML).not.toMatch(/#c5c5c5/i);
  });

  it('shows the expected empty-state copy', () => {
    expect(fixture.nativeElement.textContent).toContain('Select a task to review');
  });
});
