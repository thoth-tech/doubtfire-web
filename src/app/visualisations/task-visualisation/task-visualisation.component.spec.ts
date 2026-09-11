import {beforeEach, describe, expect, it} from 'vitest';
import {SimpleChange} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Project} from 'src/app/api/models/doubtfire-model';
import {TaskVisualisationComponent} from './task-visualisation.component';

describe('TaskVisualisationComponent', () => {
  let fixture: ComponentFixture<TaskVisualisationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskVisualisationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskVisualisationComponent);
    fixture.componentInstance.project = {
      activeTasks: () => [{status: 'complete'}, {status: 'not_started'}],
    } as unknown as Project;
    fixture.detectChanges();
  });

  it('renders complete status labels without chart ellipsis or a false click affordance', () => {
    const host = fixture.nativeElement as HTMLElement;
    const cards = Array.from(host.querySelectorAll<HTMLElement>('[role="listitem"]'));
    const awaitingFeedback = cards.find((card) => card.textContent.includes('Awaiting Feedback'));

    expect(awaitingFeedback).toBeTruthy();
    expect(awaitingFeedback?.textContent).not.toContain('...');
    expect(awaitingFeedback?.getAttribute('aria-label')).toBe('Awaiting Feedback: 0');
    expect(awaitingFeedback?.tagName).toBe('DIV');
    expect(host.querySelector('ngx-charts-number-card')).toBeNull();
    expect(host.querySelector('button')).toBeNull();
  });

  it('keeps every rendered status card above the 4.5:1 contrast floor', () => {
    const host = fixture.nativeElement as HTMLElement;
    const cards = Array.from(host.querySelectorAll<HTMLElement>('[role="listitem"]'));

    const luminance = (color: string) => {
      const [red, green, blue] = color
        .replace(/[^\d,]/g, '')
        .split(',')
        .map((channel) => {
          const value = Number(channel) / 255;
          return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const contrast = (card: HTMLElement) => {
      const text = luminance(card.style.color);
      const background = luminance(card.style.backgroundColor);
      return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
    };

    expect(cards.length).toBeGreaterThan(0);
    expect(cards.filter((card) => contrast(card) < 4.5).map((card) => card.textContent)).toEqual(
      [],
    );
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
