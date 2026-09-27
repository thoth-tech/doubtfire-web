import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {EMPTY, Observable, expand, reduce} from 'rxjs';
import API_URL from 'src/app/config/constants/apiUrl';

export type TaskRecommendation = {
  task_id: number | null;
  task_definition_id: number;
  task_name: string;
  project_id: number;
  unit_id: number;
  priority_score: number;
};

export type TaskRecommendationPage = {
  data: TaskRecommendation[];
  meta: {
    page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
  };
};

@Injectable({providedIn: 'root'})
export class TaskRecommendationService {
  private static readonly PAGE_SIZE = 50;

  constructor(private httpClient: HttpClient) {}

  getAll(): Observable<TaskRecommendation[]> {
    return this.getPage(1).pipe(
      expand((response) =>
        response.meta.page < response.meta.total_pages
          ? this.getPage(response.meta.page + 1)
          : EMPTY,
      ),
      reduce(
        (recommendations, response) => recommendations.concat(response.data),
        [] as TaskRecommendation[],
      ),
    );
  }

  private getPage(page: number): Observable<TaskRecommendationPage> {
    return this.httpClient.get<TaskRecommendationPage>(`${API_URL}/tasks/recommended`, {
      params: {
        page,
        per_page: TaskRecommendationService.PAGE_SIZE,
      },
    });
  }
}
