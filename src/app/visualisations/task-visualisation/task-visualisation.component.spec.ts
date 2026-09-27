import {beforeEach, describe, expect, it} from 'vitest';
import {SimpleChange} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {RouterModule} from '@angular/router';
import {Project, TaskStatus} from 'src/app/api/models/doubtfire-model';
import {TaskVisualisationComponent} from './task-visualisation.component';

describe('TaskVisualisationComponent', () => {
  let fixture: ComponentFixture<TaskVisualisationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      declarations: [TaskVisualisationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskVisualisationComponent);
    fixture.componentInstance.project = {
      id: 7,
      activeTasks: () => [{status: 'complete'}, {status: 'not_started'}],
    } as unknown as Project;
    fixture.detectChanges();
  });

  it('always shows the four main statuses as Tasks filter links, including zero counts', () => {
    const host = fixture.nativeElement as HTMLElement;
    const cards = Array.from(host.querySelectorAll<HTMLElement>('[role="listitem"]'));
    const awaitingFeedback = cards.find((card) => card.textContent.includes('Awaiting Feedback'));

    expect(cards.map((card) => card.dataset.status)).toEqual([
      'not_started',
      'working_on_it',
      'ready_for_feedback',
      'complete',
    ]);
    expect(awaitingFeedback).toBeTruthy();
    expect(awaitingFeedback?.textContent).not.toContain('...');
    expect(awaitingFeedback?.getAttribute('aria-label')).toBe('Show 0 Awaiting Feedback tasks');
    expect(awaitingFeedback?.tagName).toBe('A');
    expect((awaitingFeedback as HTMLAnchorElement)?.href).toContain(
      '/projects/7/dashboard?taskStatus=ready_for_feedback',
    );
    expect(host.querySelector('ngx-charts-number-card')).toBeNull();
    expect(host.querySelector('button')).toBeNull();
  });

  it('adds a tile for any other status only while a task is in it', () => {
    fixture.componentInstance.project = {
      id: 7,
      activeTasks: () => [{status: 'need_help'}, {status: 'fail'}],
    } as unknown as Project;
    fixture.componentInstance.updateData();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const statuses = Array.from(host.querySelectorAll<HTMLElement>('[role="listitem"]')).map(
      (card) => card.dataset.status,
    );

    expect(statuses).toEqual([
      'not_started',
      'working_on_it',
      'need_help',
      'ready_for_feedback',
      'complete',
      'fail',
    ]);
  });

  // Each tile must paint its own status fill with that status's -on text: those are
  // the pairs the theme contract measures at 4.5:1 or better, in both themes. jsdom
  // cannot resolve custom properties, so the old check parsed var() strings as
  // colours, got NaN, and passed without checking anything.
  it('pairs every status tile fill with the text colour measured for it', () => {
    fixture.componentInstance.project = {
      id: 7,
      activeTasks: () => TaskStatus.STATUS_KEYS.map((status) => ({status})),
    } as unknown as Project;
    fixture.componentInstance.updateData();
    fixture.detectChanges();

    const cards = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="listitem"]'),
    );

    expect(cards.length).toBeGreaterThan(4);
    for (const card of cards) {
      const key = card.dataset.status.replace(/_/g, '-');
      expect(card.style.backgroundColor).toBe(`var(--ot-status-${key})`);
      expect(card.style.color).toBe(`var(--ot-status-${key}-on)`);
    }
  });
});

describe('TaskVisualisationComponent route reuse', () => {
  it('updates counts for a different project at the same grade', () => {
    const firstProject = {
      id: 2,
      activeTasks: () => [{status: 'complete'}],
    } as unknown as Project;
    const nextProject = {
      id: 18,
      activeTasks: () => [{status: 'ready_for_feedback'}],
    } as unknown as Project;
    const component = new TaskVisualisationComponent();
    component.project = firstProject;
    component.grade = 0;
    component.ngOnInit();

    component.project = nextProject;
    component.ngOnChanges({project: new SimpleChange(firstProject, nextProject, false)});

    expect(component.data.find(({name}) => name === 'Awaiting Feedback')?.value).toBe(1);
    expect(component.data.find(({name}) => name === 'Complete')?.value).toBe(0);
  });
});
