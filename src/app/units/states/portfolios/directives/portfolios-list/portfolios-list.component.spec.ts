import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CommonModule} from '@angular/common';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatMenuModule} from '@angular/material/menu';
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatSelectModule} from '@angular/material/select';
import {MatSortModule} from '@angular/material/sort';
import {MatTableModule} from '@angular/material/table';
import {MatTooltipModule} from '@angular/material/tooltip';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {Project} from 'src/app/api/models/project';
import {Unit} from 'src/app/api/models/unit';
import {TaskService} from 'src/app/api/services/task.service';
import {UnitService} from 'src/app/api/services/unit.service';
import {UserService} from 'src/app/api/services/user.service';
import {EmptyStateComponent} from 'src/app/common/empty-state/empty-state.component';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {SidekiqProgressModalService} from 'src/app/common/modals/sidekiq-progress-modal/sidekiq-progress-modal.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {D2lTransferModal} from '../../d2l-transfer-modal/d2l-transfer.component';
import {PortfolioMarkingStateService} from '../../portfolio-marking-state.service';
import {
  DEFAULT_PORTFOLIO_LIST_FILTERS,
  PortfolioListFilters,
  PortfoliosListComponent,
} from './portfolios-list.component';

interface StudentOptions {
  id: number;
  name: string;
  hasPortfolio?: boolean;
  submittedGrade?: number | null;
  grade?: number | null;
  gradeRationale?: string | null;
  taskStats?: {key: string; value: number}[];
}

function studentStub(options: StudentOptions): Project {
  return {
    id: options.id,
    student: {name: options.name, studentId: String(1000 + options.id), username: 'u'},
    hasPortfolio: options.hasPortfolio ?? false,
    portfolioAvailable: false,
    submittedGrade: options.submittedGrade ?? null,
    targetGrade: 0,
    grade: options.grade ?? 0,
    gradeRationale: options.gradeRationale ?? null,
    taskStats: options.taskStats ?? [],
    portfolioSubmissionDate: null,
    tutorNames: () => 'Tia Tutor',
    shortTutorialDescription: () => 'LA1-01',
    hasTutor: () => true,
  } as unknown as Project;
}

function unitStub(students: Project[], id = 1): Unit {
  return {id, code: 'SIT101', students, hasD2lMapping: () => false} as unknown as Unit;
}

describe('PortfoliosListComponent', () => {
  let fixture: ComponentFixture<PortfoliosListComponent>;
  let component: PortfoliosListComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PortfoliosListComponent],
      imports: [
        CommonModule,
        EmptyStateComponent,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatMenuModule,
        MatPaginatorModule,
        MatSelectModule,
        MatSortModule,
        MatTableModule,
        MatTooltipModule,
        NoopAnimationsModule,
      ],
      providers: [
        {provide: UserService, useValue: {currentUser: {id: 7}}},
        {
          provide: GradeService,
          useValue: {
            gradeValuesFor: () => [0, 1, 2, 3],
            gradeLabel: (grade: number) => ['Pass', 'Credit', 'Distinction', 'HD'][grade],
          },
        },
        {provide: FileDownloaderService, useValue: {downloadFile: vi.fn()}},
        {provide: UnitService, useValue: {}},
        {provide: AlertService, useValue: {error: vi.fn()}},
        {provide: SidekiqProgressModalService, useValue: {}},
        {provide: D2lTransferModal, useValue: {open: vi.fn()}},
      ],
      // f-grade-icon and f-upload-grades are not under test here.
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  async function render(
    students: Project[],
    filters: PortfolioListFilters = DEFAULT_PORTFOLIO_LIST_FILTERS,
  ): Promise<void> {
    fixture = TestBed.createComponent(PortfoliosListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('unit', unitStub(students));
    fixture.componentRef.setInput('filters', filters);
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function rowNames(): string[] {
    return Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('tr.mat-mdc-row td:first-child'),
    ).map((cell) => cell.textContent.trim());
  }

  function text(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ');
  }

  function buttonNamed(label: string): HTMLButtonElement {
    return Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(
      (button) => button.textContent.trim() === label,
    );
  }

  const withPortfolios = () => [
    studentStub({id: 1, name: 'Zed Zulu', hasPortfolio: true, submittedGrade: 1}),
    studentStub({id: 2, name: 'Amy Adams', hasPortfolio: true, submittedGrade: 2}),
    studentStub({id: 3, name: 'Mia Moss', hasPortfolio: true, submittedGrade: 1}),
  ];

  // The header said the list was sorted, but the rows came in the order the api sent.
  it('sorts the rows the way the header says on first load', async () => {
    await render(withPortfolios());

    expect(rowNames()).toEqual(['Amy Adams', 'Mia Moss', 'Zed Zulu']);
  });

  // A filter change used to put back the unsorted list under a sorted header.
  it('keeps the chosen sort when a filter changes', async () => {
    await render(withPortfolios());

    const nameHeader: HTMLElement = fixture.nativeElement.querySelector('th.mat-column-name');
    nameHeader.click();
    fixture.detectChanges();
    expect(rowNames()).toEqual(['Zed Zulu', 'Mia Moss', 'Amy Adams']);

    component.onGradeFilterChange({value: 1});
    fixture.detectChanges();

    expect(rowNames()).toEqual(['Zed Zulu', 'Mia Moss']);
  });

  it('labels every filter and names the student on the open button', async () => {
    await render(withPortfolios());

    const labels = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('mat-label')).map(
      (label) => label.textContent.trim(),
    );
    expect(labels).toEqual(['Search students', 'Show', 'Tutorials', 'Grade applied for']);

    const openButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      'tr.mat-mdc-row button[aria-label]',
    );
    expect(openButton.getAttribute('aria-label')).toBe(
      'Open the dashboard for Amy Adams in a new tab',
    );
  });

  it('offers to show everyone when nobody has submitted a portfolio yet', async () => {
    await render([studentStub({id: 1, name: 'Amy Adams'})]);
    const emitted: PortfolioListFilters[] = [];
    component.filtersChange.subscribe((filters) => emitted.push(filters));

    expect(text()).toContain('No portfolios submitted yet');
    expect(fixture.nativeElement.querySelector('table').closest('.hidden')).not.toBeNull();

    buttonNamed('Show all students').click();
    fixture.detectChanges();

    expect(emitted.at(-1).portfolioFilter).toBe('all');
    expect(rowNames()).toEqual(['Amy Adams']);
    expect(fixture.nativeElement.querySelector('table').closest('.hidden')).toBeNull();
  });

  it('offers to clear the filters when they hide everyone', async () => {
    await render(withPortfolios(), {...DEFAULT_PORTFOLIO_LIST_FILTERS, filterText: 'nobody'});

    expect(text()).toContain('No students match these filters');

    const clear = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('section button'),
    ).find((button) => button.textContent.trim() === 'Clear filters');
    clear.click();
    fixture.detectChanges();

    expect(rowNames()).toHaveLength(3);
  });

  it('says a student with the starting 0 has not been graded', async () => {
    await render([
      studentStub({id: 1, name: 'Amy Adams', hasPortfolio: true}),
      studentStub({
        id: 2,
        name: 'Bo Brown',
        hasPortfolio: true,
        grade: 0,
        gradeRationale: 'Nothing was submitted',
      }),
    ]);

    const gradeCells = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('td.mat-column-grade'),
    ).map((cell) => cell.textContent.trim());
    expect(gradeCells).toEqual(['Not graded', '0']);
  });

  const thirtyStudents = () =>
    Array.from({length: 30}, (_, index) =>
      studentStub({
        id: index + 1,
        name: `Student ${String(index + 1).padStart(2, '0')}`,
        hasPortfolio: true,
      }),
    );

  function paginator(): MatPaginator {
    return fixture.debugElement.query(By.directive(MatPaginator)).componentInstance;
  }

  // Opening a student is a new route, so the list is built again when the tutor comes
  // back. It used to start again on the first page, sorted by name.
  it('comes back to the sort and page the tutor left', async () => {
    await render(thirtyStudents());
    fixture.nativeElement.querySelector('th.mat-column-name').click();
    fixture.detectChanges();
    paginator().nextPage();
    fixture.detectChanges();
    fixture.destroy();

    await render(thirtyStudents());

    expect(paginator().pageIndex).toBe(1);
    expect(rowNames()).toEqual([
      'Student 05',
      'Student 04',
      'Student 03',
      'Student 02',
      'Student 01',
    ]);
  });

  // With no rows yet the table drops a restored page to the first on its own.
  it('keeps a restored page when the students arrive after the list is built', async () => {
    TestBed.inject(PortfolioMarkingStateService).rememberListView(1, {pageIndex: 1});
    fixture = TestBed.createComponent(PortfoliosListComponent);
    fixture.componentRef.setInput('unit', unitStub(thirtyStudents()));
    fixture.componentRef.setInput('filters', DEFAULT_PORTFOLIO_LIST_FILTERS);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(paginator().pageIndex).toBe(1);
    expect(rowNames()[0]).toBe('Student 26');
  });

  it('keeps the page when the students load again after a grades upload', async () => {
    await render(thirtyStudents());
    paginator().nextPage();
    fixture.detectChanges();

    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();

    expect(paginator().pageIndex).toBe(1);
  });

  // Switching unit hands the list that unit's own filters at the same time, which
  // used to count as a filter edit and wipe the page remembered for it.
  it('opens another unit on the page remembered for it', async () => {
    TestBed.inject(PortfolioMarkingStateService).rememberListView(2, {pageIndex: 1});
    await render(thirtyStudents());

    fixture.componentRef.setInput('unit', unitStub(thirtyStudents(), 2));
    fixture.componentRef.setInput('filters', {...DEFAULT_PORTFOLIO_LIST_FILTERS, filterText: '1'});
    fixture.detectChanges();
    await fixture.whenStable();

    expect(paginator().pageIndex).toBe(1);
    expect(TestBed.inject(PortfolioMarkingStateService).listViewFor(2).pageIndex).toBe(1);
  });

  // Setting the search and the rows one after the other made the table work out the
  // page twice, and the answer from the old rows could land last.
  it('keeps the remembered page when a unit and its filters arrive together', async () => {
    const hundred = Array.from({length: 100}, (_, index) =>
      studentStub({id: index + 1, name: `Student ${index + 1}`, hasPortfolio: true}),
    );
    TestBed.inject(PortfolioMarkingStateService).rememberListView(2, {pageIndex: 2});
    await render(thirtyStudents().slice(0, 10));

    fixture.componentRef.setInput('unit', unitStub(hundred, 2));
    fixture.componentRef.setInput('filters', {...DEFAULT_PORTFOLIO_LIST_FILTERS, filterText: 's'});
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.pageIndex).toBe(2);
    expect(paginator().pageIndex).toBe(2);
  });

  it('pulls the page back inside the rows there are now', async () => {
    await render(thirtyStudents());
    paginator().nextPage();
    fixture.detectChanges();

    fixture.componentRef.setInput('unit', unitStub(thirtyStudents().slice(0, 10)));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.pageIndex).toBe(0);
    expect(paginator().pageIndex).toBe(0);
    expect(rowNames()).toHaveLength(10);
  });

  it('goes back to the first page when the filters change', async () => {
    await render(thirtyStudents());
    paginator().nextPage();
    fixture.detectChanges();

    fixture.componentRef.setInput('filters', {...DEFAULT_PORTFOLIO_LIST_FILTERS, filterText: '1'});
    fixture.detectChanges();

    expect(paginator().pageIndex).toBe(0);
  });

  // The stats turn a zero share of tasks not started into the whole bar.
  it('works out the tasks not started from the rest of the bar', async () => {
    await render(withPortfolios());

    const progress = component.progressFor(
      studentStub({
        id: 9,
        name: 'Al Done',
        taskStats: [
          {key: 'fail', value: 0},
          {key: 'not_started', value: 100},
          {key: 'working_on_it', value: 0},
          {key: 'ready_for_feedback', value: 0},
          {key: 'complete', value: 100},
        ],
      }),
    );

    expect(progress.segments.map((segment) => [segment.key, segment.value])).toEqual([
      ['complete', 100],
    ]);
    expect(progress.segments[0].color).toBe('var(--ot-status-complete-graphic)');
    expect(progress.label).toBe('Task progress: Complete 100%');
  });
});

function projectStub(name: string): Project {
  return {
    student: {name, username: name.toLowerCase()},
    hasPortfolio: true,
    hasTutor: () => true,
    tutorNames: () => '',
    shortTutorialDescription: () => '',
    taskStats: [],
  } as unknown as Project;
}

describe('PortfoliosListComponent empty state', () => {
  afterEach(() => vi.restoreAllMocks());

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PortfoliosListComponent],
      imports: [MatMenuModule, MatTableModule, EmptyStateComponent],
      providers: [
        {
          provide: TaskService,
          useValue: {statusColors: new Map(), statusLabels: new Map()},
        },
        {provide: UserService, useValue: {}},
        {provide: GradeService, useValue: {gradeValuesFor: () => [], gradeLabel: () => ''}},
        {provide: FileDownloaderService, useValue: {}},
        {provide: UnitService, useValue: {}},
        {provide: AlertService, useValue: {}},
        {provide: SidekiqProgressModalService, useValue: {}},
        {provide: D2lTransferModal, useValue: {}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  // The loading rows are drawn in the template, and the table is hidden with a class so
  // the sort survives, so this checks the placeholder text and the class.
  it('renders the empty state only while the filtered list has no rows', () => {
    const fixture = TestBed.createComponent(PortfoliosListComponent);
    const root = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('unit', {
      students: [],
      hasD2lMapping: () => false,
    } as unknown as Unit);

    fixture.detectChanges();

    expect(root.querySelector('f-empty-state')).toBeNull();
    expect(root.textContent).toContain('Loading students');

    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();

    const emptyState = root.querySelector('f-empty-state') as HTMLElement;
    const table = root.querySelector('table') as HTMLTableElement;
    const tableScrollContainer = table.parentElement as HTMLDivElement;

    expect(emptyState).toBeTruthy();
    expect(root.textContent).not.toContain('Loading students');
    expect(emptyState.closest('table')).toBeNull();
    expect(tableScrollContainer.classList.contains('hidden')).toBe(true);

    fixture.componentRef.setInput('unit', {
      students: [projectStub('Cy Cole')],
      hasD2lMapping: () => false,
    } as unknown as Unit);
    fixture.detectChanges();

    expect(root.querySelector('f-empty-state')).toBeNull();
    expect(tableScrollContainer.classList.contains('hidden')).toBe(false);
  });
});
