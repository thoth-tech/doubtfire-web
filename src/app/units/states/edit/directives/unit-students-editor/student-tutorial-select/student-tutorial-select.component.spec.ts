import {afterEach, describe, expect, it, vi} from 'vitest';
import {TestKey} from '@angular/cdk/testing';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {TestBed} from '@angular/core/testing';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
import {MatSelectHarness} from '@angular/material/select/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {Tutorial} from 'src/app/api/models/tutorial/tutorial';
import {Unit} from 'src/app/api/models/unit';
import {StudentTutorialSelectComponent} from './student-tutorial-select.component';

async function render() {
  const unit = Object.assign(new Unit(), {id: 3});
  const tutorial = Object.assign(new Tutorial(unit), {id: 4, abbreviation: 'LA1-01'});
  unit.tutorialsCache.add(tutorial);
  const student = {
    campus: null,
    tutorials: [],
    student: {name: 'Zoe Adams'},
    switchToTutorial: vi.fn(),
  };

  await TestBed.configureTestingModule({
    declarations: [StudentTutorialSelectComponent],
    imports: [MatFormFieldModule, MatSelectModule, NoopAnimationsModule],
  }).compileComponents();

  const fixture = TestBed.createComponent(StudentTutorialSelectComponent);
  fixture.componentInstance.unit = unit;
  fixture.componentInstance.student = student as never;
  fixture.detectChanges();

  const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);
  return {select, student, tutorial};
}

describe('StudentTutorialSelectComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('names whose tutorials the picker holds', async () => {
    const {select} = await render();

    expect(await (await select.host()).getAttribute('aria-label')).toBe('Tutorials for Zoe Adams');
  });

  // Tutorials were changed on the option's click, so picking one with the keyboard
  // did nothing at all.
  it('moves the student when a tutorial is picked with the keyboard', async () => {
    const {select, student, tutorial} = await render();

    await select.open();
    await (await select.host()).sendKeys(TestKey.ENTER);

    expect(student.switchToTutorial).toHaveBeenCalledWith(tutorial);
  });

  it('moves the student when a tutorial is picked with the mouse', async () => {
    const {select, student, tutorial} = await render();

    await select.open();
    await (await select.getOptions({text: 'LA1-01'}))[0].click();

    expect(student.switchToTutorial).toHaveBeenCalledWith(tutorial);
  });

  // The list redrawing after an enrolment is not the user picking anything.
  it('ignores selection changes the user did not make', () => {
    const picker = new StudentTutorialSelectComponent();
    const student = {switchToTutorial: vi.fn()};
    picker.student = student as never;

    picker.tutorialPicked({isUserInput: false} as never, {id: 4} as never);

    expect(student.switchToTutorial).not.toHaveBeenCalled();
  });
});
