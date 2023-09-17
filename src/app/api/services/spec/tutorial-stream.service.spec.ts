import { TestBed, tick, fakeAsync } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TutorialStream } from 'src/app/api/models/doubtfire-model';
import { TutorialStreamService } from '../tutorial-stream.service';
import { HttpRequest } from '@angular/common/http';

describe('CampusService', () => {
  let tutorialStreamService: TutorialStreamService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TutorialStreamService],
    });

    tutorialStreamService = TestBed.inject(TutorialStreamService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should return expected campuses (HttpClient called once)', fakeAsync(() => {
    const t = new TutorialStream();

    t.name = 'Tut-1';
    t.abbreviation = 'tut';
    t.activityType = 'd';

    const expectedTutorialStream: TutorialStream[] = [t];

    tutorialStreamService
      .query()
      .subscribe((tutorial_streams) =>
        expect(tutorial_streams).toEqual(expectedTutorialStream, 'expected tutorial_streams'),
      );

    const req = httpMock.expectOne((request: HttpRequest<any>): boolean => {
      expect(request.url).toEqual('http://localhost:3000/api/tutorial_streams/');
      expect(request.method).toBe('GET');
      return true;
    });

    req.flush(t);

    tick();
  }));
});
