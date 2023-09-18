import { TestBed, tick, fakeAsync } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { GroupSet, Unit } from 'src/app/api/models/doubtfire-model';
import { GroupSetService } from '../group-set.service';
import { HttpRequest } from '@angular/common/http';

describe('GroupSetService', () => {
  let groupSetService: GroupSetService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [GroupSetService]
    });

    groupSetService = TestBed.inject(GroupSetService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should return expected group sets (HttpClient called once)', fakeAsync(() => {
    const unit = new Unit();
    unit.id = 1;

    const groupSet = new GroupSet(unit);
    groupSet.id = 1;
    groupSet.name = 'Sample Group Set';
    groupSet.allowStudentsToCreateGroups = true;
    groupSet.allowStudentsToManageGroups = true;
    groupSet.keepGroupsInSameClass = false;
    groupSet.capacity = 30;
    groupSet.locked = false;

    const expectedGroupSets: GroupSet[] = [groupSet];

    groupSetService.query({ unit }).subscribe(groupSets => {
      expect(groupSets).toEqual(expectedGroupSets, 'expected group sets');
    });

    const req = httpMock.expectOne((request: HttpRequest<any>): boolean => {
      expect(request.url).toEqual('http://localhost:3000/api/units/1/group_sets/');
      expect(request.method).toBe('GET');
      return true;
    });

    req.flush([groupSet]);

    tick();
  }));
});
