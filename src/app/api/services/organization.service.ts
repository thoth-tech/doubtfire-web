import { Injectable } from '@angular/core';
import { EntityService } from './entity.service';
import { Organization } from '../models/organization';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../api.config';
import { User } from '../models/user/user';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OrganizationService extends EntityService<Organization> {
  protected readonly endpointFormat = 'organizations/:id:';

  constructor(httpClient: HttpClient) {
    super(httpClient, API_URL);
  }

  protected createInstanceFrom(json: any): Organization {
    return new Organization(json);
  }

  // Get all organizations
  query(params?: any): Observable<Organization[]> {
    return this.httpClient.get<Organization[]>(`${this.apiUrl}/${this.endpointFormat.replace(':id:', '')}`, { params });
  }

  // Get a single organization
  getOrganization(id: number): Observable<Organization> {
    return this.httpClient.get<Organization>(`${this.apiUrl}/${this.endpointFormat.replace(':id:', id.toString())}`);
  }

  // Create a new organization
  create(organization: Organization): Observable<Organization> {
    return this.httpClient.post<Organization>(`${this.apiUrl}/${this.endpointFormat.replace(':id:', '')}`, { organization });
  }

  // Update an organization
  update(organization: Organization): Observable<Organization> {
    return this.httpClient.put<Organization>(
      `${this.apiUrl}/${this.endpointFormat.replace(':id:', organization.id.toString())}`,
      { organization }
    );
  }

  // Delete an organization
  deleteOrganization(id: number): Observable<void> {
    return this.httpClient.delete<void>(`${this.apiUrl}/${this.endpointFormat.replace(':id:', id.toString())}`);
  }

  // Add a member to an organization
  addMember(organizationId: number, userId: number): Observable<Organization> {
    return this.httpClient.post<Organization>(
      `${this.apiUrl}/${this.endpointFormat.replace(':id:', organizationId.toString())}/members`,
      { user_id: userId }
    );
  }

  // Remove a member from an organization
  removeMember(organizationId: number, userId: number): Observable<void> {
    return this.httpClient.delete<void>(
      `${this.apiUrl}/${this.endpointFormat.replace(':id:', organizationId.toString())}/members/${userId}`
    );
  }

  // Get organization members
  getMembers(organizationId: number): Observable<User[]> {
    return this.httpClient.get<User[]>(
      `${this.apiUrl}/${this.endpointFormat.replace(':id:', organizationId.toString())}/members`
    );
  }

  // Search users to add to organization
  searchUsers(organizationId: number, query: string): Observable<User[]> {
    return this.httpClient.get<User[]>(
      `${this.apiUrl}/${this.endpointFormat.replace(':id:', organizationId.toString())}/search_users`,
      { params: { query } }
    );
  }
}