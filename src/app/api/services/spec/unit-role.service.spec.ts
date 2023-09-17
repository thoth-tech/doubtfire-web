import { TestBed, tick, fakeAsync } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UnitRole, User, Unit } from 'src/app/api/models/doubtfire-model';
import { UnitRoleService } from '../unit-role.service';
import { HttpRequest } from '@angular/common/http';

describe('UnitRoleService', () => {
  // Updated the describe block name to match the service being tested
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

  it('should return expected unit roles (HttpClient called once)', fakeAsync(() => {
    // Updated the test description
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
      .subscribe((unitRoles) => expect(unitRoles).toEqual(expectedUnitRoles, 'expected unit roles'));

    const req = httpMock.expectOne((request: HttpRequest<any>): boolean => {
      expect(request.url).toEqual('http://localhost:3000/api/unit_roles/');
      expect(request.method).toBe('GET');
      return true;
    });

    ur.id = 1;
    req.flush([ur]); // Updated to pass an array of unit roles

    tick();
  }));
});
