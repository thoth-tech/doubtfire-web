import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Group, Unit } from 'src/app/api/models/doubtfire-model';
import { GroupService } from '../group.service';
import { HttpRequest } from '@angular/common/http';

describe('GroupService', () => {
  let groupService: GroupService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [GroupService]
    });

    groupService = TestBed.inject(GroupService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should return expected group (HttpClient called once)', fakeAsync(() => {
    const dummyUnit = new Unit();
    const g = new Group(dummyUnit);

    g.id = 1;
    g.name = 'Group 1';
    g.capacityAdjustment = 10;
    g.locked = false;
    g.studentCount = 15;

    const expectedGroups: Group[] = [g];

    const mockUnitId = 1;
    const mockGroupSetId = 2;
    groupService
      .query({ unitId: mockUnitId, groupSetId: mockGroupSetId })
      .subscribe(groups => expect(groups).toEqual(expectedGroups, 'expected groups'));

    const req = httpMock.expectOne((request: HttpRequest<any>): boolean => {
      expect(request.url).toEqual(`http://localhost:3000/api/units/${mockUnitId}/group_sets/${mockGroupSetId}/groups/`);
      expect(request.method).toBe('GET');
      return true;
    });

    req.flush([g]);

    tick();
  }));
});
