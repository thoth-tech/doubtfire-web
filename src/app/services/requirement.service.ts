import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import API_URL from 'src/app/config/constants/apiURL';
import {Requirement} from '../api/models/requirement-definition';

@Injectable({providedIn: 'root'})

export class RequirementService {
  private base = `${API_URL}/requirement`;

  constructor(private http: HttpClient) {}

  getByUnitId(unitId: number): Observable<Requirement[]> {
    return this.http.get<Requirement[]>(`${this.base}/unitId/${unitId}`);
  }
}
