import {afterEach, describe, expect, it, vi} from 'vitest';
import {TestKey} from '@angular/cdk/testing';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {TestBed} from '@angular/core/testing';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
import {MatSelectHarness} from '@angular/material/select/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {of} from 'rxjs';
import {CampusService} from 'src/app/api/models/doubtfire-model';
import {AlertService} from 'src/app/common/services/alert.service';
import {StudentCampusSelectComponent} from './student-campus-select.component';

async function render() {
  const burwood = {id: 1, name: 'Burwood'};
  const student = {
    campus: null,
    student: {name: 'Zoe Adams'},
    switchToCampus: vi.fn(() => of({campus: burwood, student: {name: 'Zoe Adams'}})),
  };
  const alerts = {success: vi.fn(), error: vi.fn()};

  await TestBed.configureTestingModule({
    declarations: [StudentCampusSelectComponent],
    imports: [MatFormFieldModule, MatSelectModule, NoopAnimationsModule],
    providers: [
      {provide: CampusService, useValue: {query: () => of([burwood])}},
      {provide: AlertService, useValue: alerts},
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(StudentCampusSelectComponent);
  fixture.componentInstance.student = student as never;
  fixture.componentInstance.update = true;
  fixture.componentInstance.ngOnChanges();
  fixture.detectChanges();

  const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);
  return {select, student, burwood, alerts};
}

describe('StudentCampusSelectComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('names whose campus the picker holds', async () => {
    const {select} = await render();

    expect(await (await select.host()).getAttribute('aria-label')).toBe('Campus for Zoe Adams');
  });

  it('moves the student when a campus is picked with the keyboard', async () => {
    const {select, student, burwood, alerts} = await render();

    await select.open();
    const host = await select.host();
    await host.sendKeys(TestKey.DOWN_ARROW);
    await host.sendKeys(TestKey.ENTER);

    expect(student.switchToCampus).toHaveBeenCalledWith(burwood);
    expect(alerts.success).toHaveBeenCalled();
  });
});
