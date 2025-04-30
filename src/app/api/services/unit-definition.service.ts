import {UnitDefinition} from 'src/app/api/models/doubtfire-model';
import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpClient, HttpParams} from '@angular/common/http';

import API_URL from 'src/app/config/constants/apiURL';
import { param } from 'jquery';

@Injectable({
  providedIn: 'root'
})
export class UnitDefinitionService {
  constructor(private http: HttpClient) {}

  private baseUrl: string = `${API_URL}/unit_definition`;

  // Get unit-definitions
  getDefinitions(): Observable<UnitDefinition[]> {
    console.log("fetched unit definitions");
    return this.http.get<UnitDefinition[]>(this.baseUrl);
  }

  getUnitDefinitionById(id: string): Observable<UnitDefinition> {
    const url = `${this.baseUrl}/unitDefinitionId/${id}`;
    return this.http.get<UnitDefinition>(url);
  }

  searchUnitDefinitions(searchId?:number, searchName?: string, ): Observable<[UnitDefinition]> {
    let params = new HttpParams();
    if (searchId) {
      params = params.set('id', searchId.toString());
    }
    if (searchName) {
      params = params.set('name', searchName);
    }
    const url = `${this.baseUrl}/search`;
    return this.http.get<[UnitDefinition]>(url, {params});
  }

  addUnitDefinition(
    name: string,
    description: string,
    code: string,
    version: string,
    tasknum: number,
    unitTutorFirstName: string,
    unitTutorLastName: string,
  ): Observable<UnitDefinition> {
    let params = new HttpParams();
    params.set('name', name);
    params.set('description', description);
    params.set('code', code);
    params.set('version', version);
    params.set('Number of Tasks', tasknum);
    params.set('Unit Tutor first name', unitTutorFirstName);
    params.set('Unit Tutor last name', unitTutorLastName);
    console.log("added unit definition");
    return this.http.post<UnitDefinition>(this.baseUrl, {params});
  }

  updateUnitDefinition(
    unitDefinitionId: number,
    name: string,
    description: string,
    code: string,
    tasknum: number,
    unitTutorFirstName: string,
    unitTutorLastName: string,
  ): Observable<UnitDefinition> {
    const params = new HttpParams();
    params.set('unitDefinitionId', unitDefinitionId.toString());
    params.set('name', name);
    params.set('description', description);
    params.set('code', code);
    params.set('Number of Tasks', tasknum);
    params.set('Unit Tutor first name', unitTutorFirstName);
    params.set('Unit Tutor last name', unitTutorLastName);
    const url = `${this.baseUrl}/:id:`;
    return this.http.put<UnitDefinition>(url, {params});
  }

  deleteUnitDefinition(unitId:number): Observable<void> {
    const params = new HttpParams();
    const url = `${this.baseUrl}/:id:`;
    params.set('unitId', unitId.toString());
    return this.http.delete<void>(url, {params});
  }

  removeUnitFromUnitDefinition(unitId:number, unitDefinitionId:number): Observable<void> {
    const params = new HttpParams();
    const url = `${this.baseUrl}/:id:`;
    params.set('unitId', unitId.toString());
    params.set('unitDefinitionId', unitDefinitionId.toString());
    return this.http.delete<void>(url, {params});
  }
}
