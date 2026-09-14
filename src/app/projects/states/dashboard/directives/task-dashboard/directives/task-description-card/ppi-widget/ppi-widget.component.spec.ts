import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CommonModule} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';
import {SimpleChange} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {Observable, Subject, of, throwError} from 'rxjs';
import {PeerProgressIndicator} from 'src/app/api/models/peer-progress-indicator';
import {Task} from 'src/app/api/models/task';
import {TaskDefinition} from 'src/app/api/models/task-definition';
import {PeerProgressIndicatorService} from 'src/app/api/services/peer-progress-indicator.service';
import {
  DETAIL_PROTECTED_STATE,
  DISABLED_STATE,
  NORMAL_STATE,
  ROUNDED_90_STATE,
  ROUNDED_110_STATE,
  STALE_STATE,
  SUPPRESSED_STATE,
  UNAVAILABLE_STATE,
  USER_DISABLED_STATE,
  ZERO_PERCENT_STATE,
} from 'src/app/demo/fixtures/peer-progress-demo.fixtures';
import {PpiWidgetComponent} from './ppi-widget.component';

describe('PpiWidgetComponent', () => {
  let component: PpiWidgetComponent;
  let fixture: ComponentFixture<PpiWidgetComponent>;
  let getIndicator: ReturnType<typeof vi.fn>;

  const mockTask = {project: {id: 7, unit: {id: 1}, targetGrade: 2}} as unknown as Task;
  const mockTaskDef = {id: 99} as unknown as TaskDefinition;

  beforeEach(async () => {
    getIndicator = vi.fn();

    await TestBed.configureTestingModule({
      declarations: [PpiWidgetComponent],
      imports: [CommonModule, MatIconModule, MatProgressSpinnerModule, MatButtonModule],
      providers: [{provide: PeerProgressIndicatorService, useValue: {getIndicator}}],
    }).compileComponents();

    fixture = TestBed.createComponent(PpiWidgetComponent);
    component = fixture.componentInstance;
    component.task = mockTask;
    component.taskDef = mockTaskDef;
  });

  function load(response$: Observable<PeerProgressIndicator>) {
    getIndicator.mockReturnValue(response$);
    component.ngOnChanges({task: new SimpleChange(null, mockTask, true)});
    fixture.detectChanges();
  }

  it('should create', () => {
    load(of(NORMAL_STATE));
    expect(component).toBeTruthy();
  });

  it('shows the completion percentage on a normal response', () => {
    load(of(NORMAL_STATE));
    expect(getIndicator).toHaveBeenCalledWith(7, 99);
    expect(component.view.state).toBe('success');
    expect(fixture.nativeElement.textContent).toContain('10%');
    expect(fixture.nativeElement.textContent).toContain('have completed this task');
  });

  it('labels the rolling-API fallback as submitted rather than completed', () => {
    load(of({...NORMAL_STATE, completedPercentage: null}));

    const summary = fixture.nativeElement.querySelector('.ppi-value');
    expect(summary.textContent).toContain('60%');
    expect(summary.textContent).toContain('have submitted this task');
    expect(summary.getAttribute('aria-label')).toBe(
      'Peer submission progress at your target grade',
    );
  });

  it('shows a rounded zero as data rather than unavailable', () => {
    load(of(ZERO_PERCENT_STATE));
    expect(component.view.state).toBe('no-data');
    expect(fixture.nativeElement.textContent).toContain('0%');
    expect(fixture.nativeElement.textContent).toContain('have completed this task');
    expect(fixture.nativeElement.querySelector('.ppi-fill').style.width).toBe('0%');
  });

  it('shows the API-provided hidden message for a suppressed response', () => {
    load(of(SUPPRESSED_STATE));
    expect(component.view.state).toBe('hidden');
    expect(fixture.nativeElement.textContent).toContain(SUPPRESSED_STATE.unavailableMessage);
    expect(fixture.nativeElement.textContent).not.toMatch(/\d+ students?/);
  });

  it('shows the API-provided unavailable message', () => {
    load(of(UNAVAILABLE_STATE));
    expect(component.view.state).toBe('unavailable');
    expect(fixture.nativeElement.textContent).toContain(UNAVAILABLE_STATE.unavailableMessage);
  });

  it('shows the API-provided disabled message when the feature is turned off', () => {
    load(of(DISABLED_STATE));
    expect(component.view.state).toBe('disabled');
    expect(fixture.nativeElement.textContent).toContain(DISABLED_STATE.unavailableMessage);
  });

  it('uses a local neutral message when the profile preference is disabled', () => {
    load(of(USER_DISABLED_STATE));

    expect(component.view.state).toBe('preference-disabled');
    expect(fixture.nativeElement.textContent).toContain('Peer progress is turned off');
    expect(fixture.nativeElement.textContent).toContain('profile settings');
    expect(fixture.nativeElement.textContent).not.toContain('60%');
  });

  it('shows a distinct visible stale state when data is outdated', () => {
    load(of(STALE_STATE));
    expect(component.view.state).toBe('stale');
    expect(component.view.data?.submittedPercentage).toBeNull();
    expect(component.view.message).toBe(STALE_STATE.unavailableMessage);
    expect(fixture.nativeElement.textContent).toContain('Peer progress is currently unavailable.');
    expect(fixture.nativeElement.textContent).not.toContain('55%');
  });

  it('transitions from loading to success once the request resolves', () => {
    const subject: Subject<PeerProgressIndicator> = new Subject();
    getIndicator.mockReturnValue(subject.asObservable());

    component.ngOnChanges({task: new SimpleChange(null, mockTask, true)});
    expect(component.view.state).toBe('loading');

    subject.next(NORMAL_STATE);
    expect(component.view.state).toBe('success');
  });

  it.each([404, 503])(
    'shows a generic error for HTTP %s without leaking server details',
    (status) => {
      const subject: Subject<PeerProgressIndicator> = new Subject();
      getIndicator.mockReturnValue(subject.asObservable());

      component.ngOnChanges({task: new SimpleChange(null, mockTask, true)});
      expect(component.view.state).toBe('loading');

      subject.error(
        new HttpErrorResponse({
          status,
          error: {error: 'Peer progress is unavailable for this project or task.'},
        }),
      );
      fixture.detectChanges();

      expect(component.view.state).toBe('error');
      expect(component.view.data).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Could not load peer progress.');
      expect(fixture.nativeElement.textContent).not.toContain(
        'unavailable for this project or task',
      );
    },
  );

  it('does not render a stale value if a request fails after a new one has already started', () => {
    load(of(NORMAL_STATE));
    expect(fixture.nativeElement.textContent).toContain('10%');

    load(throwError(() => new Error('network down')));
    fixture.detectChanges();
    expect(component.view.state).toBe('error');
    expect(fixture.nativeElement.textContent).not.toContain('10%');
  });

  it('cancels a previous in-flight request when the task changes before it resolves', () => {
    const first: Subject<PeerProgressIndicator> = new Subject();
    const second: Subject<PeerProgressIndicator> = new Subject();
    getIndicator
      .mockReturnValueOnce(first.asObservable())
      .mockReturnValueOnce(second.asObservable());

    component.ngOnChanges({task: new SimpleChange(null, mockTask, true)});
    component.ngOnChanges({task: new SimpleChange(null, mockTask, true)});

    first.next(NORMAL_STATE);
    expect(component.view.state).toBe('loading');

    second.next(SUPPRESSED_STATE);
    expect(component.view.state).toBe('hidden');
  });

  it('hides decorative icons from screen readers', () => {
    load(throwError(() => new Error('network down')));
    fixture.detectChanges();

    const icons = fixture.nativeElement.querySelectorAll('mat-icon');

    icons.forEach((icon: HTMLElement) => {
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('provides an accessible name for the peer progress value', () => {
    load(of(NORMAL_STATE));
    fixture.detectChanges();

    const value = fixture.nativeElement.querySelector(
      '[aria-label="Peer completion progress at your target grade"]',
    );

    expect(value).toBeTruthy();
    expect(value.textContent).toContain('10%');
  });

  it('keeps the visible summary concise while retaining cohort context for assistive technology', () => {
    load(of(NORMAL_STATE));

    const summary = fixture.nativeElement.querySelector('.ppi-value') as HTMLElement;
    const progress = fixture.nativeElement.querySelector('.ppi-track') as HTMLElement;

    expect(summary.querySelector('strong')?.textContent).toBe('10%');
    expect(summary.querySelector('span')?.textContent).toBe('of peers have completed this task');
    expect(summary.textContent).not.toContain('target grade');
    expect(progress.getAttribute('aria-label')).toBe(
      '10% of peers at your target grade have completed this task',
    );
  });

  it('uses a compact accessible switch for the optional detailed panel', () => {
    load(of(NORMAL_STATE));

    const toggle = fixture.nativeElement.querySelector(
      'button[role="switch"]',
    ) as HTMLButtonElement;
    expect(toggle.getAttribute('aria-label')).toBe('Advanced peer status breakdown');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('.ppi-advanced')).toBeNull();

    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Advanced peer status breakdown');
    expect(fixture.nativeElement.querySelector('.ppi-advanced')).toBeTruthy();
  });

  it('reveals the full non-zero status distribution through the Advanced switch', () => {
    load(of(NORMAL_STATE));

    component.setAdvanced(true);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Task status breakdown');
    expect(text).toContain('Redo');
    expect(text).toContain('Resubmit');
    expect(fixture.nativeElement.querySelector('.ppi-distribution')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.ppi-independent')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.ppi-legend li').length).toBe(7);
    expect(
      Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.ppi-name')).map((label) =>
        label.textContent.trim(),
      ),
    ).toEqual([
      'Not Started',
      'Working On It',
      'Ready for Feedback',
      'Resubmit',
      'Redo',
      'Complete',
      'Fail',
    ]);
  });

  it.each([
    {state: ROUNDED_90_STATE, total: 90},
    {state: ROUNDED_110_STATE, total: 110},
  ])('does not visually renormalise a privacy-rounded $total% vector', ({state, total}) => {
    load(of(state));

    component.setAdvanced(true);
    fixture.detectChanges();

    const independent = fixture.nativeElement.querySelector('.ppi-independent');
    const workingFill = fixture.nativeElement.querySelector(
      '[data-status="working_on_it"] .ppi-independent__fill',
    ) as HTMLElement;
    const workingTrack = fixture.nativeElement.querySelector(
      '[data-status="working_on_it"] [role="progressbar"]',
    ) as HTMLElement;

    expect(component.distributionTotal).toBe(total);
    expect(fixture.nativeElement.querySelector('.ppi-distribution')).toBeNull();
    expect(independent.textContent).toContain(`total ${total}%`);
    expect(independent.textContent).toContain('not stretched to fill 100%');
    expect(workingFill.style.width).toBe('20%');
    expect(workingTrack.getAttribute('aria-valuenow')).toBe('20');
    expect(workingTrack.getAttribute('aria-describedby')).toBe(component.independentScaleNoticeId);
  });

  it('keeps the compact value while explaining a privacy-withheld detailed vector', () => {
    load(of(DETAIL_PROTECTED_STATE));

    component.setAdvanced(true);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('10%');
    expect(text).toContain('Detailed breakdown protected');
    expect(text).not.toContain('Redo');
    expect(fixture.nativeElement.querySelector('.ppi-distribution')).toBeNull();
  });
});
