import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import API_URL from 'src/app/config/constants/apiURL';
import {Requirement} from '../models/requirement';

@Injectable({
  providedIn: 'root',
})
export class RequirementService {
  constructor(private http: HttpClient) {}

  private baseUrl: string = `${API_URL}/requirement`;

  /**
   * Get all requirements for a course
   */
  getRequirementsByCourseId(courseId: number): Observable<Requirement[]> {
    const url = `${this.baseUrl}/courseId/${courseId}`;
    return this.http.get<Requirement[]>(url);
  }

  /**
   * Get requirements for a specific unit
   */
  getRequirementsByUnitId(unitId: number): Observable<Requirement[]> {
    const url = `${this.baseUrl}/unitId/${unitId}`;
    return this.http.get<Requirement[]>(url);
  }

  /**
   * Get all requirements
   */
  getAllRequirements(): Observable<Requirement[]> {
    const url = `${this.baseUrl}`;
    return this.http.get<Requirement[]>(url);
  }
}
