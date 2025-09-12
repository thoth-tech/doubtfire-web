import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import API_URL from 'src/app/config/constants/apiURL';
import {RequirementSet} from '../models/requirement-set';

@Injectable({
  providedIn: 'root',
})
export class RequirementSetService {
  constructor(private http: HttpClient) {}

  private baseUrl: string = `${API_URL}/requirementset`;

  /**
   * Get all requirement sets
   */
  getAllRequirementSets(): Observable<RequirementSet[]> {
    return this.http.get<RequirementSet[]>(this.baseUrl);
  }

  /**
   * Get requirement sets by group ID
   */
  getRequirementSetsByGroupId(groupId: number): Observable<RequirementSet[]> {
    const url = `${this.baseUrl}/requirementSetGroupId/${groupId}`;
    return this.http.get<RequirementSet[]>(url);
  }

  /**
   * Get a specific requirement set by ID
   */
  getRequirementSetById(id: number): Observable<RequirementSet> {
    const url = `${this.baseUrl}/${id}`;
    return this.http.get<RequirementSet>(url);
  }
}
