import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {
  DownloadDirection,
  DownloadFilterDialogComponent,
  DownloadFilterDialogData,
} from './download-filter-dialog.component';

const GRADE_LABELS: Record<number, string> = {
  0: 'Pass',
  1: 'Credit',
  2: 'Distinction',
  3: 'High Distinction',
};

function gradeLabel(grade: number): string {
  return GRADE_LABELS[grade];
}

describe('DownloadFilterDialogComponent', () => {
  let component: DownloadFilterDialogComponent;
  let fixture: ComponentFixture<DownloadFilterDialogComponent>;
  let dialogRefStub: {close: ReturnType<typeof vi.fn>};
  let matchingTaskCountStub: ReturnType<
    typeof vi.fn<(grade: number, direction: DownloadDirection, excludeCompleted: boolean) => number>
  >;
  let dialogData: DownloadFilterDialogData;

  function configure(data: DownloadFilterDialogData): void {
    dialogData = data;

    TestBed.resetTestingModule();
    dialogRefStub = {close: vi.fn()};

    TestBed.configureTestingModule({
      declarations: [DownloadFilterDialogComponent],
      imports: [
        FormsModule,
        MatButtonModule,
        MatButtonToggleModule,
        MatCheckboxModule,
        MatDialogModule,
        MatFormFieldModule,
        MatSelectModule,
        NoopAnimationsModule,
      ],
      providers: [
        {provide: MAT_DIALOG_DATA, useValue: dialogData},
        {provide: MatDialogRef, useValue: dialogRefStub},
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DownloadFilterDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    matchingTaskCountStub = vi.fn(() => 1);

    configure({
      gradeValues: [0, 1, 2, 3],
      gradeLabel,
      initialGrade: 2,
      initialDirection: 'upTo',
      initialExcludeCompleted: false,
      matchingTaskCount: matchingTaskCountStub,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the grade select, direction toggle and exclude-completed checkbox', () => {
    expect(fixture.nativeElement.querySelector('mat-select')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('mat-button-toggle-group')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('mat-checkbox')).not.toBeNull();
  });

  it('stacks the direction choices at full width for narrow screens', () => {
    const group: HTMLElement = fixture.nativeElement.querySelector('mat-button-toggle-group');
    const toggles: HTMLElement[] = Array.from(group.querySelectorAll('mat-button-toggle'));

    expect(group.classList.contains('mat-button-toggle-vertical')).toBe(true);
    expect(group.getAttribute('aria-label')).toBe('Grade range');
    expect(toggles).toHaveLength(2);
    toggles.forEach((toggle) => expect(toggle.classList.contains('w-full')).toBe(true));
  });

  it('seeds its selection from the initial values in dialog data', () => {
    expect(component.grade).toBe(2);
    expect(component.direction).toBe('upTo');
    expect(component.excludeCompleted).toBe(false);
  });

  it('labels "up to this grade" as "Everything up to <grade>"', () => {
    component.direction = 'upTo';
    expect(component.directionLabel).toBe('Everything up to Distinction');
  });

  it('labels "this grade and above" as "<grade> and above"', () => {
    component.direction = 'andAbove';
    expect(component.directionLabel).toBe('Distinction and above');
  });

  it('disables confirm and shows a message when the selection matches no tasks', () => {
    matchingTaskCountStub.mockReturnValue(0);
    fixture.detectChanges();

    expect(component.canConfirm).toBe(false);
    const confirmButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      'mat-dialog-actions button[color="primary"]',
    );
    expect(confirmButton.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No tasks match this selection.');
  });

  it('enables confirm when the selection matches at least one task', () => {
    matchingTaskCountStub.mockReturnValue(3);
    fixture.detectChanges();

    expect(component.canConfirm).toBe(true);
    const confirmButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      'mat-dialog-actions button[color="primary"]',
    );
    expect(confirmButton.disabled).toBe(false);
  });

  it('closes the dialog with the current selection when confirmed', () => {
    component.grade = 3;
    component.direction = 'andAbove';
    component.excludeCompleted = true;
    matchingTaskCountStub.mockReturnValue(1);

    component.confirm();

    expect(dialogRefStub.close).toHaveBeenCalledWith({
      grade: 3,
      direction: 'andAbove',
      excludeCompleted: true,
    });
  });

  it('does not close the dialog when confirmed with a zero-match selection', () => {
    // If canConfirm were bypassed, this would still close the dialog and hand back a
    // selection that downloads an empty .ics.
    matchingTaskCountStub.mockReturnValue(0);

    component.confirm();

    expect(dialogRefStub.close).not.toHaveBeenCalled();
  });

  it('closes the dialog with no result when cancelled', () => {
    const cancelButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      'mat-dialog-actions button[type="button"]:not([color="primary"])',
    );
    cancelButton.click();

    expect(dialogRefStub.close).toHaveBeenCalledWith(undefined);
  });
});
