import {HttpClient, HttpContext} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';
import {PRESERVE_HTTP_ERROR_RESPONSE} from 'src/app/common/services/http-error-context';
import API_URL from 'src/app/config/constants/apiUrl';
import {CourseFlowCourse, CourseFlowDraft, CourseFlowMap} from '../models/course-flow';

@Injectable({providedIn: 'root'})
export class CourseFlowService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_URL}/courseflow`;

  getCourses(): Observable<CourseFlowCourse[]> {
    return this.http.get<CourseFlowCourse[]>(`${this.baseUrl}/courses`, {
      context: this.errorContext(),
    });
  }

  getMaps(): Observable<CourseFlowMap[]> {
    return this.http.get<CourseFlowMap[]>(`${this.baseUrl}/maps`, {context: this.errorContext()});
  }

  getMap(id: number): Observable<CourseFlowMap> {
    return this.http.get<CourseFlowMap>(`${this.baseUrl}/maps/${id}`, {
      context: this.errorContext(),
    });
  }

  createMap(draft: CourseFlowDraft): Observable<CourseFlowMap> {
    return this.http.post<CourseFlowMap>(`${this.baseUrl}/maps`, draft, {
      context: this.errorContext(),
    });
  }

  updateMap(id: number, draft: CourseFlowDraft, lockVersion: number): Observable<CourseFlowMap> {
    return this.http.put<CourseFlowMap>(
      `${this.baseUrl}/maps/${id}`,
      {
        ...draft,
        lock_version: lockVersion,
      },
      {context: this.errorContext()},
    );
  }

  deleteMap(id: number, lockVersion: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/maps/${id}`, {
      params: {lock_version: lockVersion},
      context: this.errorContext(),
    });
  }

  private errorContext(): HttpContext {
    return new HttpContext().set(PRESERVE_HTTP_ERROR_RESPONSE, true);
  }
}
