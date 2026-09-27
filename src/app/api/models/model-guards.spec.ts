import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Observable, throwError} from 'rxjs';
import {ProjectService} from 'src/app/api/services/project.service';
import {AlertService} from 'src/app/common/services/alert.service';
import {provideAppInjectorForTests} from 'src/app/testing/app-injector-stub';
import {Project} from './project';
import {Tutorial} from './tutorial/tutorial';
import {Unit} from './unit';

describe('Project.isEnrolledIn', () => {
  it('is false for a group left without a tutorial, instead of throwing', () => {
    const project = new Project(new Unit());

    expect(project.isEnrolledIn(undefined)).toBe(false);
  });
});

describe('Tutorial.description', () => {
  it('still describes a tutorial saved without a meeting day', () => {
    const tutorial = new Tutorial(new Unit());
    tutorial.meetingTime = '10:00';
    tutorial.meetingLocation = 'Room 4';

    expect(tutorial.description).toBe('No day set at 10:00 by  in Room 4');
  });
});

// The models look their services up through AppInjector. Each test registers its
// stand-ins with the shared spec stub.
const projectService: {loadStudents?: unknown; update?: unknown} = {};
const alerts = {error: vi.fn(), success: vi.fn()};

beforeEach(() => {
  provideAppInjectorForTests([
    [ProjectService, projectService],
    [AlertService, alerts],
  ]);
});

describe('Unit.refreshStudents', () => {
  it('sends the request, which it used to build and never subscribe to', () => {
    let subscribed = false;
    const loadStudents = vi.fn(
      () =>
        new Observable<Project[]>(() => {
          subscribed = true;
        }),
    );
    projectService.loadStudents = loadStudents;

    const unit = new Unit();
    unit.refreshStudents(true);

    expect(loadStudents).toHaveBeenCalledWith(unit, true, true);
    expect(subscribed).toBe(true);
  });
});

describe('Project.assignGrade', () => {
  it('puts back the old rationale as well as the old grade when the save fails', () => {
    projectService.update = vi.fn(() => throwError(() => 'no connection'));
    const project = new Project(new Unit());
    project.grade = 70;
    project.gradeRationale = 'Met every distinction criterion.';

    project.assignGrade(80, 'Now meets the high distinction criteria.');

    expect(project.grade).toBe(70);
    expect(project.gradeRationale).toBe('Met every distinction criterion.');
    expect(alerts.error).toHaveBeenCalled();
  });
});
