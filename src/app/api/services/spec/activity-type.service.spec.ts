import { TestBed, tick, fakeAsync } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivityType } from 'src/app/api/models/doubtfire-model';
import { ActivityTypeService } from '../activity-type.service';
import { HttpRequest } from '@angular/common/http';

describe('ActivityTypeService', () => {
  let activityTypeService: ActivityTypeService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ActivityTypeService]
    });

    activityTypeService = TestBed.inject(ActivityTypeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should return expected activity types (HttpClient called once)', fakeAsync(() => {
    const activityType = new ActivityType();
    activityType.id = 1;
    activityType.name = 'Sample Activity Type';
    activityType.abbreviation = 'SAT';

    const expectedActivityTypes: ActivityType[] = [activityType];

    activityTypeService.query().subscribe(activityTypes => {
      expect(activityTypes).toEqual(expectedActivityTypes, 'expected activity types');
    });

    const req = httpMock.expectOne((request: HttpRequest<any>): boolean => {
      expect(request.url).toEqual('http://localhost:3000/api/activity_types/');
      expect(request.method).toBe('GET');
      return true;
    });

    req.flush([activityType]);

    tick();
  }));
});
