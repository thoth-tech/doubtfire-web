import {provideHttpClient, withInterceptorsFromDi, withXhr} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import API_URL from 'src/app/config/constants/apiUrl';
import {TaskRecommendation, TaskRecommendationService} from '../task-recommendation.service';

describe('TaskRecommendationService', () => {
  let httpTestingController: HttpTestingController;
  let service: TaskRecommendationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TaskRecommendationService,
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    httpTestingController = TestBed.inject(HttpTestingController);
    service = TestBed.inject(TaskRecommendationService);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('loads and combines every recommendation page', () => {
    let recommendations: TaskRecommendation[] | undefined;

    service.getAll().subscribe((result) => {
      recommendations = result;
    });

    const firstRequest = httpTestingController.expectOne(
      (request) =>
        request.url === `${API_URL}/tasks/recommended` &&
        request.params.get('page') === '1' &&
        request.params.get('per_page') === '50',
    );
    firstRequest.flush({
      data: [makeRecommendation(1, 80)],
      meta: {page: 1, per_page: 50, total_count: 2, total_pages: 2},
    });

    const secondRequest = httpTestingController.expectOne(
      (request) =>
        request.url === `${API_URL}/tasks/recommended` &&
        request.params.get('page') === '2' &&
        request.params.get('per_page') === '50',
    );
    secondRequest.flush({
      data: [makeRecommendation(2, 60)],
      meta: {page: 2, per_page: 50, total_count: 2, total_pages: 2},
    });

    expect(recommendations).toEqual([makeRecommendation(1, 80), makeRecommendation(2, 60)]);
  });

  const makeRecommendation = (
    taskDefinitionId: number,
    priorityScore: number,
  ): TaskRecommendation => ({
    task_id: null,
    task_definition_id: taskDefinitionId,
    task_name: `Task ${taskDefinitionId}`,
    project_id: 10,
    unit_id: 20,
    priority_score: priorityScore,
  });
});
