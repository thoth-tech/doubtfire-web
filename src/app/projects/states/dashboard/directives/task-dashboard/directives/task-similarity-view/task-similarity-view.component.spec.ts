import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatExpansionModule} from '@angular/material/expansion';
import {Observable, of, throwError} from 'rxjs';
import {Task} from 'src/app/api/models/task';
import {TaskSimilarity} from 'src/app/api/models/task-similarity';
import {TaskSimilarityService} from 'src/app/api/services/task-similarity.service';
import {EmptyStateComponent} from 'src/app/common/empty-state/empty-state.component';
import {FileDownloaderService} from 'src/app/common/file-downloader/file-downloader.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {SelectedTaskService} from 'src/app/projects/states/dashboard/selected-task.service';
import {TaskSimilarityViewComponent} from './task-similarity-view.component';

function similarityStub(flagged = false): TaskSimilarity {
  return {
    id: 1,
    type: 'MossTaskSimilarity',
    friendlyTypeName: 'MOSS',
    flagged,
    readyForViewer: false,
    parts: [{idx: 0, description: 'Matched work by another student'}],
  } as unknown as TaskSimilarity;
}

describe('TaskSimilarityViewComponent', () => {
  let fixture: ComponentFixture<TaskSimilarityViewComponent>;
  let component: TaskSimilarityViewComponent;
  let fetchSimilarities: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskSimilarityViewComponent],
      imports: [EmptyStateComponent],
      providers: [
        {provide: TaskSimilarityService, useValue: {}},
        {provide: AlertService, useValue: {}},
        {provide: SelectedTaskService, useValue: {}},
        {provide: FileDownloaderService, useValue: {}},
      ],
      // The Material panels and the JPlag viewer are not under test here.
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  function render(
    similarities: TaskSimilarity[],
    fetch: () => Observable<TaskSimilarity[]> = () => of(similarities),
  ): void {
    fetchSimilarities = vi.fn(fetch);
    fixture = TestBed.createComponent(TaskSimilarityViewComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('task', {
      id: 7,
      similarityCache: {values: of(similarities), currentValues: similarities},
      fetchSimilarities,
    } as unknown as Task);
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ');
  }

  function collapseAll(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('button[aria-label="Collapse all"]');
  }

  // Matches on the visible label, which may sit beside an icon's ligature text.
  function buttonLabelled(label: string): HTMLButtonElement | undefined {
    return Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(
      (button) => button.textContent.includes(label),
    );
  }

  it('shows the empty state and no Collapse all when there are no similarities', () => {
    render([]);

    expect(fixture.nativeElement.querySelector('h2').textContent).toContain('Similarities');
    expect(text()).toContain('No similarities found');
    expect(text()).toContain("Matches from the unit's JPlag and Turnitin checks show here.");
    expect(collapseAll()).toBeNull();
  });

  it('offers Collapse all only while a similarity is open, and closing clears it', () => {
    const similarity = similarityStub();
    render([similarity]);

    expect(text()).not.toContain('No similarities found');
    expect(collapseAll()).toBeNull();

    similarity.parts[0].panelOpenState = true;
    fixture.detectChanges();
    expect(collapseAll()).not.toBeNull();
    expect(collapseAll().getAttribute('type')).toBe('button');

    collapseAll().click();
    fixture.detectChanges();
    expect(similarity.parts[0].panelOpenState).toBe(false);
    expect(collapseAll()).toBeNull();
  });

  it('names a flagged similarity in words as well as colour', () => {
    render([similarityStub(true)]);

    const panel = fixture.nativeElement.querySelector('mat-expansion-panel') as HTMLElement;
    expect(panel.textContent).toContain('Flagged');
    expect(panel.classList).toContain('border-ot-error');
    const flag = panel.querySelector('button[aria-label="Flag similarity"]');
    expect(flag.getAttribute('aria-pressed')).toBe('true');
  });

  it('leaves an unflagged similarity unmarked', () => {
    render([similarityStub(false)]);

    const panel = fixture.nativeElement.querySelector('mat-expansion-panel') as HTMLElement;
    expect(panel.textContent).not.toContain('Flagged');
    expect(panel.classList).not.toContain('border-ot-error');
    const flag = panel.querySelector('button[aria-label="Flag similarity"]');
    expect(flag.getAttribute('aria-pressed')).toBe('false');
  });

  it('shows an error state with Try again when the similarities fail to load', () => {
    let fail = true;
    render([], () => (fail ? throwError(() => new Error('offline')) : of([])));

    expect(text()).toContain('The similarities did not load');
    expect(text()).not.toContain('No similarities found');

    fail = false;
    buttonLabelled('Try again').click();
    fixture.detectChanges();

    expect(fetchSimilarities).toHaveBeenCalledTimes(2);
    expect(text()).not.toContain('The similarities did not load');
    expect(text()).toContain('No similarities found');
  });

  it('swaps Collapse all for Back to summary while the JPlag report is open', () => {
    const similarity = similarityStub();
    similarity.parts[0].panelOpenState = true;
    render([similarity]);
    component.jplagOpenState = true;
    fixture.detectChanges();

    expect(collapseAll()).toBeNull();
    buttonLabelled('Back to summary').click();
    fixture.detectChanges();

    expect(component.jplagOpenState).toBe(false);
    expect(collapseAll()).not.toBeNull();
  });
});

describe('TaskSimilarityViewComponent focus', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskSimilarityViewComponent],
      // Real panels, so there is a panel header to take focus.
      imports: [EmptyStateComponent, MatExpansionModule],
      providers: [
        {provide: TaskSimilarityService, useValue: {}},
        {provide: AlertService, useValue: {}},
        {provide: SelectedTaskService, useValue: {}},
        {provide: FileDownloaderService, useValue: {}},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('hands focus to the first similarity once Collapse all has gone', async () => {
    const similarity = similarityStub();
    similarity.parts[0].panelOpenState = true;
    const fixture = TestBed.createComponent(TaskSimilarityViewComponent);
    fixture.componentRef.setInput('task', {
      id: 7,
      similarityCache: {values: of([similarity]), currentValues: [similarity]},
      fetchSimilarities: () => of([similarity]),
    } as unknown as Task);
    fixture.detectChanges();

    const collapse = fixture.nativeElement.querySelector(
      'button[aria-label="Collapse all"]',
    ) as HTMLButtonElement;
    collapse.focus();
    collapse.click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));

    expect(fixture.nativeElement.querySelector('button[aria-label="Collapse all"]')).toBeNull();
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('mat-expansion-panel-header'),
    );
  });
});
