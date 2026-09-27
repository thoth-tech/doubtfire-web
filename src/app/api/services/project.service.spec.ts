import {describe, expect, it, vi} from 'vitest';
import {Observable, Subject, of, throwError} from 'rxjs';
import {Project} from '../models/project';
import {Unit} from '../models/unit';
import {User} from '../models/user/user';
import {ProjectService} from './project.service';

// The api sends a project's user_id, and only a student may read their own user
// record. Staff are refused (403), so a tutor on a student's page had no student at
// all and the moderation notes tab threw on every render.
describe('ProjectService student lookup', () => {
  function serviceWith(getUser: () => Observable<User>): ProjectService {
    const userService = {get: getUser};
    return new ProjectService(
      {} as never,
      {} as never,
      userService as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  function listedProject(unit: Unit, student: User): Project {
    const listed = new Project(unit);
    listed.id = 7;
    listed.student = student;
    return listed;
  }

  const student = {name: 'Chloe Wilson'} as unknown as User;

  it('keeps the user record when the student can read it', () => {
    const service = serviceWith(() => of(student));
    const project = new Project(new Unit());

    project.updateFromJson({id: 7, user_id: 560}, service.mapping);

    expect(project.student).toBe(student);
  });

  it('takes the student from the unit list when staff are refused the user record', () => {
    const service = serviceWith(() => throwError(() => ({status: 403})));
    const unit = new Unit();
    unit.studentCache.add(listedProject(unit, student));
    const loadStudents = vi.spyOn(service, 'loadStudents');
    const project = new Project(unit);

    project.updateFromJson({id: 7, user_id: 560}, service.mapping);

    expect(project.student).toBe(student);
    expect(loadStudents).not.toHaveBeenCalled();
  });

  it('loads the unit list when a staff page has not loaded it yet', () => {
    const service = serviceWith(() => throwError(() => ({status: 403})));
    const unit = new Unit();
    const loadStudents = vi
      .spyOn(service, 'loadStudents')
      .mockReturnValue(of([listedProject(new Unit(), student)]));
    const project = new Project(unit);

    project.updateFromJson({id: 7, user_id: 560}, service.mapping);

    expect(loadStudents).toHaveBeenCalledWith(unit);
    expect(project.student).toBe(student);
  });

  it('shares one student list request between students opened at the same time', () => {
    const service = serviceWith(() => throwError(() => ({status: 403})));
    const unit = new Unit();
    const response: Subject<Project[]> = new Subject();
    const loadStudents = vi.spyOn(service, 'loadStudents').mockReturnValue(response);
    const first = new Project(unit);
    const second = new Project(unit);
    const other = {name: 'Ethan Brown'} as unknown as User;
    const otherListed = new Project(new Unit());
    otherListed.id = 8;
    otherListed.student = other;

    first.updateFromJson({id: 7, user_id: 560}, service.mapping);
    second.updateFromJson({id: 8, user_id: 561}, service.mapping);
    response.next([listedProject(new Unit(), student), otherListed]);
    response.complete();

    expect(loadStudents).toHaveBeenCalledOnce();
    expect(first.student).toBe(student);
    expect(second.student).toBe(other);
  });
});
