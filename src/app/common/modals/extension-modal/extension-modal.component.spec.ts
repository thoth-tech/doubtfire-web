import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {LOCALE_ID} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ReactiveFormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {provideNativeDateAdapter} from '@angular/material/core';
import {MatDatepickerInputEvent, MatDatepickerModule} from '@angular/material/datepicker';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {of, throwError} from 'rxjs';
import {Task, TaskCommentService} from 'src/app/api/models/doubtfire-model';
import {AlertService} from '../../services/alert.service';
import {ExtensionModalComponent} from './extension-modal.component';

function buildTask(
  dueDate = new Date('2026-09-01T00:00:00Z'),
  deadlineDate = new Date('2026-10-01T00:00:00Z'),
): Task {
  return {
    definition: {abbreviation: '1.1P', name: 'Hello World'},
    localDueDate: () => dueDate,
    localDeadlineDate: () => deadlineDate,
  } as unknown as Task;
}

function pickDate(component: ExtensionModalComponent, value: Date | null): void {
  component.addEvent('input', {value} as MatDatepickerInputEvent<Date>);
}

function buildComponent(requestExtension = vi.fn(() => of({})), task = buildTask()) {
  const close = vi.fn();
  const afterApplication = vi.fn();
  const alerts = {success: vi.fn(), error: vi.fn()};
  const component = new ExtensionModalComponent(
    {close} as unknown as MatDialogRef<ExtensionModalComponent>,
    {task, afterApplication},
    'en-AU',
    alerts as unknown as AlertService,
    {requestExtension} as unknown as TaskCommentService,
  );

  return {component, close, afterApplication, requestExtension, alerts, task};
}

describe('ExtensionModalComponent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('closes without prompting while pristine and confirms before discarding entered text', () => {
    const {component} = buildComponent();
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);

    expect(component.canClose()).toBe(true);

    component.extensionData.controls.extensionReason.setValue(
      'A sufficiently detailed reason for the request',
    );
    component.extensionData.controls.extensionReason.markAsDirty();

    expect(component.canClose()).toBe(false);
    expect(confirm).toHaveBeenCalledWith(
      'Discard this extension request? Your entered details will be lost.',
    );

    confirm.mockReturnValue(true);
    expect(component.canClose()).toBe(true);
  });

  it('keeps the dialog open on a controlled error and closes only after success', () => {
    const failure = buildComponent(
      vi.fn(() => throwError(() => new Error('sensitive transport detail'))),
    );
    failure.component.extensionData.controls.extensionReason.setValue(
      'A sufficiently detailed reason for the request',
    );
    // Submit refuses anything the button would refuse, so the date has to be
    // picked here as it would be on screen. minDate is always in range.
    pickDate(failure.component, failure.component.minDate);

    failure.component.submitApplication();

    expect(failure.close).not.toHaveBeenCalled();
    expect(failure.component.errorMessage).toBe(
      'The extension request could not be sent. Please try again.',
    );
    expect(failure.alerts.error).not.toHaveBeenCalledWith(
      expect.stringContaining('sensitive transport detail'),
      expect.anything(),
    );

    const success = buildComponent();
    success.component.extensionData.controls.extensionReason.setValue(
      'A sufficiently detailed reason for the request',
    );
    pickDate(success.component, success.component.minDate);
    success.component.submitApplication();

    expect(success.requestExtension).toHaveBeenCalled();
    expect(success.afterApplication).toHaveBeenCalled();
    expect(success.close).toHaveBeenCalled();
    expect(success.component.canClose()).toBe(true);
  });

  it('does not throw when the comments panel is not on the page', () => {
    vi.useFakeTimers();
    const component = Object.create(ExtensionModalComponent.prototype) as {
      scrollCommentsDown(): void;
    };

    expect(() => {
      component.scrollCommentsDown();
      vi.runAllTimers();
    }).not.toThrow();

    vi.useRealTimers();
  });
});

// Local dates, so the weekday labels hold in any time zone. 11 Sep 2026 is a Friday.
const DUE = new Date(2026, 8, 11, 23, 59);
const DEADLINE = new Date(2026, 9, 1, 23, 59);
const REASON = 'I was unwell for three days and missed the lab';

describe('ExtensionModalComponent presentation', () => {
  beforeEach(() => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(new Date(2026, 8, 5, 12, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('turns the counter to warning at 230 characters and error at the limit', () => {
    const {component} = buildComponent(undefined, buildTask(DUE, DEADLINE));
    const reason = component.extensionData.controls.extensionReason;

    reason.setValue('a'.repeat(229));
    expect(component.reasonCounterState).toBe('ok');
    reason.setValue('a'.repeat(230));
    expect(component.reasonCounterState).toBe('warn');
    reason.setValue('a'.repeat(256));
    expect(component.reasonCounterState).toBe('limit');
  });

  it('summarises a picked date against the current due date in requested weeks', () => {
    const {component} = buildComponent(undefined, buildTask(DUE, DEADLINE));

    expect(component.extensionSummary).toBe('');

    pickDate(component, new Date(2026, 8, 17));
    expect(component.extensionDays).toBe(6);
    expect(component.extensionSummary).toBe('+1 week · Thu 17 Sep');

    pickDate(component, new Date(2026, 8, 21));
    expect(component.extensionDays).toBe(10);
    expect(component.extensionSummary).toBe('+2 weeks · Mon 21 Sep');
  });

  it('shows the due date, the allowed range and how far past due the task is', () => {
    const onTime = buildComponent(undefined, buildTask(DUE, DEADLINE)).component;
    expect(onTime.formatShortDate(onTime.dueDate)).toBe('Fri 11 Sep');
    expect(onTime.dateRangeText).toBe('Sat 12 Sep to Thu 1 Oct');
    expect(onTime.daysPastDue).toBe(0);

    vi.setSystemTime(new Date(2026, 8, 20, 12, 0));
    const late = buildComponent(undefined, buildTask(DUE, DEADLINE)).component;
    expect(late.daysPastDue).toBe(8);
  });

  it('requests the earliest date without a pick once the final deadline has passed', () => {
    vi.setSystemTime(new Date(2026, 9, 3, 12, 0));
    const {component} = buildComponent(undefined, buildTask(DUE, DEADLINE));

    expect(component.hasDateRange).toBe(false);
    expect(component.dateRangeText).toBe('');
    expect(component.extensionSummary).toBe('+4 weeks · Sun 4 Oct');

    component.extensionData.controls.extensionReason.setValue(REASON);
    expect(component.canSubmit).toBe(true);
  });

  it('refuses a date typed past the final deadline instead of sending it', () => {
    // The out-of-range check used to return true outright once there was no
    // range, so a typed 1 Jan 2030 went out as a 173 week request.
    vi.setSystemTime(new Date(2026, 9, 3, 12, 0));
    const {component, requestExtension} = buildComponent(undefined, buildTask(DUE, DEADLINE));
    component.extensionData.controls.extensionReason.setValue(REASON);

    pickDate(component, new Date(2030, 0, 1));

    // The date never lands, so nothing downstream can be derived from it.
    expect(component.extensionSummary).toBe('+4 weeks · Sun 4 Oct');
    expect(component.isDateInRange).toBe(true);
    expect(component.dateNeedsAttention).toBe(false);

    component.submitApplication();
    expect(requestExtension).toHaveBeenCalledWith(REASON, 4, expect.anything());
  });

  it('holds the earliest date even if the guard is the only thing left', () => {
    // Belt to the braces above: if the field is ever re-enabled, this is what
    // stops a far-future date being requested.
    vi.setSystemTime(new Date(2026, 9, 3, 12, 0));
    const {component} = buildComponent(undefined, buildTask(DUE, DEADLINE));

    (component as unknown as {extensionDate: Date}).extensionDate = new Date(2030, 0, 1);
    expect(component.isDateInRange).toBe(false);
    expect(component.dateErrorText).toBe(
      'The final deadline has passed, so only the earliest date can be requested',
    );
  });

  it('never names a date range that resolved to nothing', () => {
    // A task with no deadline leaves hasDateRange true and dateRangeText empty,
    // which is the pair that used to render "Pick a date from ." and no hint.
    const {component} = buildComponent(undefined, buildTask(DUE, null as unknown as Date));

    expect(component.hasDateRange).toBe(true);
    expect(component.dateRangeText).toBe('');
    expect(component.dateErrorText).toBe('Pick a date on or after Sat 12 Sep');
  });

  it('keeps submit disabled until the reason and a date in range are both valid', () => {
    const {component} = buildComponent(undefined, buildTask(DUE, DEADLINE));

    expect(component.canSubmit).toBe(false);
    component.extensionData.controls.extensionReason.setValue(REASON);
    expect(component.canSubmit).toBe(false);

    pickDate(component, new Date(2026, 9, 20));
    expect(component.dateNeedsAttention).toBe(true);
    expect(component.canSubmit).toBe(false);

    pickDate(component, null);
    expect(component.canSubmit).toBe(false);

    pickDate(component, new Date(2026, 8, 17));
    expect(component.canSubmit).toBe(true);

    component.submitting = true;
    expect(component.canSubmit).toBe(false);
  });
});

describe('ExtensionModalComponent template', () => {
  let fixture: ComponentFixture<ExtensionModalComponent>;
  let component: ExtensionModalComponent;

  beforeEach(async () => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(new Date(2026, 8, 20, 12, 0));

    await TestBed.configureTestingModule({
      declarations: [ExtensionModalComponent],
      imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatDatepickerModule,
        MatDialogModule,
        MatIconModule,
        MatInputModule,
        MatProgressSpinnerModule,
      ],
      providers: [
        provideNativeDateAdapter(),
        {provide: MatDialogRef, useValue: {close: vi.fn()}},
        {provide: MAT_DIALOG_DATA, useValue: {task: buildTask(DUE, DEADLINE)}},
        {provide: LOCALE_ID, useValue: 'en-US'},
        {provide: AlertService, useValue: {success: vi.fn(), error: vi.fn()}},
        {provide: TaskCommentService, useValue: {requestExtension: vi.fn(() => of({}))}},
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExtensionModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const submitButton = () => el().querySelector<HTMLButtonElement>('button.ext-submit');

  it('renders the title, task context, past due callout and new copy', () => {
    expect(el().querySelector('[mat-dialog-title]')?.textContent?.trim()).toBe(
      'Request an extension',
    );
    expect(el().querySelector('.ext-context')?.textContent).toContain('1.1P');
    expect(el().querySelector('.ext-context')?.textContent).toContain('Hello World');
    expect(el().querySelector('.ext-context__due')?.textContent?.trim()).toContain(
      'Due Fri 11 Sep',
    );
    expect(el().querySelector('.ext-callout')?.textContent?.replace(/\s+/g, ' ').trim()).toContain(
      'This task is 8 days past its due date',
    );
    expect(el().querySelector('.ext-description')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      "Tell your teaching team why you need more time. They'll review your request and reply in the task comments.",
    );
  });

  it('labels the primary action without the date and enables it once valid', () => {
    expect(submitButton()?.textContent?.trim()).toBe('send Request extension');
    expect(submitButton()?.disabled).toBe(true);

    component.extensionData.controls.extensionReason.setValue(REASON);
    pickDate(component, new Date(2026, 8, 25));
    fixture.detectChanges();

    expect(submitButton()?.disabled).toBe(false);
    expect(el().querySelector('.ext-summary')?.textContent?.trim()).toBe('+2 weeks · Fri 25 Sep');
  });

  it('marks the counter as a warning from 230 characters', () => {
    const counter = () => el().querySelector('.ext-counter');
    component.extensionData.controls.extensionReason.setValue('a'.repeat(230));
    fixture.detectChanges();

    expect(counter()?.textContent?.trim()).toBe('230 / 256');
    expect(counter()?.classList).toContain('ext-counter--warn');
  });

  it('shows a spinner and disables both actions while submitting', () => {
    component.submitting = true;
    fixture.detectChanges();

    expect(el().querySelector('.ext-submit__spinner')).not.toBeNull();
    const buttons = Array.from(
      el().querySelectorAll<HTMLButtonElement>('.task-dialog-actions button'),
    );
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });
});

describe('ExtensionModalComponent template past the final deadline', () => {
  let fixture: ComponentFixture<ExtensionModalComponent>;

  beforeEach(async () => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(new Date(2026, 9, 3, 12, 0));

    await TestBed.configureTestingModule({
      declarations: [ExtensionModalComponent],
      imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatDatepickerModule,
        MatDialogModule,
        MatIconModule,
        MatInputModule,
        MatProgressSpinnerModule,
      ],
      providers: [
        provideNativeDateAdapter(),
        {provide: MatDialogRef, useValue: {close: vi.fn()}},
        {provide: MAT_DIALOG_DATA, useValue: {task: buildTask(DUE, DEADLINE)}},
        {provide: LOCALE_ID, useValue: 'en-US'},
        {provide: AlertService, useValue: {success: vi.fn(), error: vi.fn()}},
        {provide: TaskCommentService, useValue: {requestExtension: vi.fn(() => of({}))}},
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExtensionModalComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('closes the date field rather than leaving it open over an empty range', () => {
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector<HTMLInputElement>('.ext-date input');
    const toggle = el.querySelector<HTMLButtonElement>('mat-datepicker-toggle button');

    expect(fixture.componentInstance.hasDateRange).toBe(false);
    expect(input?.disabled).toBe(true);
    // Disabling the input carries the picker and its toggle, so there is no way
    // in through the calendar either.
    expect(toggle?.disabled).toBe(true);
    expect(el.querySelector('.ext-date mat-hint')?.textContent).toContain(
      'The final deadline has passed',
    );
  });
});
