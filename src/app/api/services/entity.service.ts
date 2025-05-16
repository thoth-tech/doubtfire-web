import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export abstract class EntityService<T> {
  protected abstract readonly endpointFormat: string;

  constructor(protected httpClient: HttpClient, protected apiUrl: string) {}

  protected get<R>(endpoint: string, params?: any): Observable<R> {
    return this.httpClient.get<R>(`${this.apiUrl}/${endpoint}`, { params });
  }

  protected post<R>(endpoint: string, data: any): Observable<R> {
    return this.httpClient.post<R>(`${this.apiUrl}/${endpoint}`, data);
  }

  protected put<R>(endpoint: string, data: any): Observable<R> {
    return this.httpClient.put<R>(`${this.apiUrl}/${endpoint}`, data);
  }

  protected delete<R>(endpoint: string): Observable<R> {
    return this.httpClient.delete<R>(`${this.apiUrl}/${endpoint}`);
  }

  protected abstract createInstanceFrom(json: any): T;
} 