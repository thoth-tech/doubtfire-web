import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CommonModule} from '@angular/common';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {Observable, Subject, of, throwError} from 'rxjs';
import {Project} from 'src/app/api/models/project';
import {Unit} from 'src/app/api/models/unit';
import {ProjectService} from 'src/app/api/services/project.service';
import {UserService} from 'src/app/api/services/user.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {GradeService} from 'src/app/common/services/grade.service';
import {PortfoliosAssessmentComponent} from './portfolios-assessment.component';

interface ProjectStub {
  id: number;
  grade: number | null;
  gradeRationale: string | null;
}

describe('PortfoliosAssessmentComponent', () => {
  let fixture: ComponentFixture<PortfoliosAssessmentComponent>;
  let project: ProjectStub;
  let update: ReturnType<typeof vi.fn>;
  let alerts: {success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>};

  beforeEach(async () => {
    update = vi.fn((): Observable<unknown> => of(project));
    alerts = {success: vi.fn(), error: vi.fn()};

    await TestBed.configureTestingModule({
      declarations: [PortfoliosAssessmentComponent],
      imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        NoopAnimationsModule,
      ],
      providers: [
        GradeService,
        {provide: ProjectService, useValue: {update}},
        {provide: AlertService, useValue: alerts},
        {provide: UserService, useValue: {currentUser: {id: 7}}},
      ],
    }).compileComponents();
  });

  async function render(grade: number | null, gradeRationale: string | null): Promise<void> {
    project = {id: 5, grade, gradeRationale};
    await show();
  }

  // A fresh tab on the same project, as when the tutor comes back to it.
  async function show(): Promise<void> {
    fixture = TestBed.createComponent(PortfoliosAssessmentComponent);
    fixture.componentRef.setInput('project', project as unknown as Project);
    fixture.componentRef.setInput('unit', {gradeDefinitions: []} as unknown as Unit);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function scoreButton(score: number): HTMLButtonElement {
    return Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('fieldset button'),
    ).find((button) => button.textContent.trim() === String(score));
  }

  function pressedScores(): string[] {
    return Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('fieldset button[aria-pressed="true"]'),
    ).map((button) => button.textContent.trim());
  }

  function saveButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('footer button');
  }

  function typeRationale(text: string): void {
    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    textarea.value = text;
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function sentBody(): unknown {
    return update.mock.calls.at(-1)[1].body;
  }

  // Every project starts at 0, which the old screen showed as the chosen score.
  it('shows no score as chosen for a student nobody has graded', async () => {
    await render(0, null);

    expect(pressedScores()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Not graded');
  });

  // Save on an ungraded student sent the starting 0 as a fail.
  it('does not let save record a grade nobody chose', async () => {
    await render(0, null);
    typeRationale('Strong portfolio');

    expect(saveButton().disabled).toBe(true);
    saveButton().click();
    expect(update).not.toHaveBeenCalled();
  });

  it('waits for a rationale before a score can be chosen', async () => {
    await render(0, null);

    expect(scoreButton(75).disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Write a rationale before you choose');
  });

  it('saves the chosen score with the rationale straight away', async () => {
    await render(0, null);
    typeRationale('Meets every outcome at D');

    scoreButton(75).click();
    fixture.detectChanges();

    expect(sentBody()).toEqual({
      grade: 75,
      old_grade: 0,
      grade_rationale: 'Meets every outcome at D',
    });
    expect(alerts.success).toHaveBeenCalledWith('Grade updated.');
    expect(pressedScores()).toEqual(['75']);
    expect(fixture.nativeElement.textContent).toContain('Distinction');
  });

  it('saves a new rationale against the grade already given', async () => {
    await render(83, 'First pass');
    expect(pressedScores()).toEqual(['83']);

    typeRationale('Second pass, after moderation');
    saveButton().click();

    expect(sentBody()).toEqual({
      grade: 83,
      old_grade: 83,
      grade_rationale: 'Second pass, after moderation',
    });
  });

  // The project's own save put back the grade but kept the new rationale, so a first
  // grade that failed looked like a saved 0, and Save would then record that 0 as a fail.
  it('puts the student back to not graded when their first grade fails', async () => {
    update.mockReturnValue(throwError(() => 'offline'));
    await render(0, null);
    typeRationale('Meets every outcome at D');

    scoreButton(75).click();
    fixture.detectChanges();

    expect(project).toEqual({id: 5, grade: 0, gradeRationale: null});
    expect(pressedScores()).toEqual([]);
    expect(saveButton().disabled).toBe(true);
    expect(alerts.error).toHaveBeenCalledWith('Grade was not updated: offline');
    expect(scoreButton(75).disabled).toBe(false);
  });

  it('keeps the rationale to try again when a rationale save fails', async () => {
    update.mockReturnValue(throwError(() => 'offline'));
    await render(83, 'First pass');

    typeRationale('Second pass');
    saveButton().click();
    fixture.detectChanges();

    expect(project.gradeRationale).toBe('First pass');
    expect(fixture.nativeElement.querySelector('textarea').value).toBe('Second pass');
    expect(saveButton().disabled).toBe(false);
  });

  it('holds the scores while a save is on its way', async () => {
    update.mockReturnValue(new Subject());
    await render(0, null);
    typeRationale('Meets every outcome at D');

    scoreButton(75).click();
    fixture.detectChanges();
    scoreButton(80).click();

    expect(update).toHaveBeenCalledTimes(1);
    expect(scoreButton(80).disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Saving the grade.');
  });

  // The tab is rebuilt when the tutor leaves and comes back, which used to forget that a
  // save was still out and allow a second one to race it.
  it('still holds the scores after the tutor leaves and comes back during a save', async () => {
    update.mockReturnValue(new Subject());
    await render(0, null);
    typeRationale('Meets every outcome at D');
    scoreButton(75).click();
    fixture.destroy();

    await show();
    scoreButton(80).click();

    expect(update).toHaveBeenCalledTimes(1);
    expect(scoreButton(80).disabled).toBe(true);
  });

  // Looking at the portfolio and coming back used to lose what had been typed.
  it('keeps an unsaved rationale when the tutor leaves the tab and comes back', async () => {
    await render(0, null);
    typeRationale('Half written');
    fixture.destroy();

    await show();

    expect(fixture.nativeElement.querySelector('textarea').value).toBe('Half written');
    expect(pressedScores()).toEqual([]);
  });

  it('shows a saved 0 with a rationale as a chosen fail', async () => {
    await render(0, 'Nothing was submitted');

    expect(pressedScores()).toEqual(['0']);
  });

  it('shows one row for each grade band', async () => {
    await render(0, null);

    const bands = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('fieldset p[id] span:first-child'),
    ).map((label) => label.textContent.trim());
    expect(bands).toEqual(['Fail', 'Pass', 'Credit', 'Distinction', 'High Distinction']);
  });
});
