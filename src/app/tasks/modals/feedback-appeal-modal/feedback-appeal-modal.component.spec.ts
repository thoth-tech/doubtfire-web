import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogConfig,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {of, throwError} from 'rxjs';
import {Task} from 'src/app/api/models/task';
import {TaskService} from 'src/app/api/services/task.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {FeedbackAppealModalComponent} from './feedback-appeal-modal.component';
import {FeedbackAppealModalService} from './feedback-appeal-modal.service';

function buildComponent(requestFeedbackReview = vi.fn(() => of({}))) {
  const close = vi.fn();
  const addComment = vi.fn();
  const task = {
    definition: {abbreviation: '1.1P', name: 'Hello World'},
    project: {escalationAttemptsRemaining: 3},
    requestFeedbackReview,
    addComment,
  } as unknown as Task;
  const alerts = {success: vi.fn(), error: vi.fn()};
  const notifyStatusChange = vi.fn();
  const component = new FeedbackAppealModalComponent(
    {close} as unknown as MatDialogRef<FeedbackAppealModalComponent>,
    {task},
    alerts as unknown as AlertService,
    {notifyStatusChange} as unknown as TaskService,
  );
  component.ngOnInit();

  return {component, close, addComment, requestFeedbackReview, notifyStatusChange, alerts};
}

describe('FeedbackAppealModalComponent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('confirms dirty dismissal but lets a pristine dialog close', () => {
    const {component} = buildComponent();
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);

    expect(component.canClose()).toBe(true);
    component.reviewComment = 'Please review this criterion';
    expect(component.canClose()).toBe(false);
    expect(confirm).toHaveBeenCalled();
  });

  it('turns the counter to warning at 900 characters and error at the limit', () => {
    const {component} = buildComponent();

    component.reviewComment = 'a'.repeat(899);
    expect(component.commentCounterState).toBe('ok');
    component.reviewComment = 'a'.repeat(900);
    expect(component.commentCounterState).toBe('warn');
    component.reviewComment = 'a'.repeat(1000);
    expect(component.commentCounterState).toBe('limit');
  });

  it('submits trimmed text once and keeps controlled failures open', () => {
    const success = buildComponent();
    success.component.reviewComment = '  Please review criterion one.  ';
    success.component.submit();

    expect(success.requestFeedbackReview).toHaveBeenCalledTimes(1);
    expect(success.notifyStatusChange).toHaveBeenCalledTimes(1);
    expect(success.addComment).toHaveBeenCalledWith('Please review criterion one.');
    expect(success.close).toHaveBeenCalledTimes(1);

    const failure = buildComponent(
      vi.fn(() => throwError(() => new Error('sensitive transport detail'))),
    );
    failure.component.reviewComment = 'Please review criterion two.';
    failure.component.submit();

    expect(failure.close).not.toHaveBeenCalled();
    expect(failure.component.errorMessage).toBe(
      'The feedback review request could not be sent. Please try again.',
    );
  });
});

describe('FeedbackAppealModalComponent template', () => {
  let fixture: ComponentFixture<FeedbackAppealModalComponent>;
  let component: FeedbackAppealModalComponent;

  beforeEach(async () => {
    const {component: built} = buildComponent();
    await TestBed.configureTestingModule({
      declarations: [FeedbackAppealModalComponent],
      imports: [
        FormsModule,
        MatButtonModule,
        MatDialogModule,
        MatIconModule,
        MatInputModule,
        MatProgressSpinnerModule,
      ],
      providers: [
        {provide: MatDialogRef, useValue: {close: vi.fn()}},
        {provide: MAT_DIALOG_DATA, useValue: built.data},
        {provide: AlertService, useValue: {success: vi.fn(), error: vi.fn()}},
        {provide: TaskService, useValue: {notifyStatusChange: vi.fn()}},
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FeedbackAppealModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const submitButton = () => el().querySelector<HTMLButtonElement>('button.review-submit');

  it('renders the title, task context, description and allowance callout', () => {
    expect(text('[mat-dialog-title]')).toBe('Request a feedback review');
    expect(text('.review-chip')).toBe('1.1P');
    expect(text('.review-context__name')).toBe('Hello World');
    expect(text('.review-description')).toBe(
      'Another tutor will reassess the feedback on this task and confirm or revise it.',
    );
    expect(text('.review-callout__text')).toBe(
      "You have 3 review requests left for this unit. If the feedback is revised, this one won't count. Review decisions are final once resolved.",
    );
    expect(text('.review-callout b')).toBe('3 review requests');
  });

  it('labels the primary action and enables it once a reason is entered', async () => {
    expect(text('button.review-submit')).toBe('rate_review Submit review request');
    expect(submitButton()?.disabled).toBe(true);

    component.reviewComment = 'Section 3 covers the missing test cases.';
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(submitButton()?.disabled).toBe(false);
  });

  it('marks the counter as a warning from 900 characters', async () => {
    component.reviewComment = 'a'.repeat(900);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text('.review-counter')).toBe('900 / 1000');
    expect(el().querySelector('.review-counter')?.classList).toContain('review-counter--warn');
  });

  it('shows a spinner and disables both actions while submitting', () => {
    component.submitting = true;
    fixture.detectChanges();

    expect(el().querySelector('.review-submit__spinner')).not.toBeNull();
    const buttons = Array.from(
      el().querySelectorAll<HTMLButtonElement>('.feedback-review-actions button'),
    );
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });
});

describe('FeedbackAppealModalService', () => {
  it('uses the shared responsive/focus-safe dialog contract', () => {
    const dialogRef = {};
    const open = vi.fn((_component: unknown, _config: MatDialogConfig) => dialogRef);
    const service = new FeedbackAppealModalService({open} as unknown as MatDialog);

    expect(service.show({} as Task)).toBe(dialogRef);
    const config = open.mock.calls[0][1] as MatDialogConfig;

    expect(config).toMatchObject({
      autoFocus: 'dialog',
      closeOnNavigation: true,
      maxHeight: 'calc(100dvh - 2rem)',
      maxWidth: '560px',
      restoreFocus: true,
      width: 'calc(100vw - 2rem)',
    });
    expect(config.position).toBeUndefined();
    expect(
      config.closePredicate(undefined, config, {
        canClose: () => false,
      } as unknown as FeedbackAppealModalComponent),
    ).toBe(false);
  });
});
