import {NO_ERRORS_SCHEMA} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatCardModule} from '@angular/material/card';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {MatSliderModule} from '@angular/material/slider';
import {MatTooltipModule} from '@angular/material/tooltip';
import {GradeService} from 'src/app/common/services/grade.service';
import {expectAccessible} from 'src/app/common/testing/accessibility';
import {GradeTaskModalComponent} from './grade-task-modal.component';

describe('GradeTaskModalComponent rendered accessibility', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GradeTaskModalComponent],
      imports: [
        FormsModule,
        MatButtonModule,
        MatButtonToggleModule,
        MatCardModule,
        MatDialogModule,
        MatSliderModule,
        MatTooltipModule,
      ],
      providers: [
        {
          provide: GradeService,
          useValue: {
            allGradeValuesFor: () => [1, 2],
            gradeLabel: (grade: number) => (grade === 1 ? 'Pass' : 'Credit'),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('names the real dialog, grade group and quality slider without invalid ID references', async () => {
    const ref = TestBed.inject(MatDialog).open(GradeTaskModalComponent, {
      data: {
        task: {
          grade: 1,
          qualityPts: 2,
          unit: {},
          definition: {isGraded: true, maxQualityPts: 5, abbreviation: 'DEMO'},
        },
      },
    });
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
    const dialog = document.querySelector('mat-dialog-container')!;
    await expectAccessible(dialog as HTMLElement);
    const titleId = dialog.getAttribute('aria-labelledby')!;
    expect(document.getElementById(titleId)?.textContent).toContain('Assess task quality');
    expect(dialog.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe(
      'Task grade',
    );
    const options = dialog.querySelectorAll('mat-button-toggle button');
    expect([...options].map((option) => option.getAttribute('aria-label'))).toEqual([
      'Mark task as Pass',
      'Mark task as Credit',
    ]);
    for (const described of dialog.querySelectorAll('[aria-describedby]')) {
      for (const id of described.getAttribute('aria-describedby')!.split(/\s+/)) {
        expect(document.getElementById(id)).not.toBeNull();
      }
    }
    const slider = dialog.querySelector<HTMLInputElement>('input[matSliderThumb]')!;
    expect(slider.getAttribute('aria-label')).toBe('Task quality rating');
    expect(slider.getAttribute('aria-valuetext')).toBe('2 out of 5');
    ref.componentInstance.updateRating(0);
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
    expect(slider.getAttribute('aria-valuetext')).toBe('0 out of 5');
    expect(ref.componentInstance.isValid()).toBeTruthy();
  });
});
