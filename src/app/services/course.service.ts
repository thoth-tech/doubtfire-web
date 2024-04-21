import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CourseService {
  private apiUrl = 'API_BASE_URL'; // need to be changed later

  constructor(private http: HttpClient) { }

  getCourseById(id: string): Observable<any> {
    const url = `${this.apiUrl}/courses/${id}`;
    return this.http.get(url);
  }

  getCourses(): Observable<any[]> {
    const url = `${this.apiUrl}/courses`;
    return this.http.get<any[]>(url);
  }
}