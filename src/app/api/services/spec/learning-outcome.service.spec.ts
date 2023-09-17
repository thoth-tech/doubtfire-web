import { TestBed, tick, fakeAsync } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LearningOutcome } from 'src/app/api/models/doubtfire-model';
import { LearningOutcomeService } from '../learning-outcome.service';
import { HttpRequest } from '@angular/common/http';

describe('LearningOutcomeService', () => {
  let learningOutcomeService: LearningOutcomeService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LearningOutcomeService],
    });

    learningOutcomeService = TestBed.inject(LearningOutcomeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should return expected learning outcomes (HttpClient called once)', fakeAsync(() => {
    const l = new LearningOutcome();

    l.iloNumber = 1;
    l.name = 'global learning outcome';
    l.abbreviation = 'GLO1';
    l.description = 'test learning outcome';

    const expectedCampuses: LearningOutcome[] = [l];

    learningOutcomeService
      .query()
      .subscribe((outcomes) => expect(outcomes).toEqual(expectedCampuses, 'expected outcomes'));

    const req = httpMock.expectOne((request: HttpRequest<any>): boolean => {
      expect(request.url).toEqual('http://localhost:3000/api/outcomes/');
      expect(request.method).toBe('GET');
      return true;
    });

    l.id = 1;
    req.flush(l);

    tick();
  }));
});
