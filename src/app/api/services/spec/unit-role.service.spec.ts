import { TestBed, tick, fakeAsync } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UnitRole, User, Unit } from 'src/app/api/models/doubtfire-model';
import { UnitRoleService } from '../unit-role.service';
import { HttpRequest } from '@angular/common/http';

describe('CampusService', () => {
  let unitRoleService: UnitRoleService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UnitRoleService],
    });

    unitRoleService = TestBed.inject(UnitRoleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should return expected campuses (HttpClient called once)', fakeAsync(() => {
    const ur = new UnitRole();

    ur.role = 'tutor';

    ur.user = new User();
    ur.user.id = 1;
    ur.user.lastName = 'j';
    ur.user.firstName = 'Jay';
    ur.user.nickname = 'jay';
    ur.user.hasRunFirstTimeSetup = false;
    ur.user.email = 'jay@jay.jay';
    ur.user.studentId = '1';
    ur.user.username = 'test';
    ur.user.optInToResearch = true;
    ur.user.receivePortfolioNotifications = false;
    ur.user.receiveFeedbackNotifications = false;
    ur.user.receiveTaskNotifications = false;
    ur.unit = new Unit();

    const expectedUnitRoles: UnitRole[] = [ur];

    unitRoleService
      .query()
      .subscribe((unit_roles) => expect(unit_roles).toEqual(expectedUnitRoles, 'expected unit_roles'));

    const req = httpMock.expectOne((request: HttpRequest<any>): boolean => {
      expect(request.url).toEqual('http://localhost:3000/api/unit_roles/');
      expect(request.method).toBe('GET');
      return true;
    });

    ur.id = 1;
    req.flush(ur);

    tick();
  }));
});
