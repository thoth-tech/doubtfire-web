import { TeachingPeriodService, Unit, UnitRole, UnitService, UserService } from 'src/app/api/models/doubtfire-model';
import { CachedEntityService } from 'ngx-entity-service';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';

import API_URL from 'src/app/config/constants/apiURL';

@ Injectable()
export class EntityService {
  constructor() {}
}

@ Injectable()
export class UnitDefinitionService {

  constructor(private http: HttpClient) {}

  private baseUrl: string = `${API_URL}/unit-definition`;


  // Get unit-definitions
  getDefinitions(): Observable<Unit> {
    const url = `${this.baseUrl}`;
    return this.http.get<Unit>(url);
  }

  getUnitDefinitionById(): Observable<Unit> {
    const url = `${this.baseUrl}/:id:`;
    return this.http.get<Unit>(url);
  }

  searchUnitDefinitions(searchId?:number, searchName?: string, ): Observable<[]> {
    let params = new HttpParams();
    if (searchId) {
      params = params.set('id', searchId.toString());
    }
    if (searchName) {
      params = params.set('name', searchName);
    }

    const url = `${this.baseUrl}/search`;
    return this.http.get<[]>(url, {params});
  }

  addUnitDefinition(
    unitDefinitionId: number,
    name: string,
    description: string,
    code: string,
  ): Observable<Unit> {
    let params = new HttpParams();
    params.set('unitDefinitionId', unitDefinitionId.toString());
    params.set('name', name);
    params.set('description', description);
    params.set('code', code);

    const url = `${this.baseUrl}`;
    return this.http.post<Unit>(url, {params});
  }

  updateUnitDefinition(
    unitDefinitionId: number,
    name: string,
    description: string,
    code: string,
  ): Observable<Unit> {
    const params = new HttpParams();
    params.set('unitDefinitionId', unitDefinitionId.toString());
    params.set('name', name);
    params.set('description', description);
    params.set('code', code);

    const url = `${this.baseUrl}/:id:`;
    return this.http.put<Unit>(url, {params});
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
